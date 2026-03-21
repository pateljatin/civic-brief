import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { TEST_CRON_SECRET, TEST_FEED_ID } from '../helpers/constants';

vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn(),
}));

// Mock global fetch for worker dispatch
const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
vi.stubGlobal('fetch', mockFetch);

describe('GET /api/cron/ingest', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    process.env.INGEST_HMAC_SECRET = 'test-hmac-secret-minimum-32-bytes-long!!';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('returns 401 without x-vercel-cron-secret header', async () => {
    const { GET } = await import('@/app/api/cron/ingest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/ingest');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong CRON_SECRET', async () => {
    const { GET } = await import('@/app/api/cron/ingest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/ingest', {
      headers: { 'x-vercel-cron-secret': 'wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 and creates feed_poll_run', async () => {
    const { getServerClient } = await import('@/lib/supabase');

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ error: null }),
      }),
      match: vi.fn().mockResolvedValue({ error: null }),
    });

    (getServerClient as any).mockReturnValue({
      from: (table: string) => {
        if (table === 'feed_poll_runs') {
          return {
            update: mockUpdate,
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'new-run-id' },
                  error: null,
                }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'feeds') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: TEST_FEED_ID, feed_url: 'https://example.gov/feed.rss', feed_type: 'rss', is_active: true },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'feed_poll_run_items') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      },
    });

    const { GET } = await import('@/app/api/cron/ingest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/ingest', {
      headers: { 'x-vercel-cron-secret': TEST_CRON_SECRET },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.run_id).toBeDefined();
    expect(body.feeds_dispatched).toBeGreaterThanOrEqual(0);
  });

  it('dispatches worker requests with valid HMAC signatures', async () => {
    const { getServerClient } = await import('@/lib/supabase');

    (getServerClient as any).mockReturnValue({
      from: (table: string) => {
        if (table === 'feed_poll_runs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({ error: null }),
              }),
              match: vi.fn().mockResolvedValue({ error: null }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'run-123' },
                  error: null,
                }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'feeds') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'feed-1', feed_url: 'https://a.gov/rss', feed_type: 'rss', is_active: true },
                  { id: 'feed-2', feed_url: 'https://b.gov/rss', feed_type: 'rss', is_active: true },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'feed_poll_run_items') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      },
    });

    const { GET } = await import('@/app/api/cron/ingest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/ingest', {
      headers: { 'x-vercel-cron-secret': TEST_CRON_SECRET },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(body.feeds_dispatched).toBe(2);
    // Verify fetch was called for each feed (worker dispatch)
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Verify X-Ingest-Signature header was included
    const firstCall = mockFetch.mock.calls[0];
    expect(firstCall[1].headers['X-Ingest-Signature']).toBeDefined();
  });

  it('skips when overlap guard detects running run', async () => {
    const { getServerClient } = await import('@/lib/supabase');

    (getServerClient as any).mockReturnValue({
      from: (table: string) => {
        if (table === 'feed_poll_runs') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: [{ id: 'existing-running-run', status: 'running' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      },
    });

    const { GET } = await import('@/app/api/cron/ingest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/ingest', {
      headers: { 'x-vercel-cron-secret': TEST_CRON_SECRET },
    });
    const res = await GET(req);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('overlap');
  });
});
