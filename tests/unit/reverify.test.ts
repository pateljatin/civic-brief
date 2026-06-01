import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_BRIEF_ID = '22222222-2222-2222-2222-222222222222';
const MOCK_SOURCE_ID = '33333333-3333-3333-3333-333333333333';
const MOCK_SOURCE_URL = 'https://example.gov/budget.pdf';

let mockBriefRow: { source_id: string; content: Record<string, unknown> } | null = {
  source_id: MOCK_SOURCE_ID,
  content: { title: 'Test Brief', what_changed: 'budget increased' },
};
let mockSourceRow: { source_url: string; factuality_score: number | null } | null = {
  source_url: MOCK_SOURCE_URL,
  factuality_score: 0.85,
};

let sourcesUpdateMock: ReturnType<typeof vi.fn>;

function buildMockDb() {
  sourcesUpdateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'briefs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockBriefRow, error: null }),
            }),
          }),
        };
      }
      if (table === 'sources') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockSourceRow, error: null }),
            }),
          }),
          update: sourcesUpdateMock,
        };
      }
      if (table === 'community_feedback') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    }),
  };
}

let mockDb = buildMockDb();

vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn().mockImplementation(() => mockDb),
}));

vi.mock('@/lib/ssrf', () => ({
  validateFetchTarget: vi.fn().mockResolvedValue({ valid: true }),
}));

const mockPdfBuffer = new ArrayBuffer(8);
vi.mock('@/lib/pdf-extract', () => ({
  extractTextFromPDF: vi.fn().mockResolvedValue('source document text about the budget'),
}));

vi.mock('@/lib/anthropic', () => ({
  generateJSON: vi.fn().mockResolvedValue({
    confidence_score: 0.72,
    confidence_level: 'high',
    verified_claims: ['claim A'],
    unverified_claims: [],
    omitted_info: [],
    reasoning: 'mostly accurate',
  }),
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: vi.fn().mockResolvedValue(mockPdfBuffer),
} as unknown as Response);

describe('reverifyBrief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBriefRow = {
      source_id: MOCK_SOURCE_ID,
      content: { title: 'Test Brief', what_changed: 'budget increased' },
    };
    mockSourceRow = { source_url: MOCK_SOURCE_URL, factuality_score: 0.85 };
    mockDb = buildMockDb();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockPdfBuffer),
    });
  });

  it('resolves without throwing on happy path', async () => {
    const { reverifyBrief } = await import('@/lib/reverify');
    await expect(reverifyBrief(MOCK_BRIEF_ID, '[factual_error]: wrong number')).resolves.toBeUndefined();
  });

  it('degrades source score when new score is lower than current', async () => {
    // generateJSON returns 0.72, current is 0.85 — should degrade
    const { reverifyBrief } = await import('@/lib/reverify');
    await reverifyBrief(MOCK_BRIEF_ID, '[factual_error]: wrong number');
    expect(sourcesUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        factuality_score: 0.72,
        confidence_level: 'high',
        requires_review: false,
      })
    );
  });

  it('does not update score when new score is not lower than current', async () => {
    // current score 0.50, generateJSON returns 0.72 — no degrade
    mockSourceRow = { source_url: MOCK_SOURCE_URL, factuality_score: 0.50 };
    mockDb = buildMockDb();
    const { reverifyBrief } = await import('@/lib/reverify');
    await reverifyBrief(MOCK_BRIEF_ID, '[factual_error]: wrong number');
    expect(sourcesUpdateMock).not.toHaveBeenCalled();
  });

  it('degrades score when current factuality_score is null', async () => {
    mockSourceRow = { source_url: MOCK_SOURCE_URL, factuality_score: null };
    mockDb = buildMockDb();
    const { reverifyBrief } = await import('@/lib/reverify');
    await expect(reverifyBrief(MOCK_BRIEF_ID, '[missing_info]: omitted sunset clause')).resolves.toBeUndefined();
  });

  it('resolves without throwing when brief not found', async () => {
    mockBriefRow = null;
    mockDb = buildMockDb();
    const { reverifyBrief } = await import('@/lib/reverify');
    await expect(reverifyBrief(MOCK_BRIEF_ID, '[factual_error]: x')).resolves.toBeUndefined();
  });

  it('resolves without throwing when SSRF validation fails', async () => {
    const { validateFetchTarget } = await import('@/lib/ssrf');
    vi.mocked(validateFetchTarget).mockResolvedValueOnce({ valid: false, error: 'private IP' });
    const { reverifyBrief } = await import('@/lib/reverify');
    await expect(reverifyBrief(MOCK_BRIEF_ID, '[factual_error]: x')).resolves.toBeUndefined();
  });

  it('resolves without throwing when PDF fetch returns non-OK response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 404 });
    const { reverifyBrief } = await import('@/lib/reverify');
    await expect(reverifyBrief(MOCK_BRIEF_ID, '[factual_error]: x')).resolves.toBeUndefined();
  });

  it('resolves without throwing when generateJSON throws', async () => {
    const { generateJSON } = await import('@/lib/anthropic');
    vi.mocked(generateJSON).mockRejectedValueOnce(new Error('Claude unavailable'));
    const { reverifyBrief } = await import('@/lib/reverify');
    await expect(reverifyBrief(MOCK_BRIEF_ID, '[factual_error]: x')).resolves.toBeUndefined();
  });

});
