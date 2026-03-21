import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { TEST_HMAC_SECRET, TEST_FEED_ID, TEST_RUN_ID, TEST_SOURCE_URL, TEST_CONTENT_HASH } from '../helpers/constants';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn(),
}));

// Mock feed fetchers
vi.mock('@/lib/feeds/fetchers', () => ({
  createFeedFetcher: vi.fn(),
}));

// Mock dedup
vi.mock('@/lib/feeds/dedup', () => ({
  checkFeedItemDuplicate: vi.fn(),
}));

// Mock budget
vi.mock('@/lib/budget', () => ({
  checkIngestionBudget: vi.fn(),
}));

// Mock pipeline
vi.mock('@/lib/pipeline', () => ({
  processCivicDocument: vi.fn(),
}));

// Mock SSRF
vi.mock('@/lib/ssrf', () => ({
  validateFetchTarget: vi.fn(),
}));

// Mock PDF extraction
vi.mock('@/lib/pdf-extract', () => ({
  extractTextFromPDF: vi.fn(),
  hashText: vi.fn(),
}));

function createSignedRequest(
  feedId: string,
  runId: string,
  secret: string,
  timestampOffset = 0
): NextRequest {
  const timestamp = Date.now() + timestampOffset;
  const payload = `${feedId}:${runId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return new NextRequest('http://localhost:3000/api/internal/ingest-feed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ingest-Signature': signature,
    },
    body: JSON.stringify({ feed_id: feedId, run_id: runId, timestamp, signature }),
  });
}

// ─── Shared mock factory helpers ───

function makeActiveFeed(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_FEED_ID,
    is_active: true,
    feed_url: 'https://example.gov/feed.rss',
    feed_type: 'rss',
    max_items_per_poll: 10,
    expected_domain: null,
    jurisdiction_id: '00000000-0000-0000-0000-000000000004',
    consecutive_failures: 0,
    etag: null,
    last_modified: null,
    last_seen_item_guid: null,
    ...overrides,
  };
}

function makeFeedItem(url = TEST_SOURCE_URL, guid = 'item-guid-1') {
  return {
    guid,
    title: 'Budget Resolution 2026',
    url,
    published_at: new Date().toISOString(),
    content_type: null,
    metadata: {},
  };
}

function makePdfHeadResponse(overrides: Partial<{ contentType: string; contentLength: string }> = {}) {
  const contentType = overrides.contentType ?? 'application/pdf';
  const contentLength = overrides.contentLength ?? '512000';
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') return contentType;
        if (name.toLowerCase() === 'content-length') return contentLength;
        return null;
      },
    },
  };
}

function makePdfGetResponse(bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer) {
  return {
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(bytes),
  };
}

function makeDbWithMethods(methods: Record<string, unknown> = {}) {
  // Returns a mock Supabase client that supports chained from().select()...
  // and also allows .update().eq()... and .insert()
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'feeds' && (methods as Record<string, unknown>)['feedsSelect']) {
        return (methods as Record<string, unknown>)['feedsSelect'];
      }
      return {
        select: () => ({
          eq: vi.fn().mockReturnThis(),
          single: () =>
            Promise.resolve({
              data: makeActiveFeed(),
              error: null,
            }),
        }),
        update: updateMock,
        insert: insertMock,
      };
    }),
    _insertMock: insertMock,
    _updateMock: updateMock,
  };
}

describe('POST /api/internal/ingest-feed', () => {
  beforeAll(() => {
    process.env.INGEST_HMAC_SECRET = TEST_HMAC_SECRET;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HMAC authentication', () => {
    it('returns 401 when X-Ingest-Signature header is missing', async () => {
      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = new NextRequest('http://localhost:3000/api/internal/ingest-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_id: TEST_FEED_ID, run_id: TEST_RUN_ID, timestamp: Date.now() }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 when HMAC signature is invalid', async () => {
      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = new NextRequest('http://localhost:3000/api/internal/ingest-feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ingest-Signature': 'deadbeef',
        },
        body: JSON.stringify({ feed_id: TEST_FEED_ID, run_id: TEST_RUN_ID, timestamp: Date.now() }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 when timestamp is expired (>60s old)', async () => {
      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET, -120_000);
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('returns 401 when INGEST_HMAC_SECRET is not configured', async () => {
      const savedSecret = process.env.INGEST_HMAC_SECRET;
      delete process.env.INGEST_HMAC_SECRET;

      // Re-import to pick up env change
      vi.resetModules();
      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(401);

      process.env.INGEST_HMAC_SECRET = savedSecret;
    });

    it('accepts valid HMAC signature with recent timestamp', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const { createFeedFetcher } = await import('@/lib/feeds/fetchers');
      const { checkFeedItemDuplicate } = await import('@/lib/feeds/dedup');
      const { checkIngestionBudget } = await import('@/lib/budget');
      const { validateFetchTarget } = await import('@/lib/ssrf');

      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            single: () => Promise.resolve({
              data: makeActiveFeed(),
              error: null,
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      (createFeedFetcher as ReturnType<typeof vi.fn>).mockReturnValue({
        fetch: vi.fn().mockResolvedValue({
          feed_id: TEST_FEED_ID,
          items: [],
          etag: null,
          last_modified: null,
          was_modified: true,
        }),
      });

      (checkFeedItemDuplicate as ReturnType<typeof vi.fn>).mockResolvedValue({
        isDuplicate: false, isUpdate: false, reason: null, existingSourceId: null, previousBriefId: null,
      });
      (checkIngestionBudget as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true, remaining: 50 });
      (validateFetchTarget as ReturnType<typeof vi.fn>).mockResolvedValue({ valid: true });

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      // Should get past auth (200 with success, not 401)
      expect(res.status).not.toBe(401);
    });
  });

  describe('feed loading', () => {
    it('returns skipped response when feed is_active is false', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: () => ({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            single: () => Promise.resolve({
              data: {
                id: TEST_FEED_ID,
                is_active: false,
                feed_url: 'https://example.gov/feed.rss',
                feed_type: 'rss',
              },
              error: null,
            }),
          }),
        }),
      });

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      const body = await res.json();
      expect(body.type).toBe('skipped');
      expect(body.reason).toBe('disabled');
    });

    it('returns 404 when feed is not found', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: () => ({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      });

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      expect(res.status).toBe(404);
    });
  });

  describe('item processing', () => {
    async function setupMocks(options: {
      feedOverrides?: Record<string, unknown>;
      fetchItems?: ReturnType<typeof makeFeedItem>[];
      dedupResult?: Awaited<ReturnType<typeof import('@/lib/feeds/dedup').checkFeedItemDuplicate>>;
      budgetResult?: { allowed: boolean; remaining: number };
      ssrfResult?: { valid: boolean; error?: string };
      headResponse?: ReturnType<typeof makePdfHeadResponse>;
      getResponse?: ReturnType<typeof makePdfGetResponse>;
      extractedText?: string;
      contentHash?: string;
      pipelineResult?: Partial<import('@/lib/pipeline').PipelineResult>;
    } = {}) {
      const { getServerClient } = await import('@/lib/supabase');
      const { createFeedFetcher } = await import('@/lib/feeds/fetchers');
      const { checkFeedItemDuplicate } = await import('@/lib/feeds/dedup');
      const { checkIngestionBudget } = await import('@/lib/budget');
      const { validateFetchTarget } = await import('@/lib/ssrf');
      const { extractTextFromPDF, hashText } = await import('@/lib/pdf-extract');
      const { processCivicDocument } = await import('@/lib/pipeline');

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            single: () =>
              Promise.resolve({ data: makeActiveFeed(options.feedOverrides ?? {}), error: null }),
          }),
          update: updateMock,
          insert: insertMock,
        }),
      });

      const items = options.fetchItems ?? [makeFeedItem()];
      (createFeedFetcher as ReturnType<typeof vi.fn>).mockReturnValue({
        fetch: vi.fn().mockResolvedValue({
          feed_id: TEST_FEED_ID,
          items,
          etag: 'etag-abc',
          last_modified: 'Thu, 01 Jan 2026 00:00:00 GMT',
          was_modified: true,
        }),
      });

      (checkFeedItemDuplicate as ReturnType<typeof vi.fn>).mockResolvedValue(
        options.dedupResult ?? {
          isDuplicate: false, isUpdate: false, reason: null, existingSourceId: null, previousBriefId: null,
        }
      );

      (checkIngestionBudget as ReturnType<typeof vi.fn>).mockResolvedValue(
        options.budgetResult ?? { allowed: true, remaining: 50 }
      );

      (validateFetchTarget as ReturnType<typeof vi.fn>).mockResolvedValue(
        options.ssrfResult ?? { valid: true }
      );

      const headResponse = options.headResponse ?? makePdfHeadResponse();
      const getResponse = options.getResponse ?? makePdfGetResponse();

      global.fetch = vi.fn()
        .mockResolvedValueOnce(headResponse)
        .mockResolvedValueOnce(getResponse);

      (extractTextFromPDF as ReturnType<typeof vi.fn>).mockReturnValue(
        options.extractedText ?? 'Extracted civic document text'
      );
      (hashText as ReturnType<typeof vi.fn>).mockReturnValue(
        options.contentHash ?? TEST_CONTENT_HASH
      );

      (processCivicDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
        source_id: 'source-abc',
        brief_ids: [{ language: 'en', brief_id: 'brief-en-1' }, { language: 'es', brief_id: 'brief-es-1' }],
        verification: { confidence_score: 0.88, confidence_level: 'high' },
        content: { title: 'Test' } as import('@/lib/types').CivicContent,
        translations: [],
        previous_version_id: null,
        ...(options.pipelineResult ?? {}),
      });

      return { insertMock, updateMock, updateEqMock };
    }

    it('processes feed items and returns success count', async () => {
      await setupMocks();

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.type).toBe('success');
      expect(body.items_processed).toBe(1);
      expect(body.new_briefs).toBe(2); // en + es
    });

    it('skips duplicate items', async () => {
      await setupMocks({
        dedupResult: {
          isDuplicate: true,
          isUpdate: false,
          reason: 'duplicate_url',
          existingSourceId: 'existing-source',
          previousBriefId: null,
        },
      });

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      const body = await res.json();

      expect(body.type).toBe('success');
      expect(body.items_processed).toBe(0);
    });

    it('validates item URLs through SSRF check', async () => {
      await setupMocks({
        ssrfResult: { valid: false, error: 'URL resolves to a private/internal IP address (10.0.0.1).' },
      });

      const { processCivicDocument } = await import('@/lib/pipeline');

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      const body = await res.json();

      expect(body.type).toBe('success');
      expect(body.items_processed).toBe(0);
      // Pipeline should not have been called
      expect(processCivicDocument).not.toHaveBeenCalled();
    });

    it('rejects non-PDF content types', async () => {
      await setupMocks({
        headResponse: makePdfHeadResponse({ contentType: 'text/html' }),
      });

      const { processCivicDocument } = await import('@/lib/pipeline');

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      const body = await res.json();

      expect(body.type).toBe('success');
      expect(body.items_processed).toBe(0);
      expect(processCivicDocument).not.toHaveBeenCalled();
    });

    it('stops when budget is exceeded', async () => {
      const items = [makeFeedItem(TEST_SOURCE_URL, 'guid-1'), makeFeedItem('https://example.gov/doc2.pdf', 'guid-2')];

      const { getServerClient } = await import('@/lib/supabase');
      const { createFeedFetcher } = await import('@/lib/feeds/fetchers');
      const { checkFeedItemDuplicate } = await import('@/lib/feeds/dedup');
      const { checkIngestionBudget } = await import('@/lib/budget');
      const { validateFetchTarget } = await import('@/lib/ssrf');
      const { extractTextFromPDF, hashText } = await import('@/lib/pdf-extract');
      const { processCivicDocument } = await import('@/lib/pipeline');

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            single: () => Promise.resolve({ data: makeActiveFeed(), error: null }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
          insert: insertMock,
        }),
      });

      (createFeedFetcher as ReturnType<typeof vi.fn>).mockReturnValue({
        fetch: vi.fn().mockResolvedValue({
          feed_id: TEST_FEED_ID,
          items,
          etag: null,
          last_modified: null,
          was_modified: true,
        }),
      });

      (checkFeedItemDuplicate as ReturnType<typeof vi.fn>).mockResolvedValue({
        isDuplicate: false, isUpdate: false, reason: null, existingSourceId: null, previousBriefId: null,
      });

      // Budget exceeded on first check
      (checkIngestionBudget as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: false, remaining: 0 });

      (validateFetchTarget as ReturnType<typeof vi.fn>).mockResolvedValue({ valid: true });

      global.fetch = vi.fn()
        .mockResolvedValue(makePdfHeadResponse())
        .mockResolvedValue(makePdfGetResponse());

      (extractTextFromPDF as ReturnType<typeof vi.fn>).mockReturnValue('text');
      (hashText as ReturnType<typeof vi.fn>).mockReturnValue(TEST_CONTENT_HASH);
      (processCivicDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
        source_id: 'src', brief_ids: [], verification: { confidence_score: 0.9, confidence_level: 'high' },
        content: {} as import('@/lib/types').CivicContent, translations: [], previous_version_id: null,
      });

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      const body = await res.json();

      // Budget exceeded immediately: 0 items processed
      expect(body.type).toBe('success');
      expect(body.items_processed).toBe(0);
      expect(processCivicDocument).not.toHaveBeenCalled();
    });
  });

  describe('post-processing', () => {
    async function setupPostProcessingMocks(feedOverrides: Record<string, unknown> = {}) {
      const { getServerClient } = await import('@/lib/supabase');
      const { createFeedFetcher } = await import('@/lib/feeds/fetchers');
      const { checkFeedItemDuplicate } = await import('@/lib/feeds/dedup');
      const { checkIngestionBudget } = await import('@/lib/budget');
      const { validateFetchTarget } = await import('@/lib/ssrf');
      const { extractTextFromPDF, hashText } = await import('@/lib/pdf-extract');
      const { processCivicDocument } = await import('@/lib/pipeline');

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      const fromMock = vi.fn().mockReturnValue({
        select: () => ({
          eq: vi.fn().mockReturnThis(),
          single: () =>
            Promise.resolve({ data: makeActiveFeed(feedOverrides), error: null }),
        }),
        update: updateMock,
        insert: insertMock,
      });

      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromMock });

      (createFeedFetcher as ReturnType<typeof vi.fn>).mockReturnValue({
        fetch: vi.fn().mockResolvedValue({
          feed_id: TEST_FEED_ID,
          items: [makeFeedItem()],
          etag: 'etag-123',
          last_modified: 'Thu, 01 Jan 2026 00:00:00 GMT',
          was_modified: true,
        }),
      });

      (checkFeedItemDuplicate as ReturnType<typeof vi.fn>).mockResolvedValue({
        isDuplicate: false, isUpdate: false, reason: null, existingSourceId: null, previousBriefId: null,
      });
      (checkIngestionBudget as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true, remaining: 50 });
      (validateFetchTarget as ReturnType<typeof vi.fn>).mockResolvedValue({ valid: true });

      global.fetch = vi.fn()
        .mockResolvedValueOnce(makePdfHeadResponse())
        .mockResolvedValueOnce(makePdfGetResponse());

      (extractTextFromPDF as ReturnType<typeof vi.fn>).mockReturnValue('text content');
      (hashText as ReturnType<typeof vi.fn>).mockReturnValue(TEST_CONTENT_HASH);
      (processCivicDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
        source_id: 'source-abc',
        brief_ids: [{ language: 'en', brief_id: 'brief-en-1' }],
        verification: { confidence_score: 0.9, confidence_level: 'high' },
        content: { title: 'Test' } as import('@/lib/types').CivicContent,
        translations: [],
        previous_version_id: null,
      });

      return { fromMock, insertMock, updateMock, updateEqMock };
    }

    it('updates feed.last_polled_at after processing', async () => {
      const { fromMock, updateMock } = await setupPostProcessingMocks();

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      await POST(req);

      // Verify feed update was called with last_polled_at
      const feedsUpdateCall = fromMock.mock.calls.find(
        (call: string[]) => call[0] === 'feeds'
      );
      expect(feedsUpdateCall).toBeDefined();
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ last_polled_at: expect.any(String) })
      );
    });

    it('resets consecutive_failures to 0 on success', async () => {
      const { updateMock } = await setupPostProcessingMocks({ consecutive_failures: 3 });

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      await POST(req);

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ consecutive_failures: 0 })
      );
    });

    it('increments consecutive_failures when fetcher throws', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const { createFeedFetcher } = await import('@/lib/feeds/fetchers');

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            single: () =>
              Promise.resolve({ data: makeActiveFeed({ consecutive_failures: 1 }), error: null }),
          }),
          update: updateMock,
          insert: insertMock,
        }),
      });

      (createFeedFetcher as ReturnType<typeof vi.fn>).mockReturnValue({
        fetch: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      const body = await res.json();

      expect(body.type).toBe('error');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ consecutive_failures: 2 })
      );
    });

    it('disables feed (is_active=false) at 5 consecutive failures', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const { createFeedFetcher } = await import('@/lib/feeds/fetchers');

      const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateEqMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            single: () =>
              Promise.resolve({ data: makeActiveFeed({ consecutive_failures: 4 }), error: null }),
          }),
          update: updateMock,
          insert: insertMock,
        }),
      });

      (createFeedFetcher as ReturnType<typeof vi.fn>).mockReturnValue({
        fetch: vi.fn().mockRejectedValue(new Error('Persistent failure')),
      });

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      await POST(req);

      // Should set is_active=false when consecutive_failures reaches 5
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ consecutive_failures: 5, is_active: false })
      );
    });

    it('writes results to feed_poll_run_items table', async () => {
      const { insertMock } = await setupPostProcessingMocks();

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      await POST(req);

      // Verify feed_poll_run_items insert was called
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          run_id: TEST_RUN_ID,
          feed_id: TEST_FEED_ID,
          status: expect.stringMatching(/^(completed|failed)$/),
          items_found: expect.any(Number),
          items_processed: expect.any(Number),
          items_skipped: expect.any(Number),
          new_briefs_created: expect.any(Number),
          duration_ms: expect.any(Number),
        })
      );
    });
  });
});
