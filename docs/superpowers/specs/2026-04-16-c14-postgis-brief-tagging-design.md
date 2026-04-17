# C14: PostGIS Brief Tagging -- Design Spec

**Issue:** #14
**Milestone:** v1.1 Trust Loop (target: June 1, 2026)
**Author:** Claude + Jatin Patel
**Date:** 2026-04-16
**Status:** Approved

---

## 1. Purpose

Connect every civic brief to the specific government jurisdictions it covers. Right now a brief is loosely tied to a jurisdiction only through `sources.jurisdiction_id` -- a single foreign key set at upload time. That's too rigid: a Seattle budget brief is also relevant to King County residents and Washington state watchers. And `briefs_for_location()` has to do an ancestor walk at query time to find them all.

C14 introduces a `brief_jurisdictions` junction table. Each brief gets tagged to its direct jurisdiction plus every ancestor up the tree, pre-computed at write time. A new `/location` page and `/api/location` endpoint let users search for briefs by city, county, or state without needing an interactive map.

### Success Criteria

1. Every new brief (from upload or feed ingestion) is tagged in `brief_jurisdictions` with `direct` + `ancestor` rows automatically.
2. `briefs_for_location()` queries the junction table instead of doing a recursive ancestor walk at query time.
3. `/api/location?q=Seattle` returns ranked jurisdiction matches with full hierarchy context and brief counts.
4. `/location` page renders search results and briefs for a selected jurisdiction, mobile-first.
5. Feed ingestion (C7) auto-tags briefs using the feed's `jurisdiction_id`.
6. All components cover the five required states: default, loading, empty, error, demo.

---

## 2. Product Decisions

All decisions were made during brainstorming on 2026-04-16.

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Tagging approach | Approach B: Multi-Tag junction table | Mirrors `brief_topics` pattern; clean joins; extensible for future relationship types |
| 2 | Ancestor pre-computation | At write time (pipeline), not query time | Faster reads; `briefs_for_location()` becomes a simple indexed lookup |
| 3 | Jurisdiction assignment | Auto-suggest from URL domain + manual override | Domain lookup covers most government URLs; manual escape hatch for edge cases |
| 4 | Conflict handling | `ON CONFLICT DO NOTHING` on unique constraint | Second write is a no-op; safe for concurrent uploads of the same document |
| 5 | Location page UI | Search + list, no map | Map is C23; a list view is sufficient for brief discovery and unblocks the subscription model |
| 6 | Boundary data loading | Separate script, not a migration | Keeps Migration 009 small and fast; boundaries can be (re)loaded independently |
| 7 | International boundaries | Deferred to C20 | geoBoundaries v6 (CC BY 4.0) is the correct source when we get there; GADM is non-commercial |
| 8 | Simplified geometries for tiles | Include in Migration 009 | `boundary_simplified` column added now; populated by `scripts/load-boundaries.ts` via `ST_SimplifyPreserveTopology(boundary, 0.01)` |
| 9 | Address-level geocoding | Out of scope | Jurisdiction-level search is sufficient for brief discovery |

---

## 3. Architecture

### Data Model

```
briefs  <---->  brief_jurisdictions  <---->  jurisdictions
                   (junction table)
                   - relationship
                   - confidence
                   - assigned_by

jurisdictions  (self-referencing tree)
   |
   +-- boundary (PostGIS MultiPolygon, loaded by scripts/load-boundaries.ts)
   +-- centroid (PostGIS Point)
```

### Tagging Flow (Upload Path)

```
User uploads PDF
      |
      v
/api/summarize
      |
      +-- URL domain lookup -> infer jurisdiction_id
      |   (or user selected via upload form dropdown)
      |
      +-- Create source + brief (existing pipeline)
      |
      +-- tagBriefJurisdictions(brief_id, jurisdiction_id, 'manual' | 'ai')
            |
            +-- INSERT INTO brief_jurisdictions (direct, confidence=1.0)
            |
            +-- jurisdiction_ancestors(jurisdiction_id)
                  |
                  +-- INSERT INTO brief_jurisdictions (ancestor rows, confidence=1.0)
```

### Tagging Flow (Feed Ingestion Path)

```
Feed worker processes item
      |
      +-- feed.jurisdiction_id is already known
      |
      +-- Create source + brief (existing pipeline)
      |
      +-- tagBriefJurisdictions(brief_id, jurisdiction_id, 'feed')
            |
            (same as above, relationship='direct' for feed jurisdiction,
             relationship='ancestor' for all parents)
```

### Location Search Flow

