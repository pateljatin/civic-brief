# C7: Automatic Document Feed Ingestion -- Design Spec

**Issue:** #7
**Milestone:** v1.1 Trust Loop (target: July 15, 2026)
**Author:** Claude + Jatin Patel
**Date:** 2026-03-21
**Status:** Approved

---

## 1. Purpose

Automatically discover and process new government documents from configured data feeds. Replaces manual PDF upload as the primary document ingestion path. Produces civic briefs in all jurisdiction-configured languages without human intervention.

### Success Criteria

1. 5-8 feeds for WA demo jurisdictions polling daily on Vercel Hobby
2. New documents are deduplicated, extracted, summarized, verified, translated, and saved
3. Weekly email digest reports feed health, format gaps, and processing stats
4. All 12 security findings from architecture review are addressed
5. Zero manual intervention required for normal operation
6. Feed failures auto-disable at 5 consecutive failures with email alert at 3

---

## 2. Product Decisions

All product decisions were made during brainstorming (2026-03-21). See `docs/superpowers/specs/c7-feed-ingestion-research.md` for the pre-spec research that informed these.

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Feed config storage | DB table (`feeds`) | Adding feeds shouldn't require deploy |
| 2 | Feed types | Legistar + RSS/Atom, extensible | Legistar covers demo jurisdictions; RSS for global |
| 3 | Daily limits | Separate budgets: `DEMO_DAILY_LIMIT=1` (anonymous), `INGESTION_DAILY_LIMIT=50` (cron) | User uploads are high-intent; never starved by automation |
| 4 | Non-PDF documents | Skip + log with metadata | Data on format gaps drives future format support |
| 5 | Feed count | 5-8 seed feeds for WA | Covers federal-state-county-city depth |
| 6 | Error surfacing | DB + email alert (3+ failures) | Adequate for <20 feeds; roadmap item for Slack at scale |
| 7 | Vercel plan | Design for Pro, ship on Hobby | Daily cron initially; hourly when Pro activates |
| 8 | Signup conversion | 1 free anonymous upload, then signup wall | Growth funnel: taste, then convert |

### Additional Decisions

- **Election-aligned milestones:** v1.1 by July 15 (before Sep budget season), v1.2 by Oct 1 (before Nov 3 election)
- **Forward-compatible schema:** Migration 005 lays columns for gamification, jurisdiction following, engagement metrics
- **Weekly digest email:** Second cron job, fits Hobby's 2-cron limit
- **API route convention:** New routes follow resource-based naming; existing routes renamed in separate chore PR
- **Monitoring at scale:** Roadmap item to switch from email to Slack/Discord webhook at 20+ active users

---

## 3. Architecture

### Pattern: Fire-and-Forget Workers with DB Coordination

```
                          Vercel Cron (daily, upgradeable to hourly)
                                    |
                        GET /api/cron/ingest
                          (orchestrator, <10s)
                                    |
                    +---------------+---------------+
                    |               |               |
            POST /api/internal/ POST /api/internal/ POST /api/internal/
            ingest-feed         ingest-feed         ingest-feed
            ?id=A&run=R         ?id=B&run=R         ?id=C&run=R
            (fire-and-forget)   (fire-and-forget)   (fire-and-forget)
                    |               |               |
              +-----+-----+  +-----+-----+  +-----+-----+
              |  Fetcher   |  |  Fetcher   |  |  Fetcher   |
              | (RSS/Atom) |  | (Legistar) |  | (OpenStates|
              +-----+-----+  +-----+-----+  |  API)      |
                    |               |         +-----+-----+
                    |               |               |
              For each new PDF item:
              +----------------------------+
              | Existing pipeline:         |
              | extract -> summarize       |
              | -> verify -> translate     |
              | -> save to DB              |
              +----------------------------+
                    |               |               |
                    +-------+-------+---------------+
                            |
                  Write per-feed results to feed_poll_run_items
                  Last worker to finish: finalize_poll_run()
```

### Why This Pattern

- **Why not sequential (Approach A):** 5 feeds x 3 docs x 30s = 450s. Exceeds both Hobby (60s) and Pro (300s) timeouts.
- **Why not await fan-out (Approach B):** Orchestrator's timeout becomes the bottleneck. Worker hangs block result recording.
- **Why fire-and-forget (Approach C):** Orchestrator finishes in <10s. Each worker gets its own full timeout. DB is the coordination layer. Works on Hobby AND Pro with zero code changes.

### Authentication

