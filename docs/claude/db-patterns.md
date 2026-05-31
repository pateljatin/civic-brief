# Database Patterns

## Schema Overview

Global jurisdiction model. Migrations 001-011 applied.

**Core tables:**
- **jurisdictions** -- THE CORE TABLE. Self-referencing tree with PostGIS spatial columns, FIPS/OCD-ID/ISO 3166-2, temporal validity
- **sources** -- Processed government documents. URL + metadata + content_hash. NEVER stores document text.
- **briefs** -- THE PRODUCT. One per source per language. Structured JSONB, full-text search, versioning
- **brief_topics** -- Junction: brief <-> topic with AI confidence scores
- **brief_jurisdictions** -- Junction: brief <-> jurisdiction (C14, migration 009)
- **community_feedback** -- factual_error, missing_info, misleading, translation_error, outdated
- **feeds / feed_poll_runs / feed_poll_run_items** -- C7 feed ingestion (migration 005)
- **rate_limits** -- Persistent rate limiting (migration 010)

**Key functions:**
- `search_briefs(query, language, jurisdiction, doc_type, topic)` -- full-text search with relevance ranking
- `jurisdictions_at_point(lng, lat)` -- PostGIS: which jurisdictions govern this location?
- `jurisdiction_ancestors(id)` -- walk up the tree (city -> county -> state -> federal)
- `briefs_for_location(jurisdiction_id, language)` -- all briefs from jurisdiction and ancestors

## Supabase Patterns (include in every spec touching DB)

- `.insert()` / `.update()` return `PromiseLike`, not `Promise`. Wrap in `Promise.resolve()` or fire-and-forget.
- Use `.maybeSingle()` when a result may not exist. `.single()` throws on 0 or 2+ rows.
- Service role for all API route writes. RLS is defense-in-depth.
- URL storage requires normalization rules (case, trailing slash, www prefix).
- Supabase CLI linked to project `iuojgklqovybxpgolvhj`. Run migrations: `npx supabase db query --linked -f <file>`

## Design Decisions

1. We never store government documents. PDFs processed in memory, discarded immediately.
2. Self-referencing jurisdiction tree (not flat list) supports city -> county -> state -> federal queries.
3. Full-text search uses `tsvector` with `simple` config (language-agnostic).
4. Trigram indexes (pg_trgm) for fuzzy jurisdiction name matching.
