-- Civic Brief: Migration 002 - Auth, User Profiles, and Usage Tracking
-- Depends on: 001_initial.sql
-- Requires: Supabase Auth enabled (handles auth.users automatically)
--
-- SETUP REQUIRED (Supabase Dashboard):
--   1. Authentication > Providers > Enable Google
--   2. Authentication > Providers > Enable GitHub
--   3. Google Cloud Console: Create OAuth credentials, add redirect URI
--   4. GitHub: Create OAuth App, add redirect URI

-- ─── Profiles ───
-- Extends auth.users with app-specific data.
-- Auto-created on signup via trigger.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_language_id smallint not null default 1 references languages(id),
  daily_limit smallint not null default 3,            -- per-user daily doc limit
  role text not null default 'citizen'
    check (role in ('citizen', 'reviewer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on profiles (role);

-- ─── Usage Events ───
-- Every document processing request, successful or not.
-- Powers: per-user rate limiting, analytics, cost tracking.
create table usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in ('summarize', 'translate', 'verify', 'view_brief')),
  source_id uuid references sources(id) on delete set null,
  brief_id uuid references briefs(id) on delete set null,
  ip_hash text,                                       -- SHA-256 of IP for anonymous rate limiting
  success boolean not null default true,
  error_message text,
  tokens_used integer,                                -- Claude API tokens consumed
  latency_ms integer,                                 -- Processing time
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index usage_events_user_id_idx on usage_events (user_id);
create index usage_events_created_at_idx on usage_events (created_at desc);
create index usage_events_event_type_idx on usage_events (event_type);
-- For daily limit queries: count events per user per day
create index usage_events_user_daily_idx on usage_events (user_id, created_at)
  where event_type = 'summarize' and success = true;

-- ─── Add user_id to existing tables ───

-- Track which user submitted each source document
alter table sources add column submitted_by uuid references auth.users(id) on delete set null;
create index sources_submitted_by_idx on sources (submitted_by);

-- Track which user submitted feedback
alter table community_feedback add column user_id uuid references auth.users(id) on delete set null;
create index community_feedback_user_id_idx on community_feedback (user_id);

-- ─── Auto-create profile on signup ───
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Helper: count user's summarize requests today ───
create or replace function user_daily_usage(user_uuid uuid)
returns integer
language sql stable
as $$
  select count(*)::integer
  from usage_events
  where user_id = user_uuid
    and event_type = 'summarize'
    and success = true
    and created_at >= date_trunc('day', now() at time zone 'UTC');
$$;

-- ─── Helper: check if user can process another document ───
create or replace function user_can_summarize(user_uuid uuid)
returns boolean
language sql stable
as $$
  select user_daily_usage(user_uuid) < (
    select daily_limit from profiles where id = user_uuid
  );
$$;

-- ─── Row Level Security ───

alter table profiles enable row level security;
alter table usage_events enable row level security;

-- Profiles: users can read their own, admins can read all
create policy "Users read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Usage events: users can read their own
create policy "Users read own usage"
  on usage_events for select
  using (auth.uid() = user_id);

-- Usage events: server inserts (service role bypasses RLS)
-- No insert policy needed; API routes use service role key

-- Community feedback: authenticated users can see who submitted
-- (Updates existing policy scope - feedback is still publicly readable)

-- Sources: add policy for submitted_by filtering
create policy "Users read own submissions"
  on sources for select
  using (submitted_by = auth.uid() or status = 'processed');

-- ─── Updated_at trigger for profiles ───
create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- ─── Analytics views ───

-- Daily usage summary (for admin dashboard)
create or replace view daily_usage_summary as
select
  date_trunc('day', created_at) as day,
  event_type,
  count(*) as total_events,
  count(distinct user_id) as unique_users,
  count(*) filter (where success) as successful,
  count(*) filter (where not success) as failed,
  avg(latency_ms) filter (where latency_ms is not null) as avg_latency_ms,
  sum(tokens_used) filter (where tokens_used is not null) as total_tokens
from usage_events
group by date_trunc('day', created_at), event_type
order by day desc, event_type;
