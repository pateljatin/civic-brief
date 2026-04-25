-- Migration 009: Brief-Jurisdiction tagging (C14)
-- Tags each brief to multiple jurisdictions with relationship types and confidence scores.
-- Pre-computes ancestor relationships at write time for fast location-based queries.

-- Junction table: briefs <-> jurisdictions (mirrors brief_topics pattern)
create table if not exists brief_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references briefs(id) on delete cascade,
  jurisdiction_id uuid not null references jurisdictions(id) on delete cascade,
  relationship text not null default 'direct',
  confidence numeric(3,2) default 1.0,
  assigned_by text not null default 'ai',
  created_at timestamptz default now(),
  unique(brief_id, jurisdiction_id)
);

-- Fast lookups for notification fan-out and location queries
create index if not exists idx_brief_jurisdictions_jurisdiction
  on brief_jurisdictions(jurisdiction_id);

-- Fast lookups for "all jurisdictions for this brief"
create index if not exists idx_brief_jurisdictions_brief
  on brief_jurisdictions(brief_id);

-- Simplified boundary column for future map rendering (C23)
-- Populated by scripts/load-boundaries.ts via ST_SimplifyPreserveTopology(boundary, 0.01)
alter table jurisdictions
  add column if not exists boundary_simplified geometry(MultiPolygon, 4326);

create index if not exists jurisdictions_boundary_simplified_gist
  on jurisdictions using gist (boundary_simplified);

-- Replace briefs_for_location() with junction-table-based version.
-- Ancestors are pre-computed as rows at write time, so no recursive CTE needed at query time.
create or replace function briefs_for_location(
  p_jurisdiction_id uuid,
  p_language text default 'en',
  p_limit int default 50
)
returns table (
  brief_id uuid,
  headline text,
  source_url text,
  document_type text,
  language text,
  jurisdiction_name text,
  jurisdiction_level text,
  jurisdiction_depth smallint,
  confidence_score numeric,
  relationship text,
  created_at timestamptz
)
language sql stable
set search_path = 'public'
as $$
  select
    b.id as brief_id,
    b.headline,
    s.url as source_url,
    dt.name as document_type,
    l.bcp47 as language,
    j.name as jurisdiction_name,
    jl.name as jurisdiction_level,
    jl.depth as jurisdiction_depth,
    s.factuality_score as confidence_score,
    bj.relationship,
    b.created_at
  from brief_jurisdictions bj
  join briefs b on b.id = bj.brief_id
  join sources s on s.id = b.source_id
  join jurisdictions j on j.id = bj.jurisdiction_id
  join jurisdiction_levels jl on jl.id = j.level_id
  join languages l on l.id = b.language_id
  left join document_types dt on dt.id = s.document_type_id
  where bj.jurisdiction_id = p_jurisdiction_id
    and b.is_published = true
    and l.bcp47 = p_language
  order by jl.depth desc, b.created_at desc
  limit p_limit;
$$;
