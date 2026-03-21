# C7: Feed Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically poll government document feeds (RSS, Legistar, OpenStates), process new PDFs through the civic summarization pipeline, and produce briefs without human intervention.

**Architecture:** Fire-and-forget workers with DB coordination. A lightweight cron orchestrator dispatches HMAC-signed requests to independent workers (one per feed). Each worker fetches its feed, deduplicates items, downloads PDFs, runs the existing summarize/verify/translate pipeline, and records results. A weekly digest cron sends feed health and format gap reports via email.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres, rss-parser, resend, Vercel Cron, HMAC-SHA256 auth

**Spec:** `docs/superpowers/specs/2026-03-21-c7-feed-ingestion-design.md`
**Naming:** `docs/standards/NAMING_CONVENTIONS.md`

---

## Task Overview

| # | Task | Files | Tests | Depends on |
|---|------|-------|-------|------------|
| 1 | Migration 005 + seed data | 2 SQL files | Manual verification | None |
| 2 | TypeScript types | 2 TS files | 1 test file | None |
| 3 | Test helpers (factories, mocks, constants) | 3 TS files | None (used by other tests) | Task 2 |
| 4 | SSRF protection module | 1 TS file | 1 test file | None |
| 5 | Ingestion budget module | 1 TS file | 1 test file | Task 2 |
| 6 | Pipeline extraction refactor | 1 TS file + modify 1 | 1 test file | Task 2 |
| 7 | Feed dedup module | 1 TS file | 1 test file | Task 2 |
| 8 | RSS/Atom fetcher | 2 TS files | 1 test file | Task 2, 4 |
| 9 | Legistar fetcher | 1 TS file | 1 test file (extend) | Task 2, 4, 8 |
| 10 | OpenStates fetcher | 1 TS file | 1 test file (extend) | Task 2, 4, 8 |
| 11a | Feed worker: HMAC auth + feed loading | 1 TS file (partial) | 1 integration test (partial) | Task 4-10 |
| 11b | Feed worker: per-item processing loop | Same file | Extend integration test | Task 11a |
| 11c | Feed worker: post-processing + finalize | Same file | Extend integration test | Task 11b |
| 12 | Cron orchestrator route | 1 TS file | 1 integration test | Task 11c |
| 13 | Weekly digest cron + email | 2 TS files | 1 integration test + 1 unit test | Task 12 |
| 14 | vercel.json + env vars + npm deps | Config files | Build verification | Task 12, 13 |
| 15 | Integration smoke test | None (run existing) | Full pipeline test | All above |

### Parallelization Note

Only Tasks 1, 2, and 4 are truly independent roots. Everything else fans out from Task 2 (types). The dependency chain:
- **Independent roots:** Task 1 (migration), Task 2 (types), Task 4 (SSRF)
- **After Task 2:** Tasks 3, 5, 6, 7, 8 can run in parallel
- **After Task 8:** Tasks 9, 10 can run in parallel
- **Sequential tail:** 11a -> 11b -> 11c -> 12 -> 13 -> 14 -> 15

---

### Task 1: Migration 005 + Seed Data

**Files:**
- Create: `supabase/migrations/005_feed_ingestion_and_user_infra.sql`
- Create: `supabase/seed/feeds.sql`

- [ ] **Step 1: Write migration 005**

Copy the full SQL from spec section 6 (Parts A-D). The migration includes:
- `feeds` table (feed config)
- `feed_poll_runs` table (per-run audit)
- `feed_poll_run_items` table (per-feed-per-run results)
- `sources.ingested_by_feed_id` column
- `user_jurisdictions` table (forward-compatible)
- Profile gamification columns (forward-compatible)
- Brief engagement columns (forward-compatible)
- RLS policies
- `active_feeds()` and `finalize_poll_run()` functions

```sql
-- 005: Feed Ingestion and User Infrastructure
-- Depends on: 001_initial.sql, 002_auth_and_usage.sql, 004_duplicate_handling.sql
-- (Full SQL in spec section 6)
```

- [ ] **Step 2: Write seed data for 5 WA feeds**

Copy from spec section 6 "Seed Data." First verify jurisdiction UUIDs and document type IDs exist:

```sql
-- Run in Supabase SQL Editor to verify IDs match:
SELECT id, name FROM jurisdictions WHERE id IN (
  '00000000-0000-0000-0000-000000000002',  -- WA State
  '00000000-0000-0000-0000-000000000003',  -- King County
  '00000000-0000-0000-0000-000000000004'   -- Seattle
);
-- Should return 3 rows

SELECT id, slug FROM document_types WHERE id IN (2, 6, 9);
-- Should return: 2=legislation, 6=executive_order, 9=public_notice (verify exact slugs)
```

- [ ] **Step 3: Verify Supabase Auth is enabled**

Part B of the migration adds columns to `profiles` (which references `auth.users`) and creates `user_jurisdictions` (FK to `auth.users`). These will fail if Supabase Auth is not enabled.

Check: Supabase Dashboard > Authentication > should show "Enabled". If Auth was previously set up for C6 (Google OAuth), this is already done.

If Auth is NOT enabled: the migration's Part B statements should be deferred. Comment out Part B and apply separately after enabling Auth. Part A (feed ingestion tables) has no Auth dependency and can be applied independently.

- [ ] **Step 4: Apply migration to Supabase**

Run via Supabase dashboard SQL editor or CLI:
```bash
# If using Supabase CLI:
supabase db push
# Or paste SQL directly in Supabase dashboard > SQL Editor
```

Verify: Check that `feeds`, `feed_poll_runs`, `feed_poll_run_items` tables exist. Check `user_jurisdictions` exists. Check `profiles` has new columns. Check `briefs` has `view_count` and `share_count`.

