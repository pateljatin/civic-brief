/**
 * Integration tests for POST /api/feedback
 *
 * These test the actual route handler with mocked Supabase and auth.
 * They verify the full request/response cycle: auth, validation,
 * DB operations, error handling, and threshold triggers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock Setup ──

const MOCK_USER_ID = '11111111-1111-1111-1111-111111111111';
const MOCK_BRIEF_ID = '22222222-2222-2222-2222-222222222222';
const MOCK_SOURCE_ID = '33333333-3333-3333-3333-333333333333';

// Track mock DB state
let mockFeedbackRows: Array<{
  brief_id: string;
  user_id: string;
  feedback_type: string;
  details: string | null;
}> = [];

// Chainable Supabase query builder mock
function createQueryBuilder(overrides: Record<string, unknown> = {}) {
  const builder: Record<string, unknown> = {};
  const chainMethods = ['from', 'select', 'eq', 'neq', 'in', 'not', 'insert', 'limit', 'single', 'maybeSingle'];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Default select returns brief data
  builder.single = vi.fn().mockResolvedValue({
    data: {
      id: MOCK_BRIEF_ID,
      version: 1,
      language_id: 1,
      source_id: MOCK_SOURCE_ID,
      languages: { bcp47: 'en' },
    },
    error: null,
  });

  // Default insert succeeds
  builder.insert = vi.fn().mockResolvedValue({ error: null });

  // Count query for threshold checks
  builder.select = vi.fn().mockImplementation((selectStr: string) => {
    if (selectStr === '*' || (typeof arguments !== 'undefined' && selectStr?.includes?.('count'))) {
      // Return a builder that resolves with count
      const countBuilder = { ...builder };
      countBuilder.eq = vi.fn().mockReturnValue(countBuilder);
      countBuilder.in = vi.fn().mockReturnValue(countBuilder);
      countBuilder.not = vi.fn().mockReturnValue(countBuilder);
      // Count matching rows in mock state
      return countBuilder;
    }
    return builder;
  });

  Object.assign(builder, overrides);
  return builder;
}

// Create mock Supabase client
function createMockDb(overrides: {
  briefExists?: boolean;
  insertError?: { code: string; message: string } | null;
  feedbackCount?: number;
} = {}) {
  const { briefExists = true, insertError = null, feedbackCount = 0 } = overrides;

  const mockDb = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'briefs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: briefExists ? {
                    id: MOCK_BRIEF_ID,
                    version: 1,
                    language_id: 1,
                    source_id: MOCK_SOURCE_ID,
                    languages: { bcp47: 'en' },
                  } : null,
                  error: briefExists ? null : { code: 'PGRST116', message: 'not found' },
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'community_feedback') {
        return {
          insert: vi.fn().mockResolvedValue({ error: insertError }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                // For count queries
                count: feedbackCount,
              }),
              in: vi.fn().mockReturnValue({
                // For threshold count
                not: vi.fn().mockReturnValue({
                  data: [],
                  error: null,
                }),
                then: vi.fn(),
              }),
              not: vi.fn().mockReturnValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }

      return createQueryBuilder();
    }),
  };

  return mockDb;
}

// Mock modules
let mockUser: { id: string } | null = { id: MOCK_USER_ID };
let mockDb = createMockDb();

vi.mock('@/lib/supabase-server', () => ({
  createAuthServerClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
      }),
    },
  })),
}));

vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn().mockImplementation(() => mockDb),
}));

// Mock cookies (required by createAuthServerClient in real usage)
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

// Helper to create a NextRequest
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Import the handler AFTER mocks are set up
const { POST } = await import('@/app/api/feedback/route');

// ── Tests ──

describe('POST /api/feedback (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use a unique user ID per test to avoid rate limit interference
    mockUser = { id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    mockDb = createMockDb();
    mockFeedbackRows = [];
  });

  // ── Auth ──

  describe('authentication', () => {
    it('returns 401 when user is not signed in', async () => {
      mockUser = null;

      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
        feedbackType: 'helpful',
      }));

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toMatch(/sign in/i);
    });

    it('returns 401 when auth throws', async () => {
      const { createAuthServerClient } = await import('@/lib/supabase-server');
      vi.mocked(createAuthServerClient).mockRejectedValueOnce(new Error('Auth unavailable'));

      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
        feedbackType: 'helpful',
      }));

      expect(res.status).toBe(401);
    });
  });

  // ── Input Validation ──

  describe('input validation', () => {
    it('returns 422 for missing briefId', async () => {
      const res = await POST(makeRequest({
        feedbackType: 'helpful',
      }));

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toMatch(/brief id/i);
    });

    it('returns 422 for invalid briefId (not UUID)', async () => {
      const res = await POST(makeRequest({
        briefId: 'not-a-uuid',
        feedbackType: 'helpful',
      }));

      expect(res.status).toBe(422);
    });

    it('returns 422 for SQL injection in briefId', async () => {
      const res = await POST(makeRequest({
        briefId: "'; DROP TABLE briefs; --",
        feedbackType: 'helpful',
      }));

      expect(res.status).toBe(422);
    });

    it('returns 422 for missing feedbackType', async () => {
      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
      }));

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toMatch(/feedback type/i);
    });

    it('returns 422 for invalid feedbackType', async () => {
      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
        feedbackType: 'not_a_type',
      }));

      expect(res.status).toBe(422);
    });

    it('accepts all 6 valid feedback types', async () => {
      const types = ['factual_error', 'missing_info', 'misleading', 'translation_error', 'outdated', 'helpful'];

      for (const type of types) {
        // Reset mock DB for each iteration
        mockDb = createMockDb();
        const res = await POST(makeRequest({
          briefId: MOCK_BRIEF_ID,
          feedbackType: type,
        }));

        // Should not be a 422 (may be other status if DB mock is incomplete, but not validation failure)
        expect(res.status).not.toBe(422);
      }
    });
  });

  // ── Brief Lookup ──

  describe('brief lookup', () => {
    it('returns 404 when brief does not exist', async () => {
      mockDb = createMockDb({ briefExists: false });

      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
        feedbackType: 'helpful',
      }));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/not found/i);
    });
  });

  // ── Successful Submission ──

  describe('successful submission', () => {
    it('returns success with feedbackType', async () => {
      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
        feedbackType: 'helpful',
      }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.feedbackType).toBe('helpful');
    });

    it('returns success for factual_error with details', async () => {
      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
        feedbackType: 'factual_error',
        details: 'The tax rate is 8.4% not 8.2%',
      }));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.feedbackType).toBe('factual_error');
    });
  });

  // ── Duplicate Prevention ──

  describe('duplicate prevention', () => {
    it('returns 409 when user already submitted this feedback type', async () => {
      mockDb = createMockDb({
        insertError: { code: '23505', message: 'unique constraint violation' },
      });

      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
        feedbackType: 'helpful',
      }));

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/already submitted/i);
    });
  });

  // ── Details Sanitization ──

  describe('details sanitization', () => {
    it('accepts feedback without details', async () => {
      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
        feedbackType: 'missing_info',
      }));

      expect(res.status).toBe(200);
    });

    it('accepts feedback with valid details', async () => {
      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
        feedbackType: 'factual_error',
        details: 'The budget figure on page 3 is wrong.',
      }));

      expect(res.status).toBe(200);
    });
  });

  // ── Rate Limiting ──

  describe('rate limiting', () => {
    it('returns 429 after exceeding per-user limit', async () => {
      // Use a unique user ID to avoid interference from other tests
      const rateLimitUserId = '99999999-9999-9999-9999-' + Date.now().toString().slice(-12);
      mockUser = { id: rateLimitUserId };

      // Send 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        mockDb = createMockDb();
        await POST(makeRequest({
          briefId: MOCK_BRIEF_ID,
          feedbackType: 'helpful',
        }));
      }

      // 6th request should be rate limited
      mockDb = createMockDb();
      const res = await POST(makeRequest({
        briefId: MOCK_BRIEF_ID,
        feedbackType: 'factual_error',
      }));

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toMatch(/too many requests/i);
      expect(res.headers.get('Retry-After')).toBeTruthy();
    });
  });
});
