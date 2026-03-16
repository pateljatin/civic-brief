-- Civic Brief: Initial Schema
-- Requires PostGIS extension enabled in Supabase dashboard

-- ─── Extensions ───
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ─── Countries ───
-- ISO 3166-1. Defines which identifier system applies per country.
create table countries (
  id smallserial primary key,
  iso_alpha2 char(2) not null unique,
  iso_alpha3 char(3) not null unique,
  iso_numeric char(3) not null unique,
  name text not null,
  official_name text,
  identifier_system text  -- 'fips' for US, 'lgd' for India, 'ons' for UK
);

-- ─── Jurisdiction Levels ───
-- Vocabulary of government levels per country.
-- US: federal/state/county/city/township/village/special_district
-- India: central/state/district/tehsil/block/municipality
create table jurisdiction_levels (
  id smallserial primary key,
  country_id smallint not null references countries(id),
  slug text not null,
  name text not null,
  depth smallint not null default 0,
  unique (country_id, slug)
);

-- ─── Jurisdictions ───
-- THE CORE TABLE. Self-referencing tree of every government body.
create table jurisdictions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references jurisdictions(id),
  level_id smallint not null references jurisdiction_levels(id),
  country_id smallint not null references countries(id),
  name text not null,
  slug text not null,
  ocd_id text unique,                         -- Open Civic Data division ID
  fips_code text,                              -- US FIPS code
  iso_3166_2 text,                             -- ISO 3166-2 subdivision code
  geonames_id integer,
  external_ids jsonb default '{}',             -- catch-all for other IDs
  centroid geometry(Point, 4326),              -- PostGIS point
  boundary geometry(MultiPolygon, 4326),       -- PostGIS boundary
  population integer,
  timezone text,
  website_url text,
  valid_from date,
  valid_until date,
  successor_id uuid references jurisdictions(id),
  created_at timestamptz default now()
);

-- Spatial indexes
create index jurisdictions_centroid_gist on jurisdictions using gist (centroid);
create index jurisdictions_boundary_gist on jurisdictions using gist (boundary);
-- Trigram indexes for fuzzy name search
create index jurisdictions_name_trgm on jurisdictions using gin (name gin_trgm_ops);
-- Standard lookups
create index jurisdictions_slug_idx on jurisdictions (slug);
create index jurisdictions_ocd_id_idx on jurisdictions (ocd_id);
create index jurisdictions_fips_code_idx on jurisdictions (fips_code);
create index jurisdictions_parent_id_idx on jurisdictions (parent_id);
create index jurisdictions_country_id_idx on jurisdictions (country_id);

-- ─── Languages ───
-- Only languages we actually produce briefs in.
create table languages (
  id smallserial primary key,
  bcp47 text not null unique,                 -- 'en', 'es', 'hi'
  name text not null,                          -- 'English'
  native_name text not null,                   -- 'English'
  pg_config text not null default 'simple'     -- PostgreSQL text search config
);

-- ─── Jurisdiction Languages ───
-- Which languages each jurisdiction serves.
-- Drives pipeline: new source for King County -> produce briefs in every language listed.
create table jurisdiction_languages (
  jurisdiction_id uuid not null references jurisdictions(id) on delete cascade,
  language_id smallint not null references languages(id),
  is_primary boolean not null default false,
  primary key (jurisdiction_id, language_id)
);

-- ─── Topics ───
-- Hierarchical civic topic taxonomy. Controlled vocabulary for subscriptions.
create table topics (
  id smallserial primary key,
  parent_id smallint references topics(id),
  slug text not null unique,
  name text not null,
  description text
);

-- ─── Document Types ───
-- Flat lookup for source document classification.
create table document_types (
  id smallserial primary key,
  slug text not null unique,
  name text not null,
  description text
);