| Endpoint | Auth method | Details |
|----------|-------------|---------|
| `/api/cron/ingest` | `CRON_SECRET` header | Vercel-injected, compared with timing-safe equality |
| `/api/cron/digest` | `CRON_SECRET` header | Same |
| `/api/internal/ingest-feed` | HMAC signature | `HMAC-SHA256(feed_id + run_id + timestamp, INGEST_HMAC_SECRET)` in `X-Ingest-Signature` header. Reject if timestamp >60s old. Timing-safe comparison. |

---

## 4. Data Flow

### Ingestion Flow (Happy Path)

```
1. Cron fires -> orchestrator checks for stale runs:
   - Mark any feed_poll_runs with status 'running' older than 30 minutes as 'failed'
   - If a 'running' run exists less than 30 minutes old, skip this cron invocation (overlap guard)
2. Reads feeds table (is_active = true)
3. Creates feed_poll_run row (status: 'running')
4. For each feed:
   a. Creates feed_poll_run_item row (status: 'pending')
   b. Generates HMAC signature (feed_id + run_id + timestamp)
   c. Fire-and-forget POST to /api/internal/ingest-feed
5. Returns 200 immediately

Worker (per feed):
5. Validate HMAC + timestamp (reject if >60s old)
6. Update feed_poll_run_item status -> 'processing'
7. Check HTTP conditional headers (ETag/Last-Modified from feeds table)
   - 304 Not Modified -> mark item 'completed' with 0 items, return
8. Fetch feed content:
   - RSS/Atom: parse XML (max 5MB payload, XXE disabled)
   - Legistar: JSON API call with $top + $orderby
   - OpenStates: REST call with updated_since filter
9. For each item in feed (up to max_items_per_poll):
   a. Dedup layer 1: check if source_url exists in sources with status != 'failed'.
      If URL exists but content_hash differs -> this is a document update (new version).
      Set previousBriefId for version linking (same behavior as upload route).
      If URL exists and content_hash matches -> exact duplicate, skip.
   b. Validate item URL through ssrf.ts:
      - DNS resolve before fetch
      - Reject private IPs (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12,
        192.168.0.0/16, 169.254.0.0/16, ::1, fc00::/7, fe80::/10)
      - HTTPS only, no auth components, standard ports only
   c. Check expected_domain: flag if item URL domain differs from feed's pinned domain
   d. HEAD request:
      - Content-Type must be application/pdf -> if not, log to skipped_formats, continue
      - Content-Length must be <10MB -> if missing, enforce via streaming byte counter
   e. Download PDF (streaming with 10MB abort)
   f. Dedup layer 2: content hash (SHA-256) against sources.content_hash -> skip if exists
   g. Check daily ingestion budget (INGESTION_DAILY_LIMIT) -> stop all processing if exceeded
   h. Run pipeline: extract -> summarize -> verify -> translate
      Translation targets: query jurisdiction_languages for the feed's jurisdiction_id.
      Generate primary brief via summarization; additional languages via translation.
      If no languages configured for jurisdiction, default to English (bcp47 = 'en').
   i. Save source (with ingested_by_feed_id) + briefs to DB
   j. Null out PDF buffer and extracted text (memory cleanup)
10. Update feed metadata: last_polled_at, last_seen_item_guid, etag, last_modified
11. On success: reset consecutive_failures to 0
12. Write results to feed_poll_run_item (items_found, items_processed, items_skipped, skipped_formats)
13. Call finalize_poll_run(run_id) -> if all items done, set run status
```

### Weekly Digest Flow

```
1. Cron fires -> GET /api/cron/digest
2. Query feed_poll_runs from past 7 days, join feed_poll_run_items
3. Aggregate: total processed, total skipped (by format), errors, per-feed health
4. Build email: stats table, format gap insight, feed health status
5. Send via Resend to ADMIN_EMAIL
```

### Error Flow

```
Worker error handling:
- Feed fetch fails -> increment consecutive_failures on feed
- If consecutive_failures >= 3 -> send email alert via Resend
- If consecutive_failures >= 5 -> set is_active = false (auto-disable)
- Individual item errors -> log in feed_poll_run_item.errors, continue to next item
- SSRF blocked -> log as security event, skip item
- Budget exceeded -> stop processing, mark remaining as deferred
- All errors recorded in feed_poll_run_items for weekly digest aggregation
```

### Pipeline Extraction (Refactor)

Extract shared logic from `src/app/api/summarize/route.ts` into:

```typescript
// src/lib/pipeline.ts
export async function processCivicDocument(params: {
  pdfBuffer: ArrayBuffer;
  sourceUrl: string;
  jurisdictionId: string;
  documentTypeSlug?: string;
  ingestedByFeedId?: string;
  userId?: string;
}): Promise<PipelineResult>
```

