# C7: Feed Ingestion -- Pre-Spec Research

## Open Product Questions (need your input)

1. **Feed config storage**: Database table (editable without deploy) or JSON in code (simpler)? Recommendation: DB table, since adding feeds shouldn't require a deploy.

2. **RSS-only or link scraping too?** Most cities don't have RSS. Seattle/King County use Legistar which has a REST API with direct PDF URLs. Do we support Legistar API as a "feed type" alongside RSS? Recommendation: yes, Legistar covers ~40% of mid-large US cities.

3. **Demo daily limit**: Current `DEMO_DAILY_LIMIT` of 10 docs would be exceeded by automated ingestion. Separate ingestion budget, or bypass limit for server-originated requests?

4. **Non-PDF documents**: Skip silently, log, or attempt conversion?

5. **Feed count for v1.1**: 3-5 feeds (Seattle area only) or 10-25 (multiple cities)?

6. **Error surfacing**: Supabase table only, or also admin notifications?

7. **Vercel plan**: Hobby (2 crons, daily minimum) or Pro (40 crons, per-minute)? This determines polling frequency.

---

## Architecture Recommendation: Fan-Out Pattern

```
Vercel Cron (hourly)
  -> GET /api/cron/ingest (orchestrator)
      -> reads `feeds` table (active feeds only)
      -> fires N parallel fetch() to POST /api/ingest/feed?id=X
      -> each worker: fetch feed, find new items, download PDFs, run pipeline
      -> orchestrator collects results, writes to feed_poll_runs
```

Why not sequential: 20 docs * 30s each = 600s, exceeds 300s limit.
Why not Vercel Queues: overkill at 10-50 feeds, adds cost + complexity.

---

## Data Sources (priority order for demo jurisdictions)

| Priority | Source | Method | Documents |
|---|---|---|---|
| 1 | Seattle Legistar | REST API `/matters` + `/attachments` | Council bills, ordinances, resolutions |
| 2 | King County Legistar | REST API (same pattern) | County legislation |
| 3 | WA State Legislature | OpenStates API (`/bills?jurisdiction=wa`) | State bills with PDF links |
| 4 | Seattle.gov CMS | RSS (`seattle.gov/news/rss.aspx`) | Budget docs, public notices |
| 5 | WA Governor | RSS (`governor.wa.gov/news-media/news/rss`) | Executive orders |

### Legistar REST API (no auth required)
```
https://webapi.legistar.com/v1/seattle/matters?$top=50&$orderby=MatterLastModifiedUtc desc
https://webapi.legistar.com/v1/seattle/matters/{id}/attachments
```
Returns JSON with direct PDF URLs in `MatterAttachmentHyperlink`. Supports OData `$filter` by date. Same pattern for `kingcounty` slug.

### OpenStates API (free tier: 1K req/day)
```
GET https://v3.openstates.org/bills?jurisdiction=wa&updated_since=2025-01-01&include=texts
```
Requires API key (free registration). Bill texts include direct PDF URLs.

### RSS Parsing
npm: `rss-parser` (~500K weekly downloads, handles RSS 2.0 + Atom).

---

## Deduplication Strategy (3 layers)

1. **Item GUID/URL check** (cheapest): skip if `source_url` already in `sources` table
2. **HTTP conditional requests**: store ETag + Last-Modified per feed, send If-None-Match/If-Modified-Since, 304 = skip entire feed
3. **Content hash** (existing): SHA-256 in `sources.content_hash` catches same content from different URLs

---

## New Schema (migration 005)

```sql
CREATE TABLE feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  document_type_id smallint REFERENCES document_types(id),
  feed_url text NOT NULL UNIQUE,
  feed_type text NOT NULL DEFAULT 'rss' CHECK (feed_type IN ('rss', 'atom', 'json_api', 'legistar')),
  is_active boolean NOT NULL DEFAULT true,
  last_polled_at timestamptz,
  last_successful_poll_at timestamptz,
  last_seen_item_guid text,
  etag text,
  last_modified text,
  consecutive_failures smallint NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE feed_poll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  feeds_polled smallint DEFAULT 0,
  feeds_skipped smallint DEFAULT 0,
  feeds_failed smallint DEFAULT 0,
  new_documents smallint DEFAULT 0,
  new_briefs smallint DEFAULT 0,
  error_summary jsonb DEFAULT '[]',
  duration_ms integer
);
```

---

## New Routes

- `src/app/api/cron/ingest/route.ts` -- orchestrator (GET, CRON_SECRET auth)
- `src/app/api/ingest/feed/route.ts` -- per-feed worker (POST, internal auth)
- `src/lib/pipeline.ts` -- extract shared pipeline logic from summarize route

---

## Existing Code to Reuse

- `src/app/api/summarize/route.ts` -- full pipeline (extract, summarize, verify, translate, save)
- `src/lib/pdf-extract.ts` -- `extractTextFromPDF`, `hashText`
- `src/lib/security.ts` -- `validateUrl`, PDF magic byte checks
- `sources` table -- `status` field already supports `pending/processing/processed/failed`
- `jurisdiction_languages` -- auto-translate to all configured languages per jurisdiction

---

## Dependencies

- C7 has NO hard dependencies (standalone)
- C7 IS a dependency for: C9 (subscriptions), C12 (notifications), C16 (school board feeds)
- Soft synergy with C14 (PostGIS tagging): feeds know their jurisdiction_id

---

## v1.1 Scope (in)
- RSS/Atom + Legistar API feed polling via Vercel Cron
- Per-jurisdiction feed config in DB
- PDF detection + download + pipeline trigger
- Dedup via GUID + content hash
- Feed health tracking (consecutive_failures, last_polled_at)
- 5-10 seed feeds for WA/King County/Seattle
- feed_poll_runs table for monitoring

## Out of Scope (deferred)
- Web scraping / HTML parsing
- Webhook-based push ingestion
- Admin UI for feed management
- Per-source format adapters beyond RSS + Legistar
- Real-time monitoring
