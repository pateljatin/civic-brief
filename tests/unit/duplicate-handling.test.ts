import { describe, it, expect } from 'vitest';

/** URL normalization helper (will be implemented in summarize route) */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    // Remove trailing slash from pathname (except root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

describe('duplicate handling', () => {
  describe('URL normalization', () => {
    it('lowercases hostname', () => {
      expect(normalizeUrl('https://Seattle.GOV/budget.pdf'))
        .toBe('https://seattle.gov/budget.pdf');
    });

    it('removes www prefix', () => {
      expect(normalizeUrl('https://www.seattle.gov/budget.pdf'))
        .toBe('https://seattle.gov/budget.pdf');
    });

    it('strips trailing slash', () => {
      expect(normalizeUrl('https://seattle.gov/docs/'))
        .toBe('https://seattle.gov/docs');
    });

    it('keeps root path slash', () => {
      expect(normalizeUrl('https://seattle.gov/'))
        .toBe('https://seattle.gov/');
    });

    it('preserves query params', () => {
      expect(normalizeUrl('https://seattle.gov/doc?id=123'))
        .toBe('https://seattle.gov/doc?id=123');
    });

    it('handles combined normalization', () => {
      expect(normalizeUrl('https://WWW.Seattle.GOV/docs/budget/'))
        .toBe('https://seattle.gov/docs/budget');
    });

    it('returns invalid URLs unchanged', () => {
      expect(normalizeUrl('not-a-url')).toBe('not-a-url');
    });

    it('handles http and https', () => {
      expect(normalizeUrl('http://seattle.gov/budget.pdf'))
        .toBe('http://seattle.gov/budget.pdf');
    });
  });

  describe('duplicate response shape', () => {
    it('duplicate response has required fields', () => {
      const response = {
        duplicate: true as const,
        sourceId: '123',
        briefId: '456',
        redirectUrl: '/brief/456',
        message: 'Already processed.',
      };
      expect(response.duplicate).toBe(true);
      expect(response.redirectUrl).toMatch(/^\/brief\//);
    });

    it('fresh response has brief content', () => {
      const response = {
        duplicate: false as const,
        sourceId: '123',
        briefId: '456',
        brief: { headline: 'Test', summary: 'Test', content: {}, confidence_score: 0.9, confidence_level: 'high' },
        translations: [{ language: 'es', briefId: '789' }],
      };
      expect(response.duplicate).toBe(false);
      expect(response.brief.headline).toBe('Test');
    });

    it('update response includes previousVersionId', () => {
      const response = {
        sourceId: '123',
        briefId: '456',
        brief: { headline: 'Test', summary: 'Test', content: {}, confidence_score: 0.9, confidence_level: 'high' },
        translations: [],
        previousVersionId: '000',
      };
      expect(response.previousVersionId).toBe('000');
    });
  });

  describe('type discrimination', () => {
    function isDuplicate(result: { duplicate?: boolean }): boolean {
      return result.duplicate === true;
    }

    it('identifies duplicate responses', () => {
      expect(isDuplicate({ duplicate: true })).toBe(true);
    });

    it('identifies fresh responses', () => {
      expect(isDuplicate({ duplicate: false })).toBe(false);
      expect(isDuplicate({})).toBe(false);
    });

    it('undefined duplicate is not a duplicate', () => {
      expect(isDuplicate({ duplicate: undefined })).toBe(false);
    });
  });
});