Both the upload route (`/api/briefs/create`, post-rename) and feed workers (`/api/internal/ingest-feed`) call this same function. The upload route adds form validation + rate limiting + signup conversion. The worker adds SSRF validation + dedup + budget checking.

---

## 4b. UI Impact

C7 is entirely server-side. No components are added or modified. Render tree audit: N/A. Five states per component: N/A.

---

## 5. Security

All 12 findings from the architecture security review are addressed.

### Critical

| # | Finding | Mitigation | Implementation |
|---|---------|------------|----------------|
| 1 | SSRF via feed item URLs | DNS-resolve-then-validate, reject private IPs, HTTPS only | `src/lib/ssrf.ts`: `validateFetchTarget(url)` does DNS resolution + IP range check before every `fetch()`. Rejects private ranges, auth components, non-standard ports. |
| 2 | Denial of wallet (Claude API) | Per-feed item cap + daily budget | `feeds.max_items_per_poll` (default 10) + `INGESTION_DAILY_LIMIT` env var (default 50). Worker checks budget before each Claude call. |

### High

| # | Finding | Mitigation | Implementation |
|---|---------|------------|----------------|
| 3 | Worker endpoint externally callable | HMAC signing + timestamp + timing-safe comparison | `HMAC-SHA256(feed_id + run_id + timestamp, INGEST_HMAC_SECRET)` in `X-Ingest-Signature` header. Reject if >60s old. `crypto.timingSafeEqual` for comparison. Rate limit: 50 req/min. |
| 4 | Unbounded PDF download | HEAD pre-check + streaming byte counter | HEAD request checks Content-Type (application/pdf) and Content-Length (<10MB). Download streams with byte counter, aborts at 10MB. |
| 5 | XML parsing attacks (XXE, bombs) | Parser config + size limit | Verify `rss-parser` (xml2js) disables external entities. Enforce 5MB max XML payload before parsing. Test with XXE and billion-laughs payloads. |

### Medium

| # | Finding | Mitigation | Implementation |
|---|---------|------------|----------------|
| 6 | Concurrent JSONB corruption | Separate rows per feed per run | `feed_poll_run_items` table: each worker writes its own row. No concurrent writes to shared JSONB. |
| 7 | Feed poisoning / failure handling | Auto-disable + domain pinning | `consecutive_failures >= 5` sets `is_active = false`. `expected_domain` on feeds: flag items with mismatched URL domains. |
| 8 | API key exposure in logs | Redaction policy | Never log secret values. Error paths use `"[REDACTED]"`. OpenStates key scoped to Production env. |
| 9 | In-memory privacy guarantee | Buffer cleanup + documentation | `pdfBuffer = null; extractedText = '';` after each item. Document limitation in privacy policy re: Anthropic's 30-day retention for abuse monitoring. |

### Low

| # | Finding | Mitigation | Implementation |
|---|---------|------------|----------------|
| 10 | Cron timing predictability | Random jitter | `setTimeout(Math.random() * 60_000)` before processing each feed. Randomizes per-feed start time within 60s window. |
| 11 | TLS certificate handling | Strict validation | Never set `NODE_TLS_REJECT_UNAUTHORIZED=0`. Bad cert = skip feed, log error. |
| 12 | ETag cache poisoning | Periodic full poll | Weekly full poll ignoring cached ETag/Last-Modified (flag on feed or scheduled). |

---

## 6. Schema (Migration 005)

File: `supabase/migrations/005_feed_ingestion_and_user_infra.sql`

### Part A: Feed Ingestion (C7)