-- ─── Sources ───
-- Reference to a government document we processed.
-- NEVER stores the document itself. Only metadata and a URL to the original.
create table sources (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid not null references jurisdictions(id),
  document_type_id smallint not null references document_types(id),
  title text not null,
  source_url text not null,                    -- REQUIRED: verifiable link to original
  archive_url text,                            -- Wayback Machine backup
  content_hash text not null,                  -- SHA-256 of extracted text at processing time
  published_at timestamptz,
  language_id smallint references languages(id),
  factuality_score real check (factuality_score between 0 and 1),
  confidence_level text check (confidence_level in ('high', 'medium', 'low')),
  requires_review boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'failed', 'retracted')),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index sources_content_hash_idx on sources (content_hash);
create index sources_jurisdiction_id_idx on sources (jurisdiction_id);
create index sources_status_idx on sources (status);
create index sources_created_at_idx on sources (created_at desc);

-- ─── Briefs ───
-- THE PRODUCT. One brief per source per language.
create table briefs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  language_id smallint not null references languages(id),
  headline text not null,
  summary text not null,                       -- plain text for search
  content jsonb not null,                      -- structured civic output
  who_affected text,                           -- denormalized for filtering
  what_action text,                            -- denormalized for filtering
  deadline timestamptz,                        -- next relevant deadline
  is_published boolean not null default false,
  published_at timestamptz,
  version smallint not null default 1,
  previous_version_id uuid references briefs(id),
  tags text[] default '{}',
  model_used text not null,
  prompt_version text not null,
  fts tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(headline, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B')
  ) stored,
  created_at timestamptz default now(),
  unique (source_id, language_id, version)
);

create index briefs_fts_idx on briefs using gin (fts);
create index briefs_source_id_idx on briefs (source_id);
create index briefs_language_id_idx on briefs (language_id);
create index briefs_published_idx on briefs (is_published, published_at desc);
create index briefs_deadline_idx on briefs (deadline) where deadline is not null;

-- ─── Brief Topics ───
-- Junction: brief <-> topic, with confidence score.
create table brief_topics (
  brief_id uuid not null references briefs(id) on delete cascade,
  topic_id smallint not null references topics(id),
  confidence real not null default 1.0 check (confidence between 0 and 1),
  assigned_by text not null default 'ai' check (assigned_by in ('ai', 'human')),
  primary key (brief_id, topic_id)
);