```
User types "Seattle" on /location
      |
      v
GET /api/location?q=Seattle
      |
      +-- pg_trgm similarity() query on jurisdictions.name
      |   (weighted by population DESC, limit 10)
      |
      +-- Returns: [{ jurisdiction, hierarchy, brief_count, similarity }]
      |
User selects result
      |
      v
/location?id=<jurisdiction_id>
      |
      +-- briefs_for_location(jurisdiction_id)  (simple junction table join)
      |
      +-- Group results by jurisdiction level
      |   (Federal -> State -> County -> City)
      |
      +-- Render briefs list
```

---

## 4. Database Changes

### Migration 009: brief_jurisdictions table

```sql
create table brief_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references briefs(id) on delete cascade,
  jurisdiction_id uuid not null references jurisdictions(id) on delete cascade,
  relationship text not null default 'direct',
  confidence numeric(3,2) default 1.0,
  assigned_by text not null default 'ai',
  created_at timestamptz default now(),
  unique(brief_id, jurisdiction_id)
);

create index idx_brief_jurisdictions_jurisdiction on brief_jurisdictions(jurisdiction_id);
create index idx_brief_jurisdictions_brief on brief_jurisdictions(brief_id);

-- Add simplified boundary column to jurisdictions (for future map rendering, populated by load-boundaries.ts)
alter table jurisdictions add column if not exists boundary_simplified geometry(MultiPolygon, 4326);
create index if not exists jurisdictions_boundary_simplified_gist on jurisdictions using gist (boundary_simplified);
```

**`relationship` values:**
- `direct` -- This brief is explicitly about this jurisdiction (selected by user, inferred from URL, or from feed config).
- `ancestor` -- Auto-tagged because the direct jurisdiction is a child. A Seattle brief gets tagged with King County and Washington as ancestors.
- `mentioned` -- AI detected this jurisdiction in the brief text but it is not the primary subject. Not used in v1.1; reserved for future NER pass.
- `community` -- A user flagged this jurisdiction as relevant via the community feedback system.

**`assigned_by` values:**
- `ai` -- Pipeline inferred from URL domain or document text.
- `manual` -- User explicitly selected via the upload form dropdown.
- `feed` -- Feed ingestion; jurisdiction comes from the feed row's `jurisdiction_id`.
- `community` -- User correction via the community feedback UI.

**Migration 009 also adds:**
- `boundary_simplified geometry(MultiPolygon, 4326)` column on `jurisdictions` with GiST index. Populated by `scripts/load-boundaries.ts` using `ST_SimplifyPreserveTopology(boundary, 0.01)`.

**What Migration 009 does NOT include:**
- Boundary geometry data itself (loaded by `scripts/load-boundaries.ts` separately).

### Updated function: briefs_for_location()

Replace the current recursive ancestor walk with a direct junction table join:

```sql
create or replace function briefs_for_location(
  p_jurisdiction_id uuid,
  p_language text default 'en'
)
returns setof briefs
language sql stable as $$
  select b.*
  from briefs b
  join brief_jurisdictions bj on bj.brief_id = b.id
  join sources s on s.id = b.source_id
  where bj.jurisdiction_id = p_jurisdiction_id
    and b.language = p_language
    and s.status = 'active'
  order by b.created_at desc;
$$;
```

Because ancestors are pre-computed as rows at write time, this function no longer needs `jurisdiction_ancestors()` at query time. It is now a single indexed lookup.

### Boundary Loading Script: scripts/load-boundaries.ts

Not a migration. Run manually or in CI. Loads US Census TIGER/Line data into existing `jurisdictions.boundary` and `jurisdictions.centroid` columns.

**Data sources:**
- States: Census TIGER/Line shapefiles, 56 features (50 states + DC + territories).
- Counties: TIGER/Line, 3,244 features.
- Places/cities: TIGER/Line, 31,000+ features.

**Loading approach:**
- Download shapefiles, convert to GeoJSON.
- Match to existing `jurisdictions` rows via FIPS code or OCD-ID.
- Update `boundary = ST_GeomFromGeoJSON(...)`, `centroid = ST_Centroid(boundary)`, and `boundary_simplified = ST_SimplifyPreserveTopology(boundary, 0.01)`.
- Use Supabase client with service role key.

**International (deferred to C20):**
- Source: geoBoundaries v6 (CC BY 4.0, MIT-compatible for our open-source license).
- Do NOT use GADM -- its license prohibits commercial use.
- Same loading pattern, different data source.

---

## 5. Pipeline Changes

### Domain-to-Jurisdiction Lookup

Build a lookup table (in-memory map or lightweight DB table) mapping URL domains to known jurisdiction IDs. Examples:

```
seattle.gov          ->  jurisdictions.id for City of Seattle
kingcounty.gov       ->  jurisdictions.id for King County
wa.gov               ->  jurisdictions.id for Washington State
congress.gov         ->  jurisdictions.id for US Federal
```

**Logic:**
1. Extract domain from `sourceUrl` (strip `www.`, normalize to lowercase).
2. Look up in the domain map.
3. If found: use as the inferred jurisdiction, `assigned_by = 'ai'`.
4. If not found: leave `jurisdiction_id` null until user selects from the upload form dropdown.

### Upload Form: Manual Override

The upload form (`UploadForm.tsx`) gets a jurisdiction field:
- If domain lookup succeeds: pre-populate with the inferred jurisdiction name. User can accept or change.
- If domain lookup fails: show a search/autocomplete dropdown backed by `/api/location`.
- The selected `jurisdiction_id` is included in the `POST /api/summarize` body.

### tagBriefJurisdictions() helper

New shared function in `src/lib/pipeline.ts`:

```typescript
async function tagBriefJurisdictions(
  briefId: string,
  jurisdictionId: string,
  assignedBy: 'ai' | 'manual' | 'feed'
): Promise<void>
```

1. INSERT direct row: `(brief_id, jurisdiction_id, relationship='direct', assigned_by, confidence=1.0)`.
2. Call `jurisdiction_ancestors(jurisdictionId)` to get all parent IDs.
3. INSERT one row per ancestor: `(brief_id, ancestor_id, relationship='ancestor', assigned_by='ai', confidence=1.0)`.
4. All inserts use `ON CONFLICT DO NOTHING` -- safe for concurrent uploads.

### Feed Ingestion Integration (C7)

In the feed worker (`/api/internal/ingest-feed`), after `processCivicDocument()` creates the brief, call:

```typescript
await tagBriefJurisdictions(brief.id, feed.jurisdiction_id, 'feed');
```

No other changes to the C7 feed worker.

---

## 6. New API Endpoint: GET /api/location

### Request

```
GET /api/location?q=Seattle&limit=10
```

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | yes | Search query (city, county, state name) |
| `limit` | number | no | Max results to return (default 10, max 25) |

### Response

```typescript
// 200 OK
{
  results: LocationSearchResult[];
}

// 400 Bad Request
{ error: 'Query parameter "q" is required' }

// 500 Internal Server Error
{ error: 'Search failed. Please try again.' }
```

### Query logic

```sql
select
  j.*,
  similarity(j.name, $1) as sim,
  count(bj.brief_id) as brief_count,
  -- Build hierarchy array via jurisdiction_ancestors()
  ...
from jurisdictions j
left join brief_jurisdictions bj on bj.jurisdiction_id = j.id
where j.name % $1  -- pg_trgm GIN index
order by sim desc, j.population desc nulls last
limit $2;
```

### Edge case behavior

| Scenario | Behavior |
|----------|----------|
| Ambiguous match ("Springfield") | Return disambiguation list ranked by `similarity() DESC, population DESC`. Display full hierarchy (e.g., "Springfield, Sangamon County, Illinois"). |
| No match | Return empty `results: []`. Client shows "No jurisdictions found" with a "Did you mean...?" note. |
| Partial match ("King") | `similarity()` + prefix behavior covers this. Return all matches with hierarchy. No special handling. |
| Single clear match ("Sammamish") | Return a list of one. Client may choose to auto-select; that logic lives in the client, not the API. |

### Deployment config

- Runtime: Node.js (default, no special config).
- No `maxDuration` override needed (simple indexed DB query, sub-100ms expected).
- No new env vars.

---

## 7. New Page: /location

This is the front door to location-aware civic intelligence. Not a utility search box. It should feel as confident and purposeful as the homepage and showcase pages.

### Route

`src/app/location/page.tsx` -- client component for interactive search.

### Design System Alignment

- Fonts: Fraunces (headings), Outfit (body) -- same as all pages
- Colors: `var(--ink)`, `var(--paper)`, `var(--warm)`, `var(--accent)`, `var(--civic)`, `var(--muted)`, `var(--border)`, `var(--green)` -- existing palette only
- Spacing: `container-narrow` (720px max-width) for the search hero, `container` (1280px) if results need more room
- Animations: reuse existing `fadeUp` keyframe, stagger 50ms per card, respect `prefers-reduced-motion`
- Mobile: full-width search, stacked cards, sticky level group headers

### Component States