```sql
-- 005: Feed Ingestion and User Infrastructure
-- Depends on: 001_initial.sql, 002_auth_and_usage.sql, 004_duplicate_handling.sql
-- Changes: feeds, feed_poll_runs, feed_poll_run_items tables; sources.ingested_by_feed_id;
--          user_jurisdictions; profiles gamification columns; briefs engagement columns;
--          RLS policies; active_feeds() and finalize_poll_run() helper functions
-- Setup required: INGEST_HMAC_SECRET, OPENSTATES_API_KEY, RESEND_API_KEY, ADMIN_EMAIL env vars

CREATE TABLE feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  document_type_id smallint REFERENCES document_types(id),
  name text NOT NULL,
  feed_url text NOT NULL UNIQUE,
  feed_type text NOT NULL DEFAULT 'rss'
    CHECK (feed_type IN ('rss', 'atom', 'json_api', 'legistar')),
  expected_domain text,
  is_active boolean NOT NULL DEFAULT true,
  last_polled_at timestamptz,
  last_successful_poll_at timestamptz,
  last_seen_item_guid text,
  etag text,
  last_modified text,
  consecutive_failures smallint NOT NULL DEFAULT 0,
  max_items_per_poll smallint NOT NULL DEFAULT 10,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX feeds_jurisdiction_id_idx ON feeds (jurisdiction_id);
CREATE INDEX feeds_is_active_idx ON feeds (is_active) WHERE is_active = true;

CREATE TABLE feed_poll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'partial', 'failed')),
  feeds_dispatched smallint DEFAULT 0,
  total_items_processed smallint DEFAULT 0,
  total_items_skipped smallint DEFAULT 0,
  total_errors smallint DEFAULT 0,
  total_new_briefs smallint DEFAULT 0,
  duration_ms integer,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX feed_poll_runs_started_at_idx ON feed_poll_runs (started_at DESC);

CREATE TABLE feed_poll_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES feed_poll_runs(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  items_found smallint DEFAULT 0,
  items_processed smallint DEFAULT 0,
  items_skipped smallint DEFAULT 0,
  items_deferred smallint DEFAULT 0,
  new_briefs_created smallint DEFAULT 0,
  skipped_formats jsonb DEFAULT '{}',              -- Frequency map: {"text/html": 3, "application/msword": 1}
  errors jsonb DEFAULT '[]',
  duration_ms integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE (run_id, feed_id)
);

CREATE INDEX feed_poll_run_items_run_id_idx ON feed_poll_run_items (run_id);

ALTER TABLE sources ADD COLUMN ingested_by_feed_id uuid
  REFERENCES feeds(id) ON DELETE SET NULL;
CREATE INDEX sources_ingested_by_feed_id_idx ON sources (ingested_by_feed_id);
```

### Part B: Forward-Compatible User Infrastructure

```sql
CREATE TABLE user_jurisdictions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  notify boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, jurisdiction_id)
);

CREATE INDEX user_jurisdictions_user_id_idx ON user_jurisdictions (user_id);

ALTER TABLE profiles ADD COLUMN contribution_score integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN badges jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN streak_current smallint NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN streak_longest smallint NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN last_active_at timestamptz;
ALTER TABLE profiles ADD COLUMN home_jurisdiction_id uuid
  REFERENCES jurisdictions(id);

ALTER TABLE briefs ADD COLUMN view_count integer NOT NULL DEFAULT 0;
ALTER TABLE briefs ADD COLUMN share_count integer NOT NULL DEFAULT 0;
```

### Part C: RLS Policies

```sql
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_poll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_poll_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_jurisdictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read feeds" ON feeds FOR SELECT USING (true);
CREATE POLICY "Public read feed_poll_runs" ON feed_poll_runs
  FOR SELECT USING (true);
CREATE POLICY "Public read feed_poll_run_items" ON feed_poll_run_items
  FOR SELECT USING (true);
CREATE POLICY "Users manage own jurisdictions" ON user_jurisdictions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Part D: Helper Functions

```sql
CREATE OR REPLACE FUNCTION active_feeds()
RETURNS TABLE (
  feed_id uuid, feed_url text, feed_type text,
  jurisdiction_id uuid, document_type_id smallint,
  expected_domain text, max_items_per_poll smallint,
  etag text, last_modified text, last_seen_item_guid text,
  metadata jsonb
)
LANGUAGE sql STABLE AS $$
  SELECT id, feed_url, feed_type, jurisdiction_id, document_type_id,
         expected_domain, max_items_per_poll, etag, last_modified,
         last_seen_item_guid, metadata
  FROM feeds WHERE is_active = true
  ORDER BY last_polled_at ASC NULLS FIRST;
$$;

