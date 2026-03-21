-- 005: Feed Ingestion and User Infrastructure
-- Depends on: 001_initial.sql, 002_auth_and_usage.sql, 004_duplicate_handling.sql
-- Changes: feeds, feed_poll_runs, feed_poll_run_items tables; sources.ingested_by_feed_id;
--          user_jurisdictions; profiles gamification columns; briefs engagement columns;
--          RLS policies; active_feeds() and finalize_poll_run() helper functions
-- Setup required: INGEST_HMAC_SECRET, OPENSTATES_API_KEY, RESEND_API_KEY, ADMIN_EMAIL env vars

-- ─── Part A: Feed Ingestion Tables ───

-- feeds: registered government document feeds to poll
create table feeds (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid not null references jurisdictions(id),
  document_type_id smallint references document_types(id),  -- null = infer from content
  name text not null,
  feed_url text not null unique,
  feed_type text not null default 'rss'
    check (feed_type in ('rss', 'atom', 'json_api', 'legistar')),
  expected_domain text,                        -- e.g. 'seattle.gov' for URL validation
  is_active boolean not null default true,
  last_polled_at timestamptz,
  last_successful_poll_at timestamptz,
  last_seen_item_guid text,                    -- dedup: skip items at or before this guid
  etag text,                                   -- HTTP ETag for conditional requests
  last_modified text,                          -- HTTP Last-Modified for conditional requests
  consecutive_failures smallint not null default 0,
  max_items_per_poll smallint not null default 10,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index feeds_jurisdiction_id_idx on feeds (jurisdiction_id);
create index feeds_is_active_idx on feeds (is_active) where is_active = true;

-- feed_poll_runs: one record per cron invocation
create table feed_poll_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'completed', 'partial', 'failed')),
  feeds_dispatched smallint default 0,
  total_items_processed smallint default 0,
  total_items_skipped smallint default 0,
  total_errors smallint default 0,
  total_new_briefs smallint default 0,
  duration_ms integer,
  metadata jsonb default '{}'
);

create index feed_poll_runs_started_at_idx on feed_poll_runs (started_at desc);

-- feed_poll_run_items: one record per feed per poll run
create table feed_poll_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references feed_poll_runs(id) on delete cascade,
  feed_id uuid not null references feeds(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  items_found smallint default 0,
  items_processed smallint default 0,
  items_skipped smallint default 0,
  items_deferred smallint default 0,
  new_briefs_created smallint default 0,
  skipped_formats jsonb default '{}',          -- frequency map: {"text/html": 3}
  errors jsonb default '[]',
  duration_ms integer,
  created_at timestamptz default now(),
  unique (run_id, feed_id)
);

create index feed_poll_run_items_run_id_idx on feed_poll_run_items (run_id);

-- Link sources back to the feed that produced them
alter table sources
  add column ingested_by_feed_id uuid references feeds(id) on delete set null;

create index sources_ingested_by_feed_id_idx on sources (ingested_by_feed_id);

-- ─── Part B: Forward-Compatible User Infrastructure ───

-- user_jurisdictions: user's subscribed/home jurisdictions
create table user_jurisdictions (
  user_id uuid not null references auth.users(id) on delete cascade,
  jurisdiction_id uuid not null references jurisdictions(id) on delete cascade,
  is_primary boolean not null default false,
  notify boolean not null default true,
  created_at timestamptz default now(),
  primary key (user_id, jurisdiction_id)
);

create index user_jurisdictions_user_id_idx on user_jurisdictions (user_id);

-- profiles: gamification columns (contribution score, badges, streaks)
alter table profiles
  add column contribution_score integer not null default 0,
  add column badges jsonb default '[]',
  add column streak_current smallint not null default 0,
  add column streak_longest smallint not null default 0,
  add column last_active_at timestamptz,
  add column home_jurisdiction_id uuid references jurisdictions(id);

-- briefs: engagement tracking columns
alter table briefs
  add column view_count integer not null default 0,
  add column share_count integer not null default 0;

-- ─── Part C: Row Level Security ───

alter table feeds enable row level security;
alter table feed_poll_runs enable row level security;
alter table feed_poll_run_items enable row level security;
alter table user_jurisdictions enable row level security;

-- Feed data is public read (transparency: citizens can see what is being monitored)
create policy "Public read feeds"
  on feeds for select using (true);

create policy "Public read feed_poll_runs"
  on feed_poll_runs for select using (true);

create policy "Public read feed_poll_run_items"
  on feed_poll_run_items for select using (true);

-- Users manage their own jurisdiction subscriptions
create policy "Users manage own jurisdictions"
  on user_jurisdictions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Part D: Helper Functions ───

-- active_feeds(): returns feeds eligible for polling, oldest-first
create or replace function active_feeds()
returns setof feeds
language sql stable
as $$
  select *
  from feeds
  where is_active = true
  order by last_polled_at asc nulls first;
$$;

-- finalize_poll_run(run_uuid): aggregate item totals into the run record.
-- No-op if items are still pending/processing (race guard).
-- Call once per cron run after all feed workers complete.
create or replace function finalize_poll_run(run_uuid uuid)
returns void
language plpgsql
as $$
declare
  v_pending_count integer;
begin
  -- Race guard: bail if any items are still in flight
  select count(*) into v_pending_count
  from feed_poll_run_items
  where run_id = run_uuid
    and status in ('pending', 'processing');

  if v_pending_count > 0 then
    return;
  end if;

  -- Aggregate item totals into the run record
  update feed_poll_runs
  set
    completed_at        = now(),
    status              = case
                            when exists (
                              select 1 from feed_poll_run_items
                              where run_id = run_uuid and status = 'failed'
                            ) then 'partial'
                            else 'completed'
                          end,
    total_items_processed = (
      select coalesce(sum(items_processed), 0)
      from feed_poll_run_items where run_id = run_uuid
    ),
    total_items_skipped = (
      select coalesce(sum(items_skipped), 0)
      from feed_poll_run_items where run_id = run_uuid
    ),
    total_errors  = (
      select coalesce(sum(jsonb_array_length(errors)), 0)
      from feed_poll_run_items where run_id = run_uuid
    ),
    total_new_briefs    = (
      select coalesce(sum(new_briefs_created), 0)
      from feed_poll_run_items where run_id = run_uuid
    ),
    duration_ms         = (
      extract(epoch from (now() - started_at)) * 1000
    )::integer
  where id = run_uuid
    and status = 'running';  -- race guard: only update if still running
end;
$$;

-- ─── Updated_at trigger for feeds ───
create trigger feeds_updated_at
  before update on feeds
  for each row execute function update_updated_at();
