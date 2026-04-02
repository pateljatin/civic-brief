import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { TEST_CRON_SECRET } from '../helpers/constants';

vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn(),
}));

describe('GET /api/cron/keepalive', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without Authorization header', async () => {
    const { GET } = await import('@/app/api/cron/keepalive/route');
    const req = new NextRequest('http://localhost:3000/api/cron/keepalive');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong CRON_SECRET', async () => {
    const { GET } = await import('@/app/api/cron/keepalive/route');
    const req = new NextRequest('http://localhost:3000/api/cron/keepalive', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 and queries countries table', async () => {
    const { getServerClient } = await import('@/lib/supabase');
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [{ code: 'US' }], error: null }),
    });
    (getServerClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    const { GET } = await import('@/app/api/cron/keepalive/route');
    const req = new NextRequest('http://localhost:3000/api/cron/keepalive', {
      headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.rows).toBe(1);
    expect(body.timestamp).toBeDefined();
  });

  it('returns 500 when Supabase query fails', async () => {
    const { getServerClient } = await import('@/lib/supabase');
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection refused' } }),
    });
    (getServerClient as any).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    });

    const { GET } = await import('@/app/api/cron/keepalive/route');
    const req = new NextRequest('http://localhost:3000/api/cron/keepalive', {
      headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('connection refused');
  });

  it('returns 500 when CRON_SECRET is not set', async () => {
    const savedSecret = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    // Re-import to get fresh module
    vi.resetModules();
    const { GET } = await import('@/app/api/cron/keepalive/route');
    const req = new NextRequest('http://localhost:3000/api/cron/keepalive');
    const res = await GET(req);

    expect(res.status).toBe(500);
    process.env.CRON_SECRET = savedSecret;
  });
});