**1. Default (landing state)**
- Full-width hero section, centered
- Fraunces heading: "What's happening in your community?"
- Outfit subtext: "Search by city, county, or state to find civic briefs from every level of government that affects you."
- Large search input: 48px height, 16px font, `var(--border)` border, `var(--accent)` focus ring (2px), white background, 12px border-radius. Placeholder: "Seattle, King County, Washington..."
- Below search: three "quick pick" jurisdiction pills for our most-populated seeded jurisdictions as discovery shortcuts. Rounded pill buttons with `var(--warm)` bg, `var(--border)` border, hover to `var(--civic-light)` with `var(--civic)` text.
- Below that: muted stat line: "Covering X jurisdictions across Y states"

**2. Searching (typing state, debounced 300ms)**
- Results appear in a dropdown below the input (max 8 rows)
- Each row: jurisdiction name, level badge, hierarchy breadcrumb in muted text, brief count
- Level badges are pill-shaped, colored by level:
  - Federal: `var(--ink)` bg, white text
  - State: `var(--civic)` bg, white text
  - County: `var(--accent)` bg, white text
  - City: `var(--green)` bg, white text
- Results ranked by `similarity()` weighted by population
- Fuzzy near-miss: "Did you mean...?" row if no exact match but fuzzy matches exist
- No results: "No jurisdictions found. Try a different name." in the dropdown

**3. Results (jurisdiction selected)**
- Search box stays at top (collapsed, showing selected jurisdiction name with an X button to clear and return to default)
- Hierarchy breadcrumb bar below search: `United States > Washington > King County > Seattle` -- `>` separator, muted text, each ancestor clickable to switch scope, active item in `var(--ink)` bold
- Briefs grouped by jurisdiction level, each group with a collapsible header:
  - Federal (collapsed by default, applies everywhere)
  - State: Washington
  - County: King County
  - City: Seattle (expanded by default, most specific)
