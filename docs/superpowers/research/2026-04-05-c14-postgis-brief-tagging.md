# C14 PostGIS Brief Tagging: Research Report

**Date:** 2026-04-05
**Status:** Research complete, ready for spec writing

---

## Current State — What Already Exists

### Schema (migration 001)
- `jurisdictions.centroid` — `geometry(Point, 4326)` with GiST index
- `jurisdictions.boundary` — `geometry(MultiPolygon, 4326)` with GiST index
- Self-referencing tree via `parent_id` (city -> county -> state -> federal)
- Standard IDs: `ocd_id`, `fips_code`, `iso_3166_2`
- Trigram index on `name` for fuzzy search

### Three PostGIS DB functions (migration 001)
- `jurisdictions_at_point(lng, lat)` — finds all jurisdictions covering a point, ordered by depth
- `jurisdiction_ancestors(jurisdiction_uuid)` — recursive CTE walking up the parent chain
- `briefs_for_location(jurisdiction_uuid, lang_bcp47, result_limit)` — returns published briefs from a jurisdiction and its ancestors

### Linkage path
`briefs -> sources -> jurisdictions` (sources.jurisdiction_id NOT NULL)

### Feed ingestion
Already correctly tags briefs with the feed's `jurisdiction_id`.

### Manual uploads
Default to Seattle (`00000000-0000-0000-0000-000000000004`). No jurisdiction selector in UploadForm.

---

## Gap Analysis — What's Missing

1. **No PostGIS geometry data populated.** All 14 seeded jurisdictions have NULL centroid and boundary. `jurisdictions_at_point` is a dead letter.

2. **No automatic jurisdiction detection for manual uploads.** No NLP extraction, no geocoding step.

3. **No API endpoint for location-based discovery.** DB functions exist but no Next.js route exposes them.

4. **No user location input.** No address input, no browser geolocation.

5. **Brief page doesn't display jurisdiction.** The query doesn't join jurisdiction data.

---

## Geocoding Approaches

### Option A: Census TIGER/Line shapefiles (recommended foundation)
- Free boundary data for all US states, counties, cities
- One-time load, no API dependency
- Start with just seeded jurisdictions (WA, PA, GA, NY, CA)

### Option B: Census Geocoder API (user address -> lat/lng)
- `geocoding.geo.census.gov` — free, no API key, returns FIPS codes + lat/lng
- Use for converting user address input to coordinates
- Returns FIPS codes directly (we already store these)

### Option C: NLP extraction from document text
- Add `jurisdiction_name` and `jurisdiction_level` to CivicContent output
- Fuzzy-match against jurisdictions table using trigram index
- Works for manual uploads with no user input

### Option D: Domain-based inference
- Parse source URL domain -> match against known government domains
- E.g., `seattle.gov` -> Seattle, `kingcounty.gov` -> King County

**Recommendation:** A (load boundaries) + C (NLP extraction) + B (user address discovery)

---

## Query Patterns

### "Show me all briefs affecting my location"
```sql
-- Step 1: Find jurisdictions at user's point
SELECT * FROM jurisdictions_at_point(-122.3321, 47.6062);
-- Returns: Seattle, King County, Washington, US (by depth desc)

-- Step 2: Get briefs from most specific jurisdiction + ancestors
SELECT * FROM briefs_for_location(seattle_id, 'en', 50);
-- Returns briefs from Seattle + King County + WA + US Federal
```

Both functions already exist. Only requirement: populate boundary data.

### Fallback: proximity-based (when boundaries not loaded)
```sql
SELECT j.id, j.name,
  ST_Distance(j.centroid::geography, ST_MakePoint(lng, lat)::geography) as distance_m
FROM jurisdictions j
WHERE j.centroid IS NOT NULL
ORDER BY j.centroid <-> ST_MakePoint(lng, lat)
LIMIT 5;
```

---

## Performance

**No additional indexes needed.** Existing GiST indexes handle spatial queries efficiently.
- Tree is shallow (max 4 levels in US). Recursive CTE hits at most 4 rows.
- ST_Covers with GiST index is O(log n), sub-millisecond even with 30K places.
- Consider ST_Simplify for complex boundary polygons (e.g., NYC coastline).

---

## Seeded Jurisdictions (14 total, all NULL geometry)

From demo-jurisdictions.sql: US Federal, WA State, King County, Seattle, Sammamish, Issaquah
From migration 008: PA, GA, NY, CA, Philadelphia, Atlanta, NYC

---

## Implementation Roadmap (3 layers)

### Layer 1 — Data Foundation (migration + seed)
- Populate centroid + boundary for 14 existing jurisdictions
- Source: Census TIGER/Line shapefiles for WA, PA, GA, NY, CA
- Simplify with ST_Simplify for manageable data size

### Layer 2 — Automatic Jurisdiction Tagging
- Add jurisdiction_name/level to CivicContent prompt output
- Pipeline: fuzzy-match extracted name against jurisdictions table (trigram index)
- Fall back to existing default if no match

### Layer 3 — Location-Aware Discovery UI
- New route: `GET /api/briefs/location?lat=X&lng=Y&lang=en`
- Address input component + Census Geocoder
- Optional browser geolocation
- Brief page: display jurisdiction name/level
