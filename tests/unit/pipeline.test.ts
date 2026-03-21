import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PipelineParams, PipelineResult } from '@/lib/pipeline';

// Mock all external dependencies
vi.mock('@/lib/anthropic', () => ({
  generateJSON: vi.fn(),
  MODEL: 'claude-sonnet-4-20250514',
  PROMPT_VERSION: 'civic-v1.0',
}));

vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn(),
}));

describe('pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('processCivicDocument', () => {
    it('returns PipelineResult with source_id and brief_ids', async () => {
      // Setup mocks
      const { generateJSON } = await import('@/lib/anthropic');
      const mockGenerateJSON = generateJSON as ReturnType<typeof vi.fn>;

      // First call: summarize
      mockGenerateJSON.mockResolvedValueOnce({
        title: 'Test Resolution',
        what_changed: 'A new policy was adopted.',
        who_affected: 'All residents.',
        what_to_do: 'Attend the next meeting.',
        money: '$1M allocated.',
        deadlines: ['2026-04-01'],
        document_type: 'resolution',
      });
      // Second call: verify
      mockGenerateJSON.mockResolvedValueOnce({
        confidence_score: 0.92,
        confidence_level: 'high',
        issues: [],
      });
      // Third call: translate
      mockGenerateJSON.mockResolvedValueOnce({
        title: 'Resolución de Prueba',
        what_changed: 'Se adoptó una nueva política.',
        who_affected: 'Todos los residentes.',
        what_to_do: 'Asistir a la próxima reunión.',
        money: '$1M asignado.',
        deadlines: ['2026-04-01'],
        document_type: 'resolution',
      });

      // Mock Supabase
      const { getServerClient } = await import('@/lib/supabase');
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi
            .fn()
            .mockResolvedValueOnce({ data: { id: 'source-1' }, error: null }) // source insert
            .mockResolvedValueOnce({ data: { id: 'brief-en' }, error: null }) // en brief
            .mockResolvedValueOnce({ data: { id: 'brief-es' }, error: null }), // es brief
        }),
      });
      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: { id: 1, slug: 'resolution' }, error: null }),
          }),
        }),
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { processCivicDocument } = await import('@/lib/pipeline');
      const result: PipelineResult = await processCivicDocument({
        extractedText: 'Test document text about a resolution.',
        contentHash: 'abc123',
        sourceUrl: 'https://seattle.gov/doc.pdf',
        jurisdictionId: '00000000-0000-0000-0000-000000000004',
      });

      expect(result.source_id).toBe('source-1');
      expect(result.brief_ids.length).toBeGreaterThan(0);
      expect(result.brief_ids.some((b) => b.language === 'en')).toBe(true);
      expect(result.verification.confidence_score).toBe(0.92);
    });

    it('works without database (returns null IDs)', async () => {
      const { generateJSON } = await import('@/lib/anthropic');
      const mockGenerateJSON = generateJSON as ReturnType<typeof vi.fn>;

      mockGenerateJSON.mockResolvedValueOnce({
        title: 'Test',
        what_changed: 'Change.',
        who_affected: 'Everyone.',
        what_to_do: 'Act.',
        money: null,
        deadlines: [],
        document_type: 'budget',
      });
      mockGenerateJSON.mockResolvedValueOnce({
        confidence_score: 0.85,
        confidence_level: 'high',
        issues: [],
      });
      mockGenerateJSON.mockResolvedValueOnce({
        title: 'Prueba',
        what_changed: 'Cambio.',
        who_affected: 'Todos.',
        what_to_do: 'Actuar.',
        money: null,
        deadlines: [],
        document_type: 'budget',
      });

      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('no DB');
      });

      const { processCivicDocument } = await import('@/lib/pipeline');
      const result: PipelineResult = await processCivicDocument({
        extractedText: 'Budget text.',
        contentHash: 'def456',
        sourceUrl: 'https://seattle.gov/budget.pdf',
      });

      expect(result.source_id).toBeNull();
      expect(result.brief_ids).toEqual([]);
      expect(result.verification.confidence_score).toBe(0.85);
      expect(result.content).toBeDefined();
      expect(result.translations).toBeDefined();
    });

    it('calls generateJSON exactly 3 times (summarize, verify, translate)', async () => {
      const { generateJSON } = await import('@/lib/anthropic');
      const mockGenerateJSON = generateJSON as ReturnType<typeof vi.fn>;

      mockGenerateJSON.mockResolvedValueOnce({
        title: 'T',
        what_changed: 'C',
        who_affected: 'W',
        what_to_do: 'A',
        money: null,
        deadlines: [],
        document_type: 'resolution',
      });
      mockGenerateJSON.mockResolvedValueOnce({
        confidence_score: 0.9,
        confidence_level: 'high',
        issues: [],
      });
      mockGenerateJSON.mockResolvedValueOnce({
        title: 'T',
        what_changed: 'C',
        who_affected: 'W',
        what_to_do: 'A',
        money: null,
        deadlines: [],
        document_type: 'resolution',
      });

      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('no DB');
      });

      const { processCivicDocument } = await import('@/lib/pipeline');
      await processCivicDocument({
        extractedText: 'Text.',
        contentHash: 'hash',
        sourceUrl: 'https://example.gov/doc.pdf',
      });

      expect(mockGenerateJSON).toHaveBeenCalledTimes(3);
    });

    it('truncates extractedText to MAX_TEXT_LENGTH before summarizing', async () => {
      const { generateJSON } = await import('@/lib/anthropic');
      const mockGenerateJSON = generateJSON as ReturnType<typeof vi.fn>;

      mockGenerateJSON.mockResolvedValue({
        title: 'T',
        what_changed: 'C',
        who_affected: 'W',
        what_to_do: 'A',
        money: null,
        deadlines: [],
        document_type: 'resolution',
        confidence_score: 0.9,
        confidence_level: 'high',
        issues: [],
      });

      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('no DB');
      });

      const { processCivicDocument } = await import('@/lib/pipeline');
      const oversizedText = 'x'.repeat(200_000);
      await processCivicDocument({
        extractedText: oversizedText,
        contentHash: 'hash',
        sourceUrl: 'https://example.gov/doc.pdf',
      });

      // The first call to generateJSON (summarize) should have text <= 100_000 chars
      const firstCallArgs = mockGenerateJSON.mock.calls[0];
      const userMessage: string = firstCallArgs[1];
      expect(userMessage.length).toBeLessThanOrEqual(100_100); // some overhead for prompt wrapper
    });

    it('includes ingestedByFeedId in source insert when provided', async () => {
      const { generateJSON } = await import('@/lib/anthropic');
      const mockGenerateJSON = generateJSON as ReturnType<typeof vi.fn>;

      mockGenerateJSON.mockResolvedValueOnce({
        title: 'Feed Doc',
        what_changed: 'Change.',
        who_affected: 'People.',
        what_to_do: 'Act.',
        money: null,
        deadlines: [],
        document_type: 'resolution',
      });
      mockGenerateJSON.mockResolvedValueOnce({
        confidence_score: 0.88,
        confidence_level: 'high',
        issues: [],
      });
      mockGenerateJSON.mockResolvedValueOnce({
        title: 'Doc de Feed',
        what_changed: 'Cambio.',
        who_affected: 'Gente.',
        what_to_do: 'Actuar.',
        money: null,
        deadlines: [],
        document_type: 'resolution',
      });

      const { getServerClient } = await import('@/lib/supabase');
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi
            .fn()
            .mockResolvedValueOnce({ data: { id: 'source-feed' }, error: null })
            .mockResolvedValueOnce({ data: { id: 'brief-en-feed' }, error: null })
            .mockResolvedValueOnce({ data: { id: 'brief-es-feed' }, error: null }),
        }),
      });
      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: { id: 1, slug: 'resolution' }, error: null }),
          }),
        }),
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { processCivicDocument } = await import('@/lib/pipeline');
      const feedId = 'feed-uuid-1234';
      await processCivicDocument({
        extractedText: 'Feed document text.',
        contentHash: 'feedhash',
        sourceUrl: 'https://seattle.gov/feed-doc.pdf',
        ingestedByFeedId: feedId,
      });

      // Verify the source insert included ingested_by_feed_id
      const insertCalls = mockInsert.mock.calls;
      const sourceInsert = insertCalls[0][0];
      expect(sourceInsert.ingested_by_feed_id).toBe(feedId);
    });

    it('sets previous_version_id on English brief when previousBriefId provided', async () => {
      const { generateJSON } = await import('@/lib/anthropic');
      const mockGenerateJSON = generateJSON as ReturnType<typeof vi.fn>;

      mockGenerateJSON.mockResolvedValueOnce({
        title: 'Updated Doc',
        what_changed: 'Updated.',
        who_affected: 'All.',
        what_to_do: 'Review.',
        money: null,
        deadlines: [],
        document_type: 'resolution',
      });
      mockGenerateJSON.mockResolvedValueOnce({
        confidence_score: 0.9,
        confidence_level: 'high',
        issues: [],
      });
      mockGenerateJSON.mockResolvedValueOnce({
        title: 'Doc Actualizado',
        what_changed: 'Actualizado.',
        who_affected: 'Todos.',
        what_to_do: 'Revisar.',
        money: null,
        deadlines: [],
        document_type: 'resolution',
      });

      const { getServerClient } = await import('@/lib/supabase');
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi
            .fn()
            .mockResolvedValueOnce({ data: { id: 'source-v2' }, error: null })
            .mockResolvedValueOnce({ data: { id: 'brief-en-v2' }, error: null })
            .mockResolvedValueOnce({ data: { id: 'brief-es-v2' }, error: null }),
        }),
      });
      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: { id: 1, slug: 'resolution' }, error: null }),
          }),
        }),
      });
      (getServerClient as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const { processCivicDocument } = await import('@/lib/pipeline');
      const prevId = 'prev-brief-id';
      const result = await processCivicDocument({
        extractedText: 'Updated document text.',
        contentHash: 'newhash',
        sourceUrl: 'https://seattle.gov/updated.pdf',
        previousBriefId: prevId,
      });

      expect(result.previous_version_id).toBe(prevId);

      // Verify the English brief insert included previous_version_id
      const insertCalls = mockInsert.mock.calls;
      const enBriefInsert = insertCalls[1][0]; // second insert = English brief
      expect(enBriefInsert.previous_version_id).toBe(prevId);
    });
  });
});
