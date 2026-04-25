import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase before importing the module under test.
vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn(),
}));

describe('rate-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // ── checkRateLimit ──────────────────────────────────────────────────────────

  describe('checkRateLimit', () => {
    it('allows first request and creates a new window', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: mockUpsert,
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { checkRateLimit } = await import('@/lib/rate-limit');
      const result = await checkRateLimit('ip:1.2.3.4', { maxRequests: 10, windowMs: 60_000 });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(mockUpsert).toHaveBeenCalledOnce();
    });

    it('allows requests under the limit and increments count', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const futureWindow = new Date(Date.now() + 60_000).toISOString();
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { count: 5, window_start: futureWindow, window_ms: 60_000 },
              error: null,
            }),
          }),
        }),
        update: mockUpdate,
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { checkRateLimit } = await import('@/lib/rate-limit');
      const result = await checkRateLimit('ip:1.2.3.4', { maxRequests: 10, windowMs: 60_000 });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 5 - 1
    });

    it('blocks requests at the limit', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const futureWindow = new Date(Date.now() + 60_000).toISOString();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { count: 10, window_start: futureWindow, window_ms: 60_000 },
              error: null,
            }),
          }),
        }),
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { checkRateLimit } = await import('@/lib/rate-limit');
      const result = await checkRateLimit('ip:1.2.3.4', { maxRequests: 10, windowMs: 60_000 });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('resets the window when the current window has expired', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      // Window started 2 minutes ago with a 1-minute duration — it's expired.
      const expiredWindow = new Date(Date.now() - 120_000).toISOString();
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { count: 10, window_start: expiredWindow, window_ms: 60_000 },
              error: null,
            }),
          }),
        }),
        update: mockUpdate,
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { checkRateLimit } = await import('@/lib/rate-limit');
      const result = await checkRateLimit('ip:1.2.3.4', { maxRequests: 10, windowMs: 60_000 });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // Fresh window, count reset to 1
      // The update should reset window_start and count
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ count: 1, window_ms: 60_000 })
      );
    });

    it('fails open when Supabase is not configured', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Supabase credentials not set');
      });

      const { checkRateLimit } = await import('@/lib/rate-limit');
      const result = await checkRateLimit('ip:1.2.3.4', { maxRequests: 10, windowMs: 60_000 });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('fails open when DB returns an error', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'connection refused' },
            }),
          }),
        }),
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { checkRateLimit } = await import('@/lib/rate-limit');
      const result = await checkRateLimit('ip:1.2.3.4', { maxRequests: 10, windowMs: 60_000 });

      expect(result.allowed).toBe(true);
    });

    it('uses default config when none is provided', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: mockUpsert,
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { checkRateLimit } = await import('@/lib/rate-limit');
      const result = await checkRateLimit('ip:1.2.3.4');

      // Default is 10 requests; first call leaves 9 remaining.
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  // ── rateLimitByIp ───────────────────────────────────────────────────────────

  describe('rateLimitByIp', () => {
    it('returns null when the request is allowed', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: mockUpsert,
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { rateLimitByIp } = await import('@/lib/rate-limit');
      const mockRequest = {
        headers: { get: (name: string) => (name === 'x-forwarded-for' ? '1.2.3.4' : null) },
      };
      const result = await rateLimitByIp(mockRequest);

      expect(result).toBeNull();
    });

    it('returns 429 NextResponse when limit is exceeded', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const futureWindow = new Date(Date.now() + 30_000).toISOString();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { count: 10, window_start: futureWindow, window_ms: 60_000 },
              error: null,
            }),
          }),
        }),
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { rateLimitByIp } = await import('@/lib/rate-limit');
      const mockRequest = {
        headers: { get: (name: string) => (name === 'x-forwarded-for' ? '5.6.7.8' : null) },
      };
      const result = await rateLimitByIp(mockRequest);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
    });

    it('extracts IP from x-real-ip when x-forwarded-for is absent', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: mockUpsert,
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { rateLimitByIp } = await import('@/lib/rate-limit');
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'x-real-ip') return '9.10.11.12';
            return null;
          },
        },
      };
      await rateLimitByIp(mockRequest);

      // The upsert key should contain the real-ip value
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'ip:9.10.11.12' })
      );
    });
  });

  // ── rateLimitByUserId ───────────────────────────────────────────────────────

  describe('rateLimitByUserId', () => {
    it('returns null when the user is under the limit', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: mockUpsert,
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { rateLimitByUserId } = await import('@/lib/rate-limit');
      const result = await rateLimitByUserId('user-uuid-abc');

      expect(result).toBeNull();
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'user:user-uuid-abc' })
      );
    });

    it('returns 429 when the user exceeds their limit', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const futureWindow = new Date(Date.now() + 45_000).toISOString();
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { count: 5, window_start: futureWindow, window_ms: 60_000 },
              error: null,
            }),
          }),
        }),
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { rateLimitByUserId } = await import('@/lib/rate-limit');
      // maxRequests=5, count is already 5
      const result = await rateLimitByUserId('user-uuid-abc', 5);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
    });
  });
});
