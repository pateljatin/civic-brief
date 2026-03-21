import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkIngestionBudget } from '@/lib/budget';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  getServerClient: vi.fn(),
}));

describe('budget', () => {
  describe('checkIngestionBudget', () => {
    beforeEach(() => {
      vi.resetModules();
      process.env.INGESTION_DAILY_LIMIT = '50';
    });

    it('allows processing when under daily limit', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockReturnValue({
        from: () => ({
          select: () => ({
            not: () => ({
              gte: () => Promise.resolve({ count: 10 }),
            }),
          }),
        }),
      });
      const result = await checkIngestionBudget();
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(40);
    });

    it('rejects when daily limit reached', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockReturnValue({
        from: () => ({
          select: () => ({
            not: () => ({
              gte: () => Promise.resolve({ count: 50 }),
            }),
          }),
        }),
      });
      const result = await checkIngestionBudget();
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('returns allowed when DB unavailable', async () => {
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockImplementation(() => { throw new Error('no DB'); });
      const result = await checkIngestionBudget();
      expect(result.allowed).toBe(true);
    });

    it('uses default limit of 50 when env var not set', async () => {
      delete process.env.INGESTION_DAILY_LIMIT;
      const { getServerClient } = await import('@/lib/supabase');
      (getServerClient as any).mockReturnValue({
        from: () => ({
          select: () => ({
            not: () => ({
              gte: () => Promise.resolve({ count: 0 }),
            }),
          }),
        }),
      });
      const result = await checkIngestionBudget();
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(50);
    });
  });
});