- [ ] **Step 4: Apply seed data**

```bash
# Paste feeds.sql in Supabase SQL Editor
# Verify: SELECT count(*) FROM feeds; -- should return 5
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/005_feed_ingestion_and_user_infra.sql supabase/seed/feeds.sql
git commit -m "feat: migration 005 - feed ingestion tables + forward-compatible user infra"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types.ts` (add DB model types)
- Create: `src/lib/feeds/types.ts` (feed-specific types)
- Create: `tests/unit/feeds/types.test.ts`

- [ ] **Step 1: Write the failing test for feed types**

```typescript
// tests/unit/feeds/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  FEED_TYPES,
  POLL_RUN_STATUSES,
} from '@/lib/types';
import type {
  Feed,
  FeedType,
  FeedPollRun,
  FeedPollRunItem,
  PollRunStatus,
} from '@/lib/types';
import type {
  FeedItem,
  FetchResult,
  SkippedItem,
  PipelineResult,
  IngestFeedResponse,
} from '@/lib/feeds/types';

describe('feed types', () => {
  describe('FEED_TYPES', () => {
    it('contains all supported feed types', () => {
      expect(FEED_TYPES).toContain('rss');
      expect(FEED_TYPES).toContain('atom');
      expect(FEED_TYPES).toContain('json_api');
      expect(FEED_TYPES).toContain('legistar');
      expect(FEED_TYPES).toHaveLength(4);
    });
  });

  describe('POLL_RUN_STATUSES', () => {
    it('contains all poll run statuses', () => {
      expect(POLL_RUN_STATUSES).toContain('running');
      expect(POLL_RUN_STATUSES).toContain('completed');
      expect(POLL_RUN_STATUSES).toContain('partial');
      expect(POLL_RUN_STATUSES).toContain('failed');
      expect(POLL_RUN_STATUSES).toHaveLength(4);
    });
  });

  describe('IngestFeedResponse discriminated union', () => {
    it('narrows on type field', () => {
      const success: IngestFeedResponse = { type: 'success', items_processed: 3, new_briefs: 3 };
      const skipped: IngestFeedResponse = { type: 'skipped', reason: 'not_modified' };
      const error: IngestFeedResponse = { type: 'error', message: 'timeout' };

      expect(success.type).toBe('success');
      expect(skipped.type).toBe('skipped');
      expect(error.type).toBe('error');
    });
  });

  describe('SkippedItem reasons', () => {
    it('accepts all valid skip reasons', () => {
      const reasons: SkippedItem['reason'][] = [
        'unsupported_format', 'ssrf_blocked', 'domain_mismatch',
        'too_large', 'duplicate_url', 'duplicate_hash', 'budget_exceeded',
      ];
      expect(reasons).toHaveLength(7);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/feeds/types.test.ts
```
Expected: FAIL (modules don't exist yet)

- [ ] **Step 3: Add DB model types to src/lib/types.ts**

Add the `Feed`, `FeedType`, `FEED_TYPES`, `PollRunStatus`, `POLL_RUN_STATUSES`, `FeedPollRun`, `FeedPollRunItem`, `UserJurisdiction` types from spec section 6b.

- [ ] **Step 4: Create src/lib/feeds/types.ts**

Add the `FeedItem`, `FetchResult`, `SkippedItem`, `PipelineResult`, `IngestFeedRequest`, `IngestFeedResponse` types from spec section 6b.

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- tests/unit/feeds/types.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/feeds/types.ts tests/unit/feeds/types.test.ts
git commit -m "feat: add TypeScript types for feed ingestion (C7)"
```

---

### Task 3: Test Helpers (Factories, Mocks, Constants)

**Files:**
- Create: `tests/helpers/constants.ts`
- Create: `tests/helpers/factories.ts`
- Create: `tests/helpers/mocks.ts`

- [ ] **Step 1: Create test constants**

```typescript
// tests/helpers/constants.ts
export const TEST_JURISDICTION_ID = '00000000-0000-0000-0000-000000000004'; // Seattle
export const TEST_FEED_URL = 'https://example.gov/feed.rss';
export const TEST_FEED_ID = '00000000-0000-0000-0000-feedfeedfeed';
export const TEST_RUN_ID = '00000000-0000-0000-0000-runrunrunrun';
export const TEST_SOURCE_URL = 'https://seattle.gov/documents/budget-2026.pdf';
export const TEST_CONTENT_HASH = 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd';
export const TEST_HMAC_SECRET = 'test-hmac-secret-minimum-32-bytes-long!!';
export const TEST_CRON_SECRET = 'test-cron-secret';
```

- [ ] **Step 2: Create test factories**

```typescript
// tests/helpers/factories.ts
import type { Feed, FeedPollRun, FeedPollRunItem } from '@/lib/types';
import type { FeedItem, FetchResult } from '@/lib/feeds/types';
import { TEST_JURISDICTION_ID, TEST_FEED_URL, TEST_FEED_ID } from './constants';

export function createMockFeed(overrides?: Partial<Feed>): Feed {
  return {
    id: TEST_FEED_ID,
    jurisdiction_id: TEST_JURISDICTION_ID,
    document_type_id: 2,  // 2 = 'legislation' per document-types.sql
    name: 'Test Feed',
    feed_url: TEST_FEED_URL,
    feed_type: 'rss',
    expected_domain: 'example.gov',
    is_active: true,
    last_polled_at: null,
    last_successful_poll_at: null,
    last_seen_item_guid: null,
    etag: null,
    last_modified: null,
    consecutive_failures: 0,
    max_items_per_poll: 10,
    metadata: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockFeedItem(overrides?: Partial<FeedItem>): FeedItem {
  return {
    guid: `item-${Date.now()}`,
    title: 'Test Government Document',
    url: 'https://example.gov/doc.pdf',
    published_at: new Date().toISOString(),
    content_type: 'application/pdf',
    metadata: {},
    ...overrides,
  };
}

export function createMockFetchResult(overrides?: Partial<FetchResult>): FetchResult {
  return {
    feed_id: TEST_FEED_ID,
    items: [createMockFeedItem()],
    etag: '"abc123"',
    last_modified: 'Thu, 21 Mar 2026 00:00:00 GMT',
    was_modified: true,
    ...overrides,
  };
}

export function createMockPollRun(overrides?: Partial<FeedPollRun>): FeedPollRun {
  return {
    id: '00000000-0000-0000-0000-runrunrunrun',
    started_at: new Date().toISOString(),
    completed_at: null,
    status: 'running',
    feeds_dispatched: 0,
    total_items_processed: 0,
    total_items_skipped: 0,
    total_errors: 0,
    total_new_briefs: 0,
    duration_ms: null,
    metadata: {},
    ...overrides,
  };
}
```

- [ ] **Step 3: Create test mocks**

```typescript
// tests/helpers/mocks.ts

/** Valid RSS 2.0 feed with one PDF item */
export const MOCK_RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Seattle City Council</title>
    <link>https://seattle.gov/council</link>
    <item>
      <title>Resolution 32145</title>
      <link>https://seattle.gov/docs/resolution-32145.pdf</link>
      <guid>res-32145</guid>
      <pubDate>Thu, 21 Mar 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

/** RSS feed with non-PDF items */
export const MOCK_RSS_MIXED_FORMATS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Seattle News</title>
    <item>
      <title>Budget Report</title>
      <link>https://seattle.gov/budget.pdf</link>
      <guid>budget-2026</guid>
    </item>
    <item>
      <title>Council Agenda</title>
      <link>https://seattle.gov/agenda.docx</link>
      <guid>agenda-0321</guid>
    </item>
    <item>
      <title>Meeting Minutes</title>
      <link>https://seattle.gov/minutes.html</link>
      <guid>minutes-0321</guid>
    </item>
  </channel>
</rss>`;

/** XXE attack payload */
export const MOCK_RSS_XXE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE rss [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<rss version="2.0">
  <channel>
    <title>&xxe;</title>
    <item>
      <title>Test</title>
      <link>https://evil.com/doc.pdf</link>
      <guid>xxe-test</guid>
    </item>
  </channel>
</rss>`;

/** XML bomb (billion laughs) */
export const MOCK_RSS_XML_BOMB = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE rss [
  <!ENTITY a "aaaaaaaaaa">
  <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
  <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
  <!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;">
]>
<rss version="2.0">
  <channel><title>&d;</title></channel>
</rss>`;

/** Legistar API matters response */
export function mockLegistarMattersResponse(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    MatterId: 1000 + i,
    MatterGuid: `matter-guid-${i}`,
    MatterTitle: `Ordinance ${2026100 + i}`,
    MatterLastModifiedUtc: new Date().toISOString(),
    MatterTypeName: 'Ordinance',
  }));
}

/** Legistar API attachments response */
export function mockLegistarAttachmentsResponse(matterId: number) {
  return [
    {
      MatterAttachmentId: matterId * 10,
      MatterAttachmentName: `Ordinance_${matterId}.pdf`,
      MatterAttachmentHyperlink: `https://seattle.legistar.com/docs/Ordinance_${matterId}.pdf`,
      MatterAttachmentMatterVersion: 1,
    },
  ];
}

