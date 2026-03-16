import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──

const mockCookieStore = {
  getAll: vi.fn(() => []),
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const mockSignInWithIdToken = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signInWithIdToken: mockSignInWithIdToken,
    },
  })),
}));

// Must import after mocks are declared
import { GET } from '@/app/auth/callback/route';

// ── Helpers ──

function makeRequest(
  params: Record<string, string> = {},
  headers: Record<string, string> = {}
): Request {
  const url = new URL('https://civic-brief.vercel.app/auth/callback');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), {
    headers: new Headers(headers),
  }) as unknown as Request;
}

function redirectLocation(response: Response): string {
  return response.headers.get('location') ?? '';
}

// ── Tests ──

describe('auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: valid state cookie matching the request
    mockCookieStore.get.mockReturnValue({ value: 'valid-state-123' });
    mockSignInWithIdToken.mockResolvedValue({ error: null });
    // Default: successful Google token exchange
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id_token: 'google-id-token-abc',
            access_token: 'google-access-token-xyz',
          }),
      })
    );
  });

  describe('early exits', () => {
    it('redirects to /?auth_error=cancelled when code is missing', async () => {
      const res = await GET(makeRequest({}) as any);
      expect(res.status).toBe(307);
      expect(redirectLocation(res)).toContain('auth_error=cancelled');
    });

    it('redirects to /?auth_error=cancelled when Google returns error', async () => {
      const res = await GET(
        makeRequest({ error: 'access_denied', code: 'abc' }) as any
      );
      expect(res.status).toBe(307);
      expect(redirectLocation(res)).toContain('auth_error=cancelled');
    });
  });

  describe('CSRF state verification', () => {
    it('rejects when state param is missing', async () => {
      const res = await GET(makeRequest({ code: 'google-code' }) as any);
      expect(res.status).toBe(307);
      expect(redirectLocation(res)).toContain('auth_error=csrf');
    });

    it('rejects when state cookie is missing', async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      const res = await GET(
        makeRequest({ code: 'google-code', state: 'some-state' }) as any
      );
      expect(res.status).toBe(307);
      expect(redirectLocation(res)).toContain('auth_error=csrf');
    });

    it('rejects when state param does not match cookie', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'real-state' });
      const res = await GET(
        makeRequest({ code: 'google-code', state: 'forged-state' }) as any
      );
      expect(res.status).toBe(307);
      expect(redirectLocation(res)).toContain('auth_error=csrf');
    });

    it('deletes the state cookie after successful verification', async () => {
      const res = await GET(
        makeRequest({
          code: 'google-code',
          state: 'valid-state-123',
        }) as any
      );
      expect(mockCookieStore.delete).toHaveBeenCalledWith('oauth_state');
      expect(redirectLocation(res)).toContain('/upload');
    });
  });

  describe('Google token exchange', () => {
    it('redirects with auth_error=token_exchange when Google rejects the code', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 400 })
      );
      const res = await GET(
        makeRequest({
          code: 'bad-code',
          state: 'valid-state-123',
        }) as any
      );
      expect(res.status).toBe(307);
      expect(redirectLocation(res)).toContain('auth_error=token_exchange');
    });

    it('redirects with auth_error=no_id_token when response lacks id_token', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ access_token: 'at' }),
        })
      );
      const res = await GET(
        makeRequest({
          code: 'google-code',
          state: 'valid-state-123',
        }) as any
      );
      expect(res.status).toBe(307);
      expect(redirectLocation(res)).toContain('auth_error=no_id_token');
    });

    it('sends correct params to Google token endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id_token: 'id-tok',
            access_token: 'at',
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await GET(
        makeRequest({
          code: 'the-auth-code',
          state: 'valid-state-123',
        }) as any
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );

      const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
      expect(body.get('code')).toBe('the-auth-code');
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('redirect_uri')).toContain('/auth/callback');
    });
  });

  describe('Supabase signInWithIdToken', () => {
    it('calls signInWithIdToken with google provider and tokens', async () => {
      await GET(
        makeRequest({
          code: 'google-code',
          state: 'valid-state-123',
        }) as any
      );

      expect(mockSignInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'google-id-token-abc',
        access_token: 'google-access-token-xyz',
      });
    });

    it('redirects with auth_error=signin when Supabase rejects the token', async () => {
      mockSignInWithIdToken.mockResolvedValue({
        error: new Error('Invalid token'),
      });
      const res = await GET(
        makeRequest({
          code: 'google-code',
          state: 'valid-state-123',
        }) as any
      );
      expect(res.status).toBe(307);
      expect(redirectLocation(res)).toContain('auth_error=signin');
    });
  });

  describe('redirect after success', () => {
    it('redirects to /upload on success', async () => {
      const res = await GET(
        makeRequest({
          code: 'google-code',
          state: 'valid-state-123',
        }) as any
      );
      expect(res.status).toBe(307);
      expect(redirectLocation(res)).toContain('/upload');
    });

    it('uses x-forwarded-host when it is in the allowlist', async () => {
      const res = await GET(
        makeRequest(
          { code: 'google-code', state: 'valid-state-123' },
          { 'x-forwarded-host': 'civic-brief.vercel.app' }
        ) as any
      );
      expect(redirectLocation(res)).toBe(
        'https://civic-brief.vercel.app/upload'
      );
    });

    it('ignores x-forwarded-host when it is NOT in the allowlist', async () => {
      const res = await GET(
        makeRequest(
          { code: 'google-code', state: 'valid-state-123' },
          { 'x-forwarded-host': 'evil.com' }
        ) as any
      );
      const loc = redirectLocation(res);
      expect(loc).not.toContain('evil.com');
      expect(loc).toContain('/upload');
    });
  });
});