- Each brief card: white bg, 1px `var(--border)`, 12px radius, hover lift (same as showcase `.scenario-card-link` pattern). Contains: document type icon badge (from #44), headline in Fraunces 16px weight 700, one-line summary in Outfit 14px, confidence dot, date.
- Empty groups do not render at all (no "0 briefs" placeholders)
- Brief cards stagger with `fadeUp` animation, 50ms delay per card

**4. Empty (jurisdiction exists, zero briefs from any level)**
- Selected jurisdiction shown with hierarchy breadcrumb
- Centered empty state with civic-themed CSS illustration (no images)
- "No civic briefs for [Jurisdiction Name] yet."
- "Be the first to contribute." with prominent accent-colored link to `/upload`
- If ancestor jurisdictions have briefs, show a "Briefs from parent jurisdictions" section below

**5. Error**
- Inline error banner below search: `#fee2e2` background, `#dc2626` text, clear message
- Search box stays interactive, user can retry immediately

### Accessibility

- Search input has a visible `<label>` (visually styled as the heading acts as context, but the label is present for screen readers)
- Jurisdiction dropdown results: `<ul>` with `role="listbox"`, each result is `role="option"`, keyboard navigable with ArrowUp/ArrowDown, Enter to select
- Briefs list: `<section>` per jurisdiction group with an `<h2>` heading
- Level badges have `aria-label` (e.g., "City" not just color)
- axe-core scan required in E2E tests (WCAG 2.1 AA, same as all other pages)

---

## 8. TypeScript Types

Add to `src/lib/types.ts`:

```typescript
export interface BriefJurisdiction {
  id: string;
  brief_id: string;
  jurisdiction_id: string;
  relationship: 'direct' | 'ancestor' | 'mentioned' | 'community';
  confidence: number;
  assigned_by: 'ai' | 'manual' | 'feed' | 'community';
  created_at: string;
}

export interface LocationSearchResult {
  jurisdiction: Jurisdiction;
  hierarchy: { name: string; level_name: string; depth: number }[];
  brief_count: number;
  similarity: number;
}

export interface LocationSearchRequest {
  q: string;
  limit?: number;
}
```

Update the existing `Jurisdiction` interface to document the PostGIS fields (they exist in the DB already; this just makes them visible in TypeScript):

```typescript
export interface Jurisdiction {
  // ... existing fields ...
  centroid?: unknown;  // PostGIS Point -- not materialized in TS until C23
  boundary?: unknown;  // PostGIS MultiPolygon -- same
}
```

---

## 9. Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/009_brief_jurisdictions.sql` | New table + indexes + updated `briefs_for_location()` |
| `scripts/load-boundaries.ts` | New script: loads Census TIGER/Line boundaries into `jurisdictions` |
| `src/lib/types.ts` | Add `BriefJurisdiction`, `LocationSearchResult`, `LocationSearchRequest`; update `Jurisdiction` |
| `src/lib/pipeline.ts` | Add `tagBriefJurisdictions()` helper; call it in `processCivicDocument()` |
| `src/lib/domain-lookup.ts` | New: domain-to-jurisdiction map + lookup function |
| `src/app/api/summarize/route.ts` | Accept `jurisdiction_id` in request body; call `tagBriefJurisdictions()` after save |
| `src/app/api/location/route.ts` | New: GET endpoint for jurisdiction fuzzy search |
| `src/app/api/internal/ingest-feed/route.ts` | Call `tagBriefJurisdictions()` after brief creation |
| `src/app/location/page.tsx` | New page: search + results + briefs list |
| `src/components/UploadForm.tsx` | Add jurisdiction field (auto-suggest + manual override) |
| `src/components/JurisdictionSearch.tsx` | New: autocomplete component backed by `/api/location` |
| `tests/unit/pipeline.test.ts` | Tests for `tagBriefJurisdictions()` including ancestor expansion and conflict handling |
| `tests/unit/domain-lookup.test.ts` | Tests for domain extraction and jurisdiction mapping |
| `src/app/layout.tsx` | Add "Location" nav link between "Upload" and "Demo Brief" |
| `tests/e2e/pages.spec.ts` | Add /location to page coverage: default, results, empty, error + axe scan |

**Render tree audit:** `/location` renders `JurisdictionSearch` (search input + dropdown), a briefs list, and `ConfidenceScore` + `SourceLink` within each brief card. All of these are in scope. `LanguageToggle` is NOT rendered on `/location` (location search is language-neutral; briefs display in their stored language with language badges).

---

## 10. Concurrent Request Scenarios

**Two users uploading the same document simultaneously:**
- `sources` deduplicates by `content_hash`. Both uploads may create a brief, but `brief_jurisdictions` unique constraint on `(brief_id, jurisdiction_id)` ensures no duplicate tags per brief. `ON CONFLICT DO NOTHING` is safe.

**Two users tagging the same brief to the same jurisdiction (community tagging, future):**
- Same unique constraint. Second insert is a silent no-op. No error surfaced to the user.

**Feed ingestion and manual upload of the same document:**
- `sources.content_hash` deduplication kicks in first. If the source already exists, the pipeline returns the existing brief rather than creating a new one. `tagBriefJurisdictions()` is idempotent via `ON CONFLICT DO NOTHING`.

---

## 11. Scalability Forward Compatibility

This design was reviewed against the roadmap. Here is how it supports future milestones without schema changes:

| Future Issue | How this design supports it |
|-------------|---------------------------|
| C9: Location subscriptions | `user_jurisdictions JOIN brief_jurisdictions ON jurisdiction_id` -- both indexes exist |
| C12: Notifications | New brief -> fan out via `brief_jurisdictions.jurisdiction_id` -> `user_jurisdictions` -> notify. No extra joins. |
| C15: Property tax calculator | `jurisdictions_at_point()` -> `brief_jurisdictions` -> filter `document_type='budget'` |
| C16: District-wide feed | Query all child jurisdictions via parent; all covered by `idx_brief_jurisdictions_jurisdiction` |
| C19: Multi-jurisdiction dashboard | Heavy reads on `brief_jurisdictions` -- both indexes cover this |
| C20: International expansion | Same schema; `scripts/load-boundaries.ts` gets a new data source (geoBoundaries v6) |
| C23: Map visualization | `boundary_simplified` column and data already exist; just add the map UI |
| C26: Version history | Copy `brief_jurisdictions` rows when creating a new brief version |
| C28: Trending | `COUNT(*)` recent rows per `jurisdiction_id` -- covered by `idx_brief_jurisdictions_jurisdiction` |

---

## 12. NOT in Scope

- Interactive map UI (C23)
- Address-level geocoding (jurisdiction-level search is sufficient for brief discovery)
- International boundary loading (C20)
- Interactive map rendering of boundary polygons (C23; the data and simplified column will exist)
- Real-time notifications when new briefs match a jurisdiction (C12)
- Property tax calculations (C15)
- `mentioned` relationship type tagging via NER (reserved for future; column exists)
- `community` relationship type via UI (community feedback system is separate; column exists)
- Document version inheritance of jurisdiction tags (C26)

---

## 13. Env Var Lifecycle

No new environment variables required. Uses existing:

| Var | Used by |
|-----|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/load-boundaries.ts`, all API routes that write |
| `NEXT_PUBLIC_SUPABASE_URL` | `/api/location` (read query) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side jurisdiction search |

The boundary loading script reads `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` from `.env.local` or environment. No Vercel dashboard changes needed.