CREATE OR REPLACE FUNCTION finalize_poll_run(run_uuid uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  pending_count integer;
  agg record;
BEGIN
  SELECT count(*) INTO pending_count
  FROM feed_poll_run_items
  WHERE run_id = run_uuid AND status IN ('pending', 'processing');

  IF pending_count > 0 THEN RETURN; END IF;

  SELECT
    coalesce(sum(items_processed), 0) AS total_processed,
    coalesce(sum(items_skipped), 0) AS total_skipped,
    coalesce(sum(new_briefs_created), 0) AS total_briefs,
    count(*) FILTER (WHERE status = 'failed') AS total_errors
  INTO agg
  FROM feed_poll_run_items WHERE run_id = run_uuid;

  UPDATE feed_poll_runs SET
    completed_at = now(),
    status = CASE WHEN agg.total_errors > 0 THEN 'partial' ELSE 'completed' END,
    total_items_processed = agg.total_processed,
    total_items_skipped = agg.total_skipped,
    total_new_briefs = agg.total_briefs,
    total_errors = agg.total_errors,
    duration_ms = (extract(epoch from (now() - started_at)) * 1000)::integer
  WHERE id = run_uuid AND status = 'running';  -- no-op if already finalized (race guard)
END;
$$;
```

### Seed Data: `supabase/seed/feeds.sql`

```sql
INSERT INTO feeds (jurisdiction_id, document_type_id, name, feed_url, feed_type, expected_domain) VALUES
  -- Seattle (city)
  ('00000000-0000-0000-0000-000000000004', 2,
   'Seattle City Council Legislation',
   'https://webapi.legistar.com/v1/seattle/matters',
   'legistar', 'webapi.legistar.com'),

  -- King County
  ('00000000-0000-0000-0000-000000000003', 2,
   'King County Council Legislation',
   'https://webapi.legistar.com/v1/kingcounty/matters',
   'legistar', 'webapi.legistar.com'),

  -- Washington State
  ('00000000-0000-0000-0000-000000000002', 2,
   'Washington State Bills',
   'https://v3.openstates.org/bills?jurisdiction=wa&include=texts',
   'json_api', 'v3.openstates.org'),

  -- Seattle RSS
  ('00000000-0000-0000-0000-000000000004', 9,
   'Seattle.gov News and Public Notices',
   'https://www.seattle.gov/news/rss.aspx',
   'rss', 'www.seattle.gov'),

  -- WA Governor
  ('00000000-0000-0000-0000-000000000002', 6,
   'WA Governor Executive Orders and News',
   'https://governor.wa.gov/news-media/news/rss',
   'rss', 'governor.wa.gov');
```

Note: Jurisdiction IDs reference the UUIDs from `supabase/seed/demo-jurisdictions.sql`. Document type IDs reference `supabase/seed/document-types.sql`. Verify exact IDs match before applying.

### Schema Notes

- **`feeds.document_type_id` is nullable.** When a feed has no document_type_id set, the pipeline uses AI-detected document type from the summarization output (existing behavior in `summarize/route.ts`). If AI also cannot determine the type, fall back to document_type_id = 1 ("other").
- **`feed_type = 'json_api'` is intentionally generic.** The fetcher factory selects the right parser based on the feed URL domain (e.g., `v3.openstates.org` routes to the OpenStates fetcher). If a non-OpenStates JSON API is added, the factory maps it by domain or by `feeds.metadata.fetcher` override.
- **`source_url` is not unique by design.** The same URL can have multiple source rows when content changes (document versioning, inherited from C8/migration 004). Dedup layer 1 checks URL + status; dedup layer 2 checks content hash.

---

## 6b. TypeScript Types

All types live in `src/lib/feeds/types.ts` except DB models which extend `src/lib/types.ts`.

```typescript
// --- DB Models (added to src/lib/types.ts) ---

export interface Feed {
  id: string;
  jurisdiction_id: string;
  document_type_id: number | null;
  name: string;
  feed_url: string;
  feed_type: FeedType;
  expected_domain: string | null;
  is_active: boolean;
  last_polled_at: string | null;
  last_successful_poll_at: string | null;
  last_seen_item_guid: string | null;
  etag: string | null;
  last_modified: string | null;
  consecutive_failures: number;
  max_items_per_poll: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type FeedType = 'rss' | 'atom' | 'json_api' | 'legistar';
export const FEED_TYPES: readonly FeedType[] = ['rss', 'atom', 'json_api', 'legistar'] as const;

export type PollRunStatus = 'running' | 'completed' | 'partial' | 'failed';
export const POLL_RUN_STATUSES: readonly PollRunStatus[] = ['running', 'completed', 'partial', 'failed'] as const;

export interface FeedPollRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: PollRunStatus;
  feeds_dispatched: number;
  total_items_processed: number;
  total_items_skipped: number;
  total_errors: number;
  total_new_briefs: number;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
}

export interface FeedPollRunItem {
  id: string;
  run_id: string;
  feed_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  items_found: number;
  items_processed: number;
  items_skipped: number;
  items_deferred: number;
  new_briefs_created: number;
  skipped_formats: Record<string, number>;  // e.g. {"text/html": 3, "application/msword": 1}
  errors: Array<{ message: string; item_url?: string; timestamp: string }>;
  duration_ms: number | null;
  created_at: string;
}

export interface UserJurisdiction {
  user_id: string;
  jurisdiction_id: string;
  is_primary: boolean;
  notify: boolean;
  created_at: string;
}

// --- Feed-specific types (src/lib/feeds/types.ts) ---

export interface FeedItem {
  guid: string;                    // Unique ID from feed (RSS guid, Legistar MatterId, etc.)
  title: string;
  url: string;                     // URL to the document or attachment
  published_at: string | null;
  content_type: string | null;     // MIME type if known from feed metadata
  metadata: Record<string, unknown>;  // Feed-specific extra fields
}

export interface FetchResult {
  feed_id: string;
  items: FeedItem[];
  etag: string | null;
  last_modified: string | null;
  was_modified: boolean;           // false if 304 Not Modified
}

export interface SkippedItem {
  url: string;
  reason: 'unsupported_format' | 'ssrf_blocked' | 'domain_mismatch'
        | 'too_large' | 'duplicate_url' | 'duplicate_hash' | 'budget_exceeded';
  format: string | null;           // MIME type if available
}

export interface PipelineResult {
  source_id: string;
  brief_ids: { language: string; brief_id: string }[];
  verification: { confidence_score: number; confidence_level: string };
  previous_version_id: string | null;
}

// --- API types ---

export interface IngestFeedRequest {
  feed_id: string;
  run_id: string;
  timestamp: number;
  signature: string;
}

export type IngestFeedResponse =
  | { type: 'success'; items_processed: number; new_briefs: number }
  | { type: 'skipped'; reason: 'not_modified' | 'budget_exceeded' | 'disabled' }
  | { type: 'error'; message: string };
```

---

## 6c. Deploy Environment

| Variable | Production | Preview | Local (.env.local) |
|----------|-----------|---------|---------------------|
| `CRON_SECRET` | Auto-injected by Vercel | Must set manually in project settings | Must set in .env.local |
| `INGEST_HMAC_SECRET` | Vercel env var | Same as production (shared) | Must set in .env.local |
| `OPENSTATES_API_KEY` | Vercel env var | Same as production | Must set in .env.local |
| `RESEND_API_KEY` | Vercel env var | Same as production | Must set in .env.local |
| `ADMIN_EMAIL` | Vercel env var | Same as production | Must set in .env.local |
| `DEMO_DAILY_LIMIT` | `1` | `100` (higher for testing) | `100` or omit (defaults to 10) |
| `INGESTION_DAILY_LIMIT` | `50` | `50` | `50` or omit |
| Cron jobs | **Active** (fires on schedule) | **Inactive** (crons only fire on production) | **N/A** (test via manual GET with CRON_SECRET header) |

**Testing cron locally:**
```bash
curl -H "x-vercel-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/ingest
```

**Testing cron on preview:**
```bash
curl -H "x-vercel-cron-secret: $CRON_SECRET" https://your-preview-url.vercel.app/api/cron/ingest
```

---

## 7. New Files

```
src/
  lib/
    ssrf.ts                              # SSRF protection: DNS resolve + IP validation
    pipeline.ts                          # Extracted pipeline: processCivicDocument()
    budget.ts                            # Daily ingestion budget tracking
    feeds/
      types.ts                           # Feed types: FeedItem, FetchResult, SkippedItem
      fetchers/
        index.ts                         # FeedFetcher interface + createFeedFetcher() factory
        rss.ts                           # RSS/Atom parser (rss-parser, 5MB limit)
        legistar.ts                      # Legistar REST API fetcher
        openstates.ts                    # OpenStates API fetcher
      dedup.ts                           # 3-layer dedup: GUID, conditional HTTP, content hash
  app/
    api/
      cron/
        ingest/route.ts                  # Orchestrator (GET, CRON_SECRET)
        digest/route.ts                  # Weekly digest (GET, CRON_SECRET)
      internal/
        ingest-feed/route.ts             # Per-feed worker (POST, HMAC)
  components/
    (none -- C7 has no UI)
supabase/
  migrations/
    005_feed_ingestion_and_user_infra.sql
  seed/
    feeds.sql                            # 5 seed feeds for WA demo
tests/
  helpers/
    factories.ts                         # createMockFeed(), createMockBrief(), etc.
    mocks.ts                             # mockLegistarResponse(), mockRssResponse()
    constants.ts                         # TEST_JURISDICTION_ID, TEST_FEED_URL
  unit/
    ssrf.test.ts                         # Private IP rejection, DNS resolution
    pipeline.test.ts                     # Pipeline with mocked Claude
    budget.test.ts                       # Budget enforcement
    feeds/
      fetchers.test.ts                   # RSS, Legistar, OpenStates parsing
      dedup.test.ts                      # 3-layer dedup logic
  integration/
    ingest-feed.test.ts                  # Worker route: HMAC auth, pipeline
    cron-ingest.test.ts                  # Orchestrator route: CRON_SECRET, dispatch
```

---

## 8. Error Handling

| Error | Where | Response | Alert |
|-------|-------|----------|-------|
| HMAC validation fails | Worker entry | 401, log attempt | None |
| Feed fetch timeout (>30s) | Fetcher | Skip feed, increment `consecutive_failures` | At 3+ |
| Feed returns non-200 | Fetcher | Skip feed, increment `consecutive_failures` | At 3+ |
| XML parse error | Fetcher | Skip feed, log error | At 3+ |
| SSRF: private IP resolved | Per-item | Skip item, log as `ssrf_blocked` | Immediate |
| Domain mismatch vs `expected_domain` | Per-item | Skip item, log warning | At 5+ per poll |
| PDF >10MB (HEAD or stream) | Per-item | Abort download, skip | None |
| Non-PDF Content-Type | Per-item | Skip, log to `skipped_formats` | Weekly digest |
| Content hash duplicate | Per-item | Skip silently | None |
| Claude API error | Pipeline | Retry once, then skip item | If budget exhausted |
| Daily budget exceeded | Worker | Stop all processing, defer remainder | Weekly digest |
| 3 consecutive feed failures | Post-processing | Feed stays active | Email alert |
| 5 consecutive feed failures | Post-processing | `is_active = false` | Email alert |
| All workers done, some failed | `finalize_poll_run()` | Status = `'partial'` | Weekly digest |

---

## 9. Testing Strategy

### Unit Tests (vitest)

```
ssrf.test.ts
  validateFetchTarget()
    - rejects 127.0.0.1
    - rejects 10.x.x.x, 172.16.x.x, 192.168.x.x
    - rejects 169.254.169.254 (cloud metadata)
    - rejects ::1, fc00::, fe80::
    - rejects URLs with auth components (user:pass@host)
    - rejects non-standard ports
    - rejects HTTP (non-HTTPS)
    - allows valid public HTTPS URLs
    - handles DNS resolution failure gracefully

pipeline.test.ts
  processCivicDocument()
    - returns PipelineResult with source + briefs on success
    - generates translations for all jurisdiction languages
    - handles Claude API timeout with retry
    - rejects text exceeding MAX_TEXT_LENGTH
    - nulls buffer references after processing

budget.test.ts
  checkIngestionBudget()
    - allows processing when under daily limit
    - rejects when daily limit reached
    - tracks separate budget from user uploads
    - resets at UTC midnight

feeds/fetchers.test.ts
  RssFetcher
    - parses valid RSS 2.0 feed
    - parses valid Atom feed
    - rejects XML exceeding 5MB
    - rejects XXE entity expansion payload
    - rejects XML bomb (billion laughs)
    - handles malformed XML gracefully
    - respects conditional HTTP (304 Not Modified)
  LegistarFetcher
    - maps Legistar matters to FeedItem[]
    - extracts PDF URLs from attachments endpoint
    - filters by date using $filter parameter
    - handles empty response
  OpenStatesFetcher
    - maps OpenStates bills to FeedItem[]
    - extracts PDF URLs from bill texts
    - passes API key in header
    - handles rate limit (429) response

feeds/dedup.test.ts
  checkDuplicate()
    - skips when source_url already exists
    - skips when content_hash already exists
    - allows new URL + new hash combination
    - normalizes URLs before comparison
```

### Integration Tests (vitest, route handlers)

```
ingest-feed.test.ts
  POST /api/internal/ingest-feed
    - returns 401 when HMAC missing
    - returns 401 when HMAC invalid
    - returns 401 when timestamp expired (>60s)
    - processes feed and creates briefs with valid HMAC
    - skips non-PDF items and logs to skipped_formats
    - stops at max_items_per_poll cap
    - increments consecutive_failures on feed error
    - auto-disables feed at 5 consecutive failures

cron-ingest.test.ts
  GET /api/cron/ingest
    - returns 401 without CRON_SECRET
    - creates feed_poll_run and dispatches workers
    - skips inactive feeds
    - creates feed_poll_run_items for each active feed
```

### Security Tests

All security-specific test cases are included in the unit tests above, tagged with clear names:
- XXE and XML bomb in `fetchers.test.ts`
- Private IP and SSRF in `ssrf.test.ts`
- HMAC validation in `ingest-feed.test.ts`

### No E2E Tests

C7 has no user-facing UI. All behavior is server-side, covered by unit and integration tests.

---

## 10. Configuration

### vercel.json additions

```json
{
  "crons": [
    {
      "path": "/api/cron/ingest",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/digest",
      "schedule": "0 9 * * 1"
    }
  ],
  "functions": {
    "src/app/api/internal/ingest-feed/route.ts": {
      "maxDuration": 300
    }
  }
}
```

- Ingestion: daily at 6 AM UTC (10 PM PST). Random jitter added in code (0-60s per feed).
- Digest: Monday 9 AM UTC (1 AM PST Monday, arrives in inbox Monday morning).
- Both fit Hobby's 2-cron limit.
- Upgrade path: change ingestion to `"0 */4 * * *"` (every 4 hours) on Pro.

### New Environment Variables

```bash
INGEST_HMAC_SECRET              # Min 32 bytes, openssl rand -hex 32
OPENSTATES_API_KEY              # Free registration at openstates.org
RESEND_API_KEY                  # Email sending for alerts + digest
ADMIN_EMAIL                     # Alert recipient
INGESTION_DAILY_LIMIT=50        # Auto-ingestion daily budget
```

### New Dependencies

```
rss-parser                      # RSS/Atom parsing (~500K weekly downloads)
resend                          # Email sending (alerts + weekly digest)
```

---

## 11. State Machine: Feed Poll Run

```
                    +----------+
                    | running  |  (orchestrator creates)
                    +----+-----+
                         |
              all workers report in
                         |
              +----------+-----------+
              |                      |
        all succeeded?          any failed?
              |                      |
        +-----+-----+         +-----+-----+
        | completed  |         |  partial   |
        +-----------+         +-----------+

        (if orchestrator itself fails before dispatch)
                         |
                   +-----+-----+
                   |   failed   |
                   +-----------+
```

### State Machine: Feed Health

```
                    +----------+
                    |  active   |  (is_active = true, consecutive_failures = 0)
                    +----+-----+
                         |
                    poll fails
                         |
                    +----+-----+
                    | degraded  |  (is_active = true, consecutive_failures 1-4)
                    +----+-----+
                         |
                    poll succeeds -> reset to active (consecutive_failures = 0)
                         |
                    failures >= 3 -> email alert
                         |
                    failures >= 5
                         |
                    +----+-----+
                    | disabled  |  (is_active = false)
                    +----+-----+
                         |
                    manual re-enable only
```

---

## 12. NOT in Scope

Explicitly excluded to prevent scope drift:

1. **Admin UI for feed management** (add/edit/disable feeds via web)
2. **HTML-to-text extraction** (logged as format gap, future feature)
3. **Webhook push ingestion** (feeds push to us)
4. **User-facing "new briefs" notification** (C12)
5. **Feed auto-discovery** (finding feeds for a jurisdiction)
6. **Real-time feed health dashboard** (monitoring)
7. **API route rename chore** (separate PR before C7)
8. **User Dashboard UI** (separate feature after C7)
9. **Gamification scoring engine** (DB columns laid, logic deferred)
10. **Resend domain verification** (ops setup, not code)
11. **Budget visualization** (C11, separate feature)
12. **International feeds** (v2.0, architecture supports it)

---

## 13. Dependencies

### C7 depends on
- Migration 005 applied to Supabase
- `INGEST_HMAC_SECRET`, `OPENSTATES_API_KEY`, `RESEND_API_KEY`, `ADMIN_EMAIL` configured
- `rss-parser` and `resend` npm packages installed

### C7 has no hard blockers
- API route rename is a nice-to-have before C7 but not blocking
- Resend domain verification can happen in parallel

### Other features depend on C7
- C9: Location subscriptions (needs feeds producing briefs)
- C12: Notifications (needs new briefs to notify about)
- C16: School board feeds (just more rows in feeds table)
- User Dashboard (needs auto-ingested briefs to display)

---

## 14. New Roadmap Items (from this session)

To be created as GitHub issues:

| Title | Milestone | Priority |
|-------|-----------|----------|
| User Dashboard ("My Civic Hub") | v1.1 Trust Loop | High |
| Gamification: contribution scores, badges, impact metrics | v1.2 Subscriptions | High |
| User jurisdiction following (multi-jurisdiction) | v1.2 Subscriptions | High |
| API route rename to resource-based convention | v1.1 Trust Loop | Medium (chore) |
| Switch feed monitoring from email to Slack/Discord at 20+ users | v1.2 Subscriptions | Low |
| HTML document extraction (based on format gap data) | v1.2 Subscriptions | Medium |