-- ─── Community Feedback ───
-- Verification Layer 4: structured citizen feedback.
create table community_feedback (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references briefs(id) on delete cascade,
  feedback_type text not null
    check (feedback_type in ('factual_error', 'missing_info', 'misleading', 'translation_error', 'outdated', 'helpful')),
  details text,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create index community_feedback_brief_id_idx on community_feedback (brief_id);
create index community_feedback_type_idx on community_feedback (feedback_type);

-- ─── Database Functions ───

-- Full-text search across briefs
create or replace function search_briefs(
  query text,
  lang_bcp47 text default null,
  jurisdiction_id_param uuid default null,
  doc_type_slug text default null,
  topic_slug text default null,
  result_limit int default 20
)
returns table (
  brief_id uuid,
  headline text,
  summary text,
  source_url text,
  language text,
  published_at timestamptz,
  relevance real
)
language sql stable
as $$
  select
    b.id as brief_id,
    b.headline,
    b.summary,
    s.source_url,
    l.bcp47 as language,
    b.published_at,
    ts_rank(b.fts, websearch_to_tsquery('simple', query)) as relevance
  from briefs b
  join sources s on s.id = b.source_id
  join languages l on l.id = b.language_id
  left join brief_topics bt on bt.brief_id = b.id
  left join topics t on t.id = bt.topic_id
  where b.is_published = true
    and b.fts @@ websearch_to_tsquery('simple', query)
    and (lang_bcp47 is null or l.bcp47 = lang_bcp47)
    and (jurisdiction_id_param is null or s.jurisdiction_id = jurisdiction_id_param)
    and (doc_type_slug is null or exists (
      select 1 from document_types dt
      where dt.id = s.document_type_id and dt.slug = doc_type_slug
    ))
    and (topic_slug is null or t.slug = topic_slug)
  group by b.id, b.headline, b.summary, s.source_url, l.bcp47, b.published_at, b.fts
  order by relevance desc
  limit result_limit;
$$;

-- Find all jurisdictions governing a geographic point
create or replace function jurisdictions_at_point(lng double precision, lat double precision)
returns table (
  jurisdiction_id uuid,
  name text,
  level_name text,
  depth smallint,
  ocd_id text
)
language sql stable
as $$
  select
    j.id as jurisdiction_id,
    j.name,
    jl.name as level_name,
    jl.depth,
    j.ocd_id
  from jurisdictions j
  join jurisdiction_levels jl on jl.id = j.level_id
  where st_covers(j.boundary, st_setsrid(st_makepoint(lng, lat), 4326))
  order by jl.depth desc;
$$;

-- Walk up the jurisdiction tree
create or replace function jurisdiction_ancestors(jurisdiction_uuid uuid)
returns table (
  id uuid,
  name text,
  level_name text,
  depth smallint
)
language sql stable
as $$
  with recursive ancestors as (
    select j.id, j.name, j.parent_id, jl.name as level_name, jl.depth
    from jurisdictions j
    join jurisdiction_levels jl on jl.id = j.level_id
    where j.id = jurisdiction_uuid

    union all

    select j.id, j.name, j.parent_id, jl.name as level_name, jl.depth
    from jurisdictions j
    join jurisdiction_levels jl on jl.id = j.level_id
    join ancestors a on a.parent_id = j.id
  )
  select ancestors.id, ancestors.name, ancestors.level_name, ancestors.depth
  from ancestors
  order by ancestors.depth asc;
$$;

-- All briefs from a jurisdiction and its ancestors
create or replace function briefs_for_location(
  jurisdiction_uuid uuid,
  lang_bcp47 text default 'en',
  result_limit int default 50
)
returns table (
  brief_id uuid,
  headline text,
  summary text,
  source_url text,
  jurisdiction_name text,
  level_name text,
  published_at timestamptz,
  confidence_level text
)
language sql stable
as $$
  select
    b.id as brief_id,
    b.headline,
    b.summary,
    s.source_url,
    j.name as jurisdiction_name,
    jl.name as level_name,
    b.published_at,
    s.confidence_level
  from briefs b
  join sources s on s.id = b.source_id
  join languages l on l.id = b.language_id
  join jurisdictions j on j.id = s.jurisdiction_id
  join jurisdiction_levels jl on jl.id = j.level_id
  where b.is_published = true
    and l.bcp47 = lang_bcp47
    and s.jurisdiction_id in (
      select a.id from jurisdiction_ancestors(jurisdiction_uuid) a
    )
  order by b.published_at desc nulls last
  limit result_limit;
$$;

-- ─── Row Level Security ───
-- For demo: allow public read access, server-only writes.

alter table countries enable row level security;
alter table jurisdiction_levels enable row level security;
alter table jurisdictions enable row level security;
alter table languages enable row level security;
alter table topics enable row level security;
alter table document_types enable row level security;
alter table sources enable row level security;
alter table briefs enable row level security;
alter table brief_topics enable row level security;
alter table community_feedback enable row level security;
alter table jurisdiction_languages enable row level security;

-- Public read access for all reference/published data
create policy "Public read countries" on countries for select using (true);
create policy "Public read jurisdiction_levels" on jurisdiction_levels for select using (true);
create policy "Public read jurisdictions" on jurisdictions for select using (true);
create policy "Public read languages" on languages for select using (true);
create policy "Public read topics" on topics for select using (true);
create policy "Public read document_types" on document_types for select using (true);
create policy "Public read sources" on sources for select using (status = 'processed');
create policy "Public read briefs" on briefs for select using (is_published = true);
create policy "Public read brief_topics" on brief_topics for select using (true);
create policy "Public read jurisdiction_languages" on jurisdiction_languages for select using (true);

-- Community feedback: anyone can insert, only read their own
create policy "Public insert feedback" on community_feedback for insert with check (true);
create policy "Public read feedback" on community_feedback for select using (true);

-- ─── Updated_at trigger ───
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sources_updated_at
  before update on sources
  for each row execute function update_updated_at();
