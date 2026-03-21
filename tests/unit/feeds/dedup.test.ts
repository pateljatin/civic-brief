import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkFeedItemDuplicate } from '@/lib/feeds/dedup';
import type { DedupResult } from '@/lib/feeds/dedup';

vi.mock('@/lib/supabase', () => ({ getServerClient: vi.fn() }));

describe('dedup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkFeedItemDuplicate', () => {
    it('returns duplicate_url when source_url exists with same hash', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: 'existing-source', content_hash: 'same-hash' },
        error: null,
      });
      (getServerClient as any).mockReturnValue({
        from: () => ({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: mockMaybeSingle,
          }),
        }),
      });

      const result = await checkFeedItemDuplicate('https://example.gov/doc.pdf', 'same-hash');
      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('duplicate_url');
      expect(result.existingSourceId).toBe('existing-source');
    });

    it('returns isUpdate when URL exists but hash differs', async () => {
      const { getServerClient } = await import('@/lib/supabase');

      // URL lookup returns existing source with different hash
      const mockUrlLookup = vi.fn().mockResolvedValue({
        data: { id: 'old-source', content_hash: 'old-hash' },
        error: null,
      });
      // Brief lookup for the old source
      const mockBriefLookup = vi.fn().mockResolvedValue({
        data: { id: 'old-brief-id' },
        error: null,
      });

      let callCount = 0;
      (getServerClient as any).mockReturnValue({
        from: (table: string) => ({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: () => {
              callCount++;
              if (callCount === 1) return mockUrlLookup();
              return mockBriefLookup();
            },
          }),
        }),
      });

      const result = await checkFeedItemDuplicate('https://example.gov/doc.pdf', 'new-hash');
      expect(result.isDuplicate).toBe(false);
      expect(result.isUpdate).toBe(true);
      expect(result.previousBriefId).toBe('old-brief-id');
    });

    it('returns duplicate_hash when hash exists at different URL', async () => {
      const { getServerClient } = await import('@/lib/supabase');

      let callCount = 0;
      (getServerClient as any).mockReturnValue({
        from: (table: string) => ({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: () => {
              callCount++;
              // First call: URL lookup - no match
              if (callCount === 1) return Promise.resolve({ data: null, error: null });
              // Second call: hash lookup - match found
              return Promise.resolve({
                data: { id: 'hash-match-source', source_url: 'https://other.gov/same-doc.pdf' },
                error: null,
              });
            },
          }),
        }),
      });

      const result = await checkFeedItemDuplicate('https://example.gov/doc.pdf', 'known-hash');
      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('duplicate_hash');
    });

    it('returns not duplicate for new URL and new hash', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockReturnValue({
        from: () => ({
          select: () => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await checkFeedItemDuplicate('https://new.gov/doc.pdf', 'new-hash');
      expect(result.isDuplicate).toBe(false);
      expect(result.isUpdate).toBe(false);
      expect(result.previousBriefId).toBeNull();
    });

    it('returns not duplicate when DB is unavailable', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockImplementation(() => { throw new Error('no DB'); });

      const result = await checkFeedItemDuplicate('https://example.gov/doc.pdf', 'hash');
      expect(result.isDuplicate).toBe(false);
      expect(result.isUpdate).toBe(false);
    });
  });
});
