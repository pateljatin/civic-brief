import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { TEST_CRON_SECRET } from '../helpers/constants';

vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn(),
}));

// Hoist mockEmailSend so the constructor factory can close over it
const mockEmailSend = vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null });

vi.mock('resend', () => {
  return {
    Resend: function MockResend(_key: string) {
      return { emails: { send: mockEmailSend } };
    },
  };
});

describe('GET /api/cron/digest', () => {
  beforeAll(() => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockEmailSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });
    delete process.env.RESEND_API_KEY;
    delete process.env.ADMIN_EMAIL;
  });

  function makeDbMock() {
    return {
      from: (_table: string) => ({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };
  }

  it('returns 401 without x-vercel-cron-secret header', async () => {
    const { GET } = await import('@/app/api/cron/digest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/digest');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong cron secret', async () => {
    const { GET } = await import('@/app/api/cron/digest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/digest', {
      headers: { 'x-vercel-cron-secret': 'wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 503 when database is unavailable', async () => {
    const { getServerClient } = await import('@/lib/supabase');
    (getServerClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Supabase credentials not set');
    });

    const { GET } = await import('@/app/api/cron/digest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/digest', {
      headers: { 'x-vercel-cron-secret': TEST_CRON_SECRET },
    });
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it('returns 200 with valid CRON_SECRET and digest stats', async () => {
    const { getServerClient } = await import('@/lib/supabase');
    (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDbMock());

    process.env.RESEND_API_KEY = 'test-key';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    const { GET } = await import('@/app/api/cron/digest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/digest', {
      headers: { 'x-vercel-cron-secret': TEST_CRON_SECRET },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalRuns).toBeDefined();
    expect(body.periodStart).toBeDefined();
    expect(body.periodEnd).toBeDefined();
    expect(body.feedHealth).toBeDefined();
  });

  it('includes correct summary fields in response', async () => {
    const { getServerClient } = await import('@/lib/supabase');
    (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDbMock());

    const { GET } = await import('@/app/api/cron/digest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/digest', {
      headers: { 'x-vercel-cron-secret': TEST_CRON_SECRET },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(typeof body.totalRuns).toBe('number');
    expect(typeof body.totalProcessed).toBe('number');
    expect(typeof body.totalSkipped).toBe('number');
    expect(typeof body.totalErrors).toBe('number');
    expect(typeof body.totalNewBriefs).toBe('number');
    expect(Array.isArray(body.feedHealth)).toBe(true);
  });

  it('sends digest email when RESEND credentials are configured', async () => {
    const { getServerClient } = await import('@/lib/supabase');
    (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDbMock());

    process.env.RESEND_API_KEY = 'test-key';
    process.env.ADMIN_EMAIL = 'admin@test.com';

    const { GET } = await import('@/app/api/cron/digest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/digest', {
      headers: { 'x-vercel-cron-secret': TEST_CRON_SECRET },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockEmailSend).toHaveBeenCalledOnce();

    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toContain('Weekly Digest');
    expect(callArgs.to).toBe('admin@test.com');
  });

  it('skips email send when RESEND_API_KEY is not configured', async () => {
    const { getServerClient } = await import('@/lib/supabase');
    (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue(makeDbMock());

    delete process.env.RESEND_API_KEY;
    process.env.ADMIN_EMAIL = 'admin@test.com';

    const { GET } = await import('@/app/api/cron/digest/route');
    const req = new NextRequest('http://localhost:3000/api/cron/digest', {
      headers: { 'x-vercel-cron-secret': TEST_CRON_SECRET },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});