/** OpenStates API bills response */
export function mockOpenStatesResponse(count = 2) {
  return {
    results: Array.from({ length: count }, (_, i) => ({
      id: `ocd-bill/wa-${i}`,
      identifier: `HB ${1000 + i}`,
      title: `An act relating to civic transparency ${i}`,
      updated_at: new Date().toISOString(),
      texts: [
        {
          url: `https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/HB${1000 + i}.pdf`,
          media_type: 'application/pdf',
          note: 'As Introduced',
        },
      ],
    })),
    pagination: { total_items: count, page: 1, max_page: 1 },
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add tests/helpers/constants.ts tests/helpers/factories.ts tests/helpers/mocks.ts
git commit -m "test: add factories, mocks, and constants for feed ingestion tests"
```

---

### Task 4: SSRF Protection Module

**Files:**
- Create: `src/lib/ssrf.ts`
- Create: `tests/unit/ssrf.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/ssrf.test.ts
import { describe, it, expect, vi } from 'vitest';
import { isPrivateIp, validateFetchTarget } from '@/lib/ssrf';

describe('ssrf', () => {
  describe('isPrivateIp', () => {
    it('rejects 127.0.0.1 (loopback)', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
    });

    it('rejects 127.x.x.x range', () => {
      expect(isPrivateIp('127.0.0.2')).toBe(true);
      expect(isPrivateIp('127.255.255.255')).toBe(true);
    });

    it('rejects 10.x.x.x (private class A)', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.255.255.255')).toBe(true);
    });

    it('rejects 172.16-31.x.x (private class B)', () => {
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
    });

    it('allows 172.15.x.x and 172.32.x.x (not private)', () => {
      expect(isPrivateIp('172.15.0.1')).toBe(false);
      expect(isPrivateIp('172.32.0.1')).toBe(false);
    });

    it('rejects 192.168.x.x (private class C)', () => {
      expect(isPrivateIp('192.168.0.1')).toBe(true);
      expect(isPrivateIp('192.168.255.255')).toBe(true);
    });

    it('rejects 169.254.x.x (link-local / cloud metadata)', () => {
      expect(isPrivateIp('169.254.169.254')).toBe(true);
      expect(isPrivateIp('169.254.0.1')).toBe(true);
    });

    it('rejects 0.0.0.0', () => {
      expect(isPrivateIp('0.0.0.0')).toBe(true);
    });

    it('rejects IPv6 loopback ::1', () => {
      expect(isPrivateIp('::1')).toBe(true);
    });

    it('rejects IPv6 unique local fc00::/7', () => {
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fd00::1')).toBe(true);
    });

    it('rejects IPv6 link-local fe80::/10', () => {
      expect(isPrivateIp('fe80::1')).toBe(true);
    });

    it('allows valid public IPs', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('151.101.1.69')).toBe(false);
      expect(isPrivateIp('2607:f8b0:4004:800::200e')).toBe(false);
    });
  });

  describe('validateFetchTarget', () => {
    it('rejects HTTP (non-HTTPS) URLs', async () => {
      const result = await validateFetchTarget('http://example.com/doc.pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('HTTPS');
    });

    it('rejects URLs with auth components', async () => {
      const result = await validateFetchTarget('https://user:pass@example.com/doc.pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('auth');
    });

    it('rejects non-standard ports', async () => {
      const result = await validateFetchTarget('https://example.com:8443/doc.pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('port');
    });

    it('allows standard HTTPS port 443', async () => {
      // Mock DNS to resolve to public IP
      vi.spyOn(await import('dns'), 'promises', 'get').mockReturnValue({
        lookup: vi.fn().mockResolvedValue({ address: '93.184.216.34', family: 4 }),
      } as any);

      const result = await validateFetchTarget('https://example.com/doc.pdf');
      expect(result.valid).toBe(true);
    });

    it('rejects URLs that DNS-resolve to private IPs', async () => {
      vi.spyOn(await import('dns'), 'promises', 'get').mockReturnValue({
        lookup: vi.fn().mockResolvedValue({ address: '127.0.0.1', family: 4 }),
      } as any);

      const result = await validateFetchTarget('https://sneaky-domain.com/doc.pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('private');
    });

    it('handles DNS resolution failure gracefully', async () => {
      vi.spyOn(await import('dns'), 'promises', 'get').mockReturnValue({
        lookup: vi.fn().mockRejectedValue(new Error('ENOTFOUND')),
      } as any);

      const result = await validateFetchTarget('https://nonexistent.example.com/doc.pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('resolve');
    });

    it('rejects invalid URLs', async () => {
      const result = await validateFetchTarget('not-a-url');
      expect(result.valid).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/ssrf.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement src/lib/ssrf.ts**

Implement `isPrivateIp(ip: string): boolean` and `validateFetchTarget(url: string): Promise<{ valid: boolean; error?: string }>`. Use `dns.promises.lookup()` for DNS resolution. Check all private IP ranges. Enforce HTTPS, reject auth components, reject non-standard ports (allow 443 and default). Use `crypto.timingSafeEqual` for HMAC comparison utility (export separately as `timingSafeCompare`).

Key implementation details:
- Parse IPv4 octets for range checks
- IPv6: check prefixes for `::1`, `fc`, `fd`, `fe80`
- `0.0.0.0` is also rejected
- DNS resolution must happen BEFORE any fetch

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/ssrf.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ssrf.ts tests/unit/ssrf.test.ts
git commit -m "feat: add SSRF protection module with DNS-resolve-then-validate"
```

---

### Task 5: Ingestion Budget Module

**Files:**
- Create: `src/lib/budget.ts`
- Create: `tests/unit/budget.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/budget.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkIngestionBudget } from '@/lib/budget';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn(),
}));

describe('budget', () => {
  describe('checkIngestionBudget', () => {
    beforeEach(() => {
      vi.resetModules();
      process.env.INGESTION_DAILY_LIMIT = '50';
    });

    it('allows processing when under daily limit', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockReturnValue({
        from: () => ({
          select: () => ({
            not: () => ({
              gte: () => Promise.resolve({ count: 10 }),
            }),
          }),
        }),
      });
      const result = await checkIngestionBudget();
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(40);
    });

    it('rejects when daily limit reached', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockReturnValue({
        from: () => ({
          select: () => ({
            not: () => ({
              gte: () => Promise.resolve({ count: 50 }),
            }),
          }),
        }),
      });
      const result = await checkIngestionBudget();
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('returns allowed when DB unavailable', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockImplementation(() => { throw new Error('no DB'); });
      const result = await checkIngestionBudget();
      expect(result.allowed).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/budget.test.ts
```

- [ ] **Step 3: Implement src/lib/budget.ts**

`checkIngestionBudget()` queries `sources` table: count rows where `ingested_by_feed_id IS NOT NULL` and `created_at >= today_start`. Compare against `INGESTION_DAILY_LIMIT` env var (default 50). Return `{ remaining: number; allowed: boolean }`.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/budget.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/budget.ts tests/unit/budget.test.ts
git commit -m "feat: add ingestion budget module with separate daily limit"
```

---

### Task 6: Pipeline Extraction Refactor

**Files:**
- Create: `src/lib/pipeline.ts`
- Modify: `src/app/api/summarize/route.ts` (extract shared logic)
- Create: `tests/unit/pipeline.test.ts`

- [ ] **Step 1: Write failing tests for processCivicDocument()**

```typescript
// tests/unit/pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processCivicDocument } from '@/lib/pipeline';
import { TEST_JURISDICTION_ID, TEST_SOURCE_URL } from '../../helpers/constants';

// Mock Claude API
vi.mock('@/lib/anthropic', () => ({
  generateJSON: vi.fn().mockResolvedValue({
    title: 'Test Resolution',
    what_changed: 'A new policy was adopted.',
    who_affected: 'All residents.',
    what_to_do: 'Attend the next meeting.',
    money: '$1M allocated.',
    deadlines: ['2026-04-01'],
    document_type: 'resolution',
  }),
  MODEL: 'claude-sonnet-4-20250514',
  PROMPT_VERSION: 'civic-v1.0',
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'test-source-id' }, error: null }),
        }),
      }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 1, slug: 'resolution' }, error: null }),
    }),
  }),
}));

describe('pipeline', () => {
  describe('processCivicDocument', () => {
    const mockBuffer = new ArrayBuffer(100);

    it('returns PipelineResult with source_id and brief_ids', async () => {
      const result = await processCivicDocument({
        pdfBuffer: mockBuffer,
        sourceUrl: TEST_SOURCE_URL,
        jurisdictionId: TEST_JURISDICTION_ID,
      });
      expect(result.source_id).toBeDefined();
      expect(result.brief_ids.length).toBeGreaterThan(0);
      expect(result.verification.confidence_score).toBeDefined();
    });

    it('defaults to English when no jurisdiction languages configured', async () => {
      const result = await processCivicDocument({
        pdfBuffer: mockBuffer,
        sourceUrl: TEST_SOURCE_URL,
        jurisdictionId: TEST_JURISDICTION_ID,
      });
      expect(result.brief_ids.some(b => b.language === 'en')).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/pipeline.test.ts
```

- [ ] **Step 3: Extract pipeline logic from summarize/route.ts**

Create `processCivicDocument()` in `src/lib/pipeline.ts`. Move lines 206-387 of `summarize/route.ts` (steps 4-8: summarize, verify, translate, build summary, save to DB) into this function. The function accepts `PipelineParams` and returns `PipelineResult`.

Key: `summarize/route.ts` should import and call `processCivicDocument()` after its existing form validation, rate limiting, and dedup logic. The refactored route should be significantly shorter.

**Critical:** Run `npm test` after refactor to ensure existing 115 unit tests still pass. Run `npm run typecheck` to verify types.

- [ ] **Step 4: Run tests to verify everything passes**

```bash
npm test && npm run typecheck
```
Expected: All existing tests PASS + new pipeline tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline.ts src/app/api/summarize/route.ts tests/unit/pipeline.test.ts
git commit -m "refactor: extract civic document pipeline into shared module"
```

---

### Task 7: Feed Dedup Module

**Files:**
- Create: `src/lib/feeds/dedup.ts`
- Create: `tests/unit/feeds/dedup.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/feeds/dedup.test.ts
import { describe, it, expect, vi } from 'vitest';
import { checkFeedItemDuplicate } from '@/lib/feeds/dedup';

vi.mock('@/lib/supabase', () => ({ getServerClient: vi.fn() }));

describe('dedup', () => {
  describe('checkFeedItemDuplicate', () => {
    it('returns duplicate_url when source_url exists with processed status', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockReturnValue({
        from: () => ({ select: () => ({ eq: () => ({ neq: () => ({
          maybeSingle: () => Promise.resolve({
            data: { id: 'existing', content_hash: 'same-hash' }, error: null }),
        }) }) }) }),
      });
      const result = await checkFeedItemDuplicate('https://example.gov/doc.pdf', 'same-hash');
      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('duplicate_url');
    });

    it('returns isUpdate when URL exists but hash differs', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockReturnValue({
        from: () => ({ select: () => ({ eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn()
            .mockResolvedValueOnce({ data: { id: 'old-source', content_hash: 'old-hash' }, error: null })
            .mockResolvedValueOnce({ data: { id: 'old-brief' }, error: null }),
        }) }),
      });
      const result = await checkFeedItemDuplicate('https://example.gov/doc.pdf', 'new-hash');
      expect(result.isDuplicate).toBe(false);
      expect(result.isUpdate).toBe(true);
    });

    it('returns not duplicate for new URL and new hash', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockReturnValue({
        from: () => ({ select: () => ({ eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }) }),
      });
      const result = await checkFeedItemDuplicate('https://new.gov/doc.pdf', 'new-hash');
      expect(result.isDuplicate).toBe(false);
      expect(result.isUpdate).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `src/lib/feeds/dedup.ts`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add 3-layer feed item deduplication module"
```

---

### Task 8: RSS/Atom Fetcher + Fetcher Interface

**Files:**
- Create: `src/lib/feeds/fetchers/index.ts` (interface + factory)
- Create: `src/lib/feeds/fetchers/rss.ts`
- Create: `tests/unit/feeds/fetchers.test.ts`

- [ ] **Step 1: Write failing tests**

Test `RssFetcher`:
- parses valid RSS 2.0 feed into FeedItem[]
- parses valid Atom feed into FeedItem[]
- rejects XML exceeding 5MB (create a 6MB string, expect error)
- rejects XXE entity expansion (use MOCK_RSS_XXE from test mocks)
- rejects XML bomb / billion laughs (use MOCK_RSS_XML_BOMB)
- handles malformed XML gracefully (returns error, doesn't throw)
- sends If-None-Match / If-Modified-Since when etag/last_modified provided
- returns was_modified: false on 304 Not Modified

Test `createFeedFetcher()` factory:
- returns RssFetcher for feed_type 'rss'
- returns RssFetcher for feed_type 'atom'
- throws for unknown feed_type

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Install rss-parser dependency**

```bash
npm install rss-parser
```

- [ ] **Step 4: Implement fetcher interface and RSS fetcher**

`src/lib/feeds/fetchers/index.ts`:
```typescript
export interface FeedFetcher {
  fetch(feed: Feed): Promise<FetchResult>;
}
export function createFeedFetcher(feedType: FeedType): FeedFetcher;
```

`src/lib/feeds/fetchers/rss.ts`:
- Use `rss-parser` (verify XXE disabled by default in xml2js)
- Check response body size before parsing (5MB limit)
- Send conditional HTTP headers (ETag, Last-Modified)
- Map RSS items to `FeedItem[]`
- Handle 304 Not Modified

- [ ] **Step 5: Run tests, Step 6: Commit**

```bash
git commit -m "feat: add RSS/Atom feed fetcher with XXE protection"
```

---

### Task 9: Legistar Fetcher

**Files:**
- Create: `src/lib/feeds/fetchers/legistar.ts`
- Modify: `src/lib/feeds/fetchers/index.ts` (register in factory)
- Modify: `tests/unit/feeds/fetchers.test.ts` (add Legistar tests)

- [ ] **Step 1: Add failing tests for LegistarFetcher**

- maps Legistar matters JSON to FeedItem[]
- fetches attachments for each matter (second API call)
- extracts PDF URLs from MatterAttachmentHyperlink
- filters by date using $filter parameter
- handles empty response
- factory returns LegistarFetcher for feed_type 'legistar'

- [ ] **Step 2-5: Implement, test, commit**

Legistar API pattern:
```
GET https://webapi.legistar.com/v1/{slug}/matters?$top=50&$orderby=MatterLastModifiedUtc desc
GET https://webapi.legistar.com/v1/{slug}/matters/{id}/attachments
```

Extract slug from feed URL. No auth required.

```bash
git commit -m "feat: add Legistar REST API fetcher"
```

---

### Task 10: OpenStates Fetcher

**Files:**
- Create: `src/lib/feeds/fetchers/openstates.ts`
- Modify: `src/lib/feeds/fetchers/index.ts` (register in factory)
- Modify: `tests/unit/feeds/fetchers.test.ts` (add OpenStates tests)

- [ ] **Step 1: Add failing tests for OpenStatesFetcher**

- maps OpenStates bills JSON to FeedItem[]
- extracts PDF URLs from bill texts array
- passes API key in X-API-Key header
- handles rate limit (429) response with appropriate error
- factory returns OpenStatesFetcher for feed_type 'json_api' when URL contains 'openstates.org'

- [ ] **Step 2-5: Implement, test, commit**

```bash
git commit -m "feat: add OpenStates API fetcher for state legislation"
```

---

### Task 11a: Feed Worker -- HMAC Auth + Feed Loading

**Files:**
- Create: `src/app/api/internal/ingest-feed/route.ts` (partial: auth + feed loading skeleton)
- Create: `tests/integration/ingest-feed.test.ts` (partial: auth tests)

- [ ] **Step 1: Write failing auth tests**

```typescript
// tests/integration/ingest-feed.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/internal/ingest-feed/route';
import { NextRequest } from 'next/server';
import { TEST_HMAC_SECRET, TEST_FEED_ID, TEST_RUN_ID } from '../../helpers/constants';
import crypto from 'crypto';

function createSignedRequest(feedId: string, runId: string, secret: string, timestampOffset = 0) {
  const timestamp = Date.now() + timestampOffset;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(feedId + runId + timestamp)
    .digest('hex');

  return new NextRequest('http://localhost:3000/api/internal/ingest-feed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ingest-Signature': signature,
    },
    body: JSON.stringify({ feed_id: feedId, run_id: runId, timestamp }),
  });
}

describe('POST /api/internal/ingest-feed', () => {
  beforeAll(() => { process.env.INGEST_HMAC_SECRET = TEST_HMAC_SECRET; });

  it('returns 401 when X-Ingest-Signature header missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/internal/ingest-feed', {
      method: 'POST',
      body: JSON.stringify({ feed_id: TEST_FEED_ID, run_id: TEST_RUN_ID, timestamp: Date.now() }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when HMAC signature is invalid', async () => {
    const req = new NextRequest('http://localhost:3000/api/internal/ingest-feed', {
      method: 'POST',
      headers: { 'X-Ingest-Signature': 'bad-signature' },
      body: JSON.stringify({ feed_id: TEST_FEED_ID, run_id: TEST_RUN_ID, timestamp: Date.now() }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when timestamp is expired (>60s old)', async () => {
    const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET, -120_000);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement HMAC validation + feed loading skeleton**

Implement the route with: HMAC validation (timing-safe), timestamp check, feed loading from DB. Return early errors for auth failures. Stub the processing loop (return `{ type: 'success', items_processed: 0 }` for now).

- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add feed worker route skeleton with HMAC auth"
```

---

### Task 11b: Feed Worker -- Per-Item Processing Loop

**Files:**
- Modify: `src/app/api/internal/ingest-feed/route.ts` (add processing loop)
- Modify: `tests/integration/ingest-feed.test.ts` (add processing tests)

- [ ] **Step 1: Add failing tests for item processing**

Add tests (in same file):
- processes feed and creates briefs with valid HMAC (mock fetcher + pipeline)
- skips non-PDF items and records skipped_formats
- stops at max_items_per_poll cap, records items_deferred count
- validates item URLs through SSRF module (rejects private IPs)
- checks ingestion budget before each pipeline call

- [ ] **Step 2: Implement the processing loop**

For each item (up to max_items_per_poll):
1. Random jitter: `await new Promise(r => setTimeout(r, Math.random() * 60_000))` for first item only (security finding #10)
2. Check dedup (`checkFeedItemDuplicate`)
3. Validate URL (`validateFetchTarget` from ssrf.ts)
4. Check `expected_domain` match
5. HEAD request: Content-Type (must be application/pdf) + Content-Length (<10MB)
6. Download PDF (streaming, abort at 10MB byte counter)
7. Check budget (`checkIngestionBudget`)
8. Run pipeline (`processCivicDocument`)
9. Null out `pdfBuffer` and `extractedText`

- [ ] **Step 3: Run tests, verify pass**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add per-item processing loop to feed worker"
```

---

### Task 11c: Feed Worker -- Post-Processing + Finalize

**Files:**
- Modify: `src/app/api/internal/ingest-feed/route.ts` (add post-processing)
- Modify: `tests/integration/ingest-feed.test.ts` (add failure handling tests)

- [ ] **Step 1: Add failing tests for error handling**

Add tests:
- increments feed.consecutive_failures on fetch error
- resets consecutive_failures to 0 on success
- sets feed.is_active = false when consecutive_failures reaches 5
- calls finalize_poll_run after completing
- sends email alert stub at 3+ consecutive failures

- [ ] **Step 2: Implement post-processing**

After item loop:
1. Update feed metadata: `last_polled_at`, `last_seen_item_guid`, `etag`, `last_modified`
2. Success: reset `consecutive_failures = 0`
3. Error: increment `consecutive_failures`; if >= 3 call `sendFeedFailureAlert` (stub for now, real impl in Task 13); if >= 5 set `is_active = false`
4. Write results to `feed_poll_run_items` (status, counts, skipped_formats, errors)
5. Call `finalize_poll_run(run_id)` via Supabase RPC

- [ ] **Step 3: Run all tests**

```bash
npm test && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add feed worker post-processing, failure handling, and finalize"
```

---

### Task 12: Cron Orchestrator Route

**Files:**
- Create: `src/app/api/cron/ingest/route.ts`
- Create: `tests/integration/cron-ingest.test.ts`

- [ ] **Step 1: Write failing integration tests**

- returns 401 without CRON_SECRET header
- returns 200 and creates feed_poll_run row
- dispatches one worker per active feed (mock fetch)
- skips inactive feeds (is_active = false)
- creates feed_poll_run_item rows for each dispatched feed
- marks stale runs (>30min, status 'running') as 'failed'
- skips invocation when a recent run (<30min) is still running (overlap guard)
- generates valid HMAC signatures for worker requests

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement the orchestrator**

```typescript
export async function GET(request: NextRequest) {
  // 1. Validate CRON_SECRET (timing-safe comparison)
  // 2. Stale run cleanup: UPDATE feed_poll_runs SET status = 'failed'
  //    WHERE status = 'running' AND started_at < now() - interval '30 minutes'
  // 3. Overlap guard: SELECT count(*) FROM feed_poll_runs
  //    WHERE status = 'running' AND started_at >= now() - interval '30 minutes'
  //    If count > 0, return 200 with { skipped: true, reason: 'overlap' }
  // 4. Read active feeds: SELECT * FROM active_feeds()
  // 5. Create feed_poll_run row
  // 6. For each feed:
  //    a. Create feed_poll_run_item (status: 'pending')
  //    b. Generate HMAC: HMAC-SHA256(feed_id + run_id + Date.now(), INGEST_HMAC_SECRET)
  //    c. Fire-and-forget: fetch(workerUrl, { method: 'POST', ... }) — do NOT await
  // 7. Return 200 with { run_id, feeds_dispatched: N }
}
```

Key: Use the deployment URL from `VERCEL_URL` env var (or `localhost:3000` in dev) to construct worker URLs.

- [ ] **Step 4: Run integration tests and full suite**

```bash
npm test -- tests/integration/cron-ingest.test.ts
npm test && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/ingest/route.ts tests/integration/cron-ingest.test.ts
git commit -m "feat: add cron orchestrator with overlap guard and HMAC dispatch"
```

---

### Task 13: Weekly Digest Cron + Email

**Files:**
- Create: `src/lib/email/alerts.ts`
- Create: `src/lib/email/digest.ts`
- Create: `src/app/api/cron/digest/route.ts`
- Create: `tests/unit/email/alerts.test.ts`
- Create: `tests/integration/cron-digest.test.ts`

- [ ] **Step 1: Install resend dependency**

```bash
npm install resend
```

- [ ] **Step 2: Implement email alert module**

`src/lib/email/alerts.ts`:
- `sendFeedFailureAlert(feed: Feed, consecutiveFailures: number, error: string)`: sends email via Resend to `ADMIN_EMAIL`
- Graceful no-op if `RESEND_API_KEY` not configured (log warning)

- [ ] **Step 3: Implement weekly digest builder**

`src/lib/email/digest.ts`:
- `buildDigestEmail(runs: FeedPollRun[], items: FeedPollRunItem[], feeds: Feed[])`: returns HTML email string
- Aggregates: total processed, total skipped by format, errors, per-feed health
- Includes "top format gap" insight (most common skipped format)
- Includes feed health status (green/yellow/red emoji per feed)

- [ ] **Step 4: Implement digest cron route**

`src/app/api/cron/digest/route.ts`:
```typescript
export async function GET(request: NextRequest) {
  // 1. Validate CRON_SECRET
  // 2. Query feed_poll_runs from past 7 days
  // 3. Join feed_poll_run_items
  // 4. Query feeds for names
  // 5. Build email HTML
  // 6. Send via Resend to ADMIN_EMAIL
  // 7. Return 200 with summary stats
}
```

- [ ] **Step 5: Write unit tests for alerts**

```typescript
// tests/unit/email/alerts.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sendFeedFailureAlert } from '@/lib/email/alerts';
import { createMockFeed } from '../../helpers/factories';

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: 'email-123' }) },
  })),
}));

describe('alerts', () => {
  describe('sendFeedFailureAlert', () => {
    it('sends email when RESEND_API_KEY is configured', async () => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.ADMIN_EMAIL = 'admin@test.com';
      const feed = createMockFeed({ consecutive_failures: 3 });
      await expect(sendFeedFailureAlert(feed, 3, 'timeout')).resolves.not.toThrow();
    });

    it('no-ops gracefully when RESEND_API_KEY is missing', async () => {
      delete process.env.RESEND_API_KEY;
      const feed = createMockFeed();
      await expect(sendFeedFailureAlert(feed, 3, 'timeout')).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 6: Write integration test for digest cron**

```typescript
// tests/integration/cron-digest.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/cron/digest/route';
import { NextRequest } from 'next/server';
import { TEST_CRON_SECRET } from '../../helpers/constants';

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: 'email-123' }) },
  })),
}));

describe('GET /api/cron/digest', () => {
  it('returns 401 without CRON_SECRET', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/digest');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid CRON_SECRET', async () => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    const req = new NextRequest('http://localhost:3000/api/cron/digest', {
      headers: { 'x-vercel-cron-secret': TEST_CRON_SECRET },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 7: Update Task 11 worker to call sendFeedFailureAlert**

Replace the alert stub in `ingest-feed/route.ts` with the real import from `src/lib/email/alerts.ts`.

- [ ] **Step 8: Run all tests**

```bash
npm test && npm run typecheck
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/email/alerts.ts src/lib/email/digest.ts src/app/api/cron/digest/route.ts tests/unit/email/alerts.test.ts tests/integration/cron-digest.test.ts src/app/api/internal/ingest-feed/route.ts
git commit -m "feat: add weekly digest cron and feed failure email alerts with tests"
```

---

### Task 14: Configuration (vercel.json, env vars, deps)

**Files:**
- Modify: `vercel.json` (add crons + worker function config)
- Modify: `package.json` (verify deps)
- Create/update: `.env.example` (add new env vars)

- [ ] **Step 1: Update vercel.json**

Add cron schedules and worker function maxDuration:

Add the cron schedule and new worker function config. Keep existing function entries unchanged (they are already in vercel.json):

```json
{
  "crons": [
    { "path": "/api/cron/ingest", "schedule": "0 6 * * *" },
    { "path": "/api/cron/digest", "schedule": "0 9 * * 1" }
  ],
  "functions": {
    "src/app/api/internal/ingest-feed/route.ts": { "maxDuration": 300 }
  }
}
```

Note: Merge this with existing `"functions"` entries, do not replace them.

- [ ] **Step 2: Add new env vars to .env.example**

```bash
# Feed Ingestion (C7)
CRON_SECRET=                    # Auto-injected by Vercel in production
INGEST_HMAC_SECRET=             # openssl rand -hex 32
OPENSTATES_API_KEY=             # Free: https://openstates.org/accounts/signup/
RESEND_API_KEY=                 # https://resend.com
ADMIN_EMAIL=                    # Feed failure alerts + weekly digest recipient
INGESTION_DAILY_LIMIT=50        # Max auto-ingested docs per day
```

- [ ] **Step 3: Add env vars to local .env.local**

Generate HMAC secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env.local` (never committed).

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add vercel.json .env.example
git commit -m "chore: add cron config, worker function limits, and env var documentation"
```

---

### Task 15: Integration Smoke Test

**Files:** None new (run existing tests + manual verification)

- [ ] **Step 1: Run full test suite**

```bash
npm test && npm run typecheck
```
Expected: All tests pass, 0 type errors.

- [ ] **Step 2: Test cron orchestrator locally**

```bash
# Start dev server
npm run dev

# In another terminal, trigger the orchestrator
curl -H "x-vercel-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/cron/ingest
```

Verify: Returns 200 with `{ run_id, feeds_dispatched: 5 }` (or however many seed feeds you applied).

- [ ] **Step 3: Verify worker execution**

Check Supabase dashboard:
- `feed_poll_runs` should have a row with status 'completed' or 'partial'
- `feed_poll_run_items` should have one row per feed
- If any feeds succeeded: new rows in `sources` and `briefs`

- [ ] **Step 4: Test weekly digest locally**

```bash
curl -H "x-vercel-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/cron/digest
```

Verify: Returns 200. If RESEND_API_KEY configured, check email. If not, check console for warning log.

- [ ] **Step 5: Run E2E tests to verify no UI regressions**

```bash
npm run test:e2e
```

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git commit -m "test: verify full feed ingestion pipeline end-to-end"
```

---

## Dependency Graph

```
Task 1 (Migration) ──────────────────────────────────────────┐
Task 2 (Types) ────────┬──────────────────────────────────── │
Task 3 (Test Helpers) ─┤                                     │
Task 4 (SSRF) ─────────┤                                     │
Task 5 (Budget) ───────┤                                     │
Task 6 (Pipeline) ─────┤                                     │
Task 7 (Dedup) ────────┤                                     │
Task 8 (RSS Fetcher) ──┤                                     │
Task 9 (Legistar) ─────┤                                     │
Task 10 (OpenStates) ──┤                                     │
                       ├── Task 11 (Worker) ── Task 12 (Orchestrator) ── Task 13 (Email)
                       │                                     │
                       └─────────────────────── Task 14 (Config) ── Task 15 (Smoke Test)
```

Tasks 1-10 can be parallelized. Tasks 11-15 are sequential.
