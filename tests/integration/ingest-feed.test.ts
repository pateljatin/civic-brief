import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { TEST_HMAC_SECRET, TEST_FEED_ID, TEST_RUN_ID } from '../helpers/constants';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn(),
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
      // Mock feed lookup to return a valid active feed
      (getServerClient as any).mockReturnValue({
        from: () => ({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            single: () => Promise.resolve({
              data: {
                id: TEST_FEED_ID,
                is_active: true,
                feed_url: 'https://example.gov/feed.rss',
                feed_type: 'rss',
                max_items_per_poll: 10,
              },
              error: null,
            }),
          }),
        }),
      });

      const { POST } = await import('@/app/api/internal/ingest-feed/route');
      const req = createSignedRequest(TEST_FEED_ID, TEST_RUN_ID, TEST_HMAC_SECRET);
      const res = await POST(req);
      // Should get past auth (200 with success stub, not 401)
      expect(res.status).not.toBe(401);
    });
  });

  describe('feed loading', () => {
    it('returns skipped response when feed is_active is false', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockReturnValue({
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
      (getServerClient as any).mockReturnValue({
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
});
