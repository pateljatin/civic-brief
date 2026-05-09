import { describe, it, expect } from 'vitest';
import { computeOverallScore, readabilityToNormalized } from '@/lib/eval/scoring';

describe('readabilityToNormalized', () => {
  it('returns 1.0 for grade <= 8', () => {
    expect(readabilityToNormalized(7.2)).toBe(1.0);
    expect(readabilityToNormalized(8.0)).toBe(1.0);
  });

  it('returns 0.7 for grade 9', () => {
    expect(readabilityToNormalized(9.0)).toBe(0.7);
  });

  it('returns 0.4 for grade 10', () => {
    expect(readabilityToNormalized(10.0)).toBe(0.4);
  });

  it('returns 0.1 for grade > 10', () => {
    expect(readabilityToNormalized(11.0)).toBe(0.1);
    expect(readabilityToNormalized(15.0)).toBe(0.1);
  });
});

describe('computeOverallScore', () => {
  it('returns perfect score for ideal brief', () => {
    // Grade 7 (1.0) * 0.4 + tone 5 (1.0) * 0.35 + jargon 5 (1.0) * 0.25 = 1.0
    const score = computeOverallScore(
      { grade: 7.0, ease: 70, wordCount: 100, sentenceCount: 10, syllableCount: 130 },
      { toneScore: 5, jargonScore: 5, jargonTerms: [] }
    );
    expect(score).toBe(1.0);
  });

  it('returns low score for difficult, jargon-heavy brief', () => {
    // Grade 14 (0.1) * 0.4 + tone 1 (0.0) * 0.35 + jargon 1 (0.0) * 0.25 = 0.04
    const score = computeOverallScore(
      { grade: 14.0, ease: 20, wordCount: 100, sentenceCount: 5, syllableCount: 200 },
      { toneScore: 1, jargonScore: 1, jargonTerms: ['appropriation', 'fiduciary'] }
    );
    expect(score).toBe(0.04);
  });

  it('computes FK-only score when tone is not yet available', () => {
    // FK-only path: readability normalized (1.0 for grade <= 8) returned as-is, no weight redistribution
    const score = computeOverallScore(
      { grade: 7.0, ease: 70, wordCount: 100, sentenceCount: 10, syllableCount: 130 },
      null
    );
    expect(score).toBe(1.0);
  });

  it('returns 0.1 FK-only score for difficult text without tone', () => {
    const score = computeOverallScore(
      { grade: 14.0, ease: 20, wordCount: 100, sentenceCount: 5, syllableCount: 200 },
      null
    );
    expect(score).toBe(0.1);
  });

  it('handles boundary: grade exactly 8.0', () => {
    const score = computeOverallScore(
      { grade: 8.0, ease: 60, wordCount: 100, sentenceCount: 10, syllableCount: 140 },
      { toneScore: 4, jargonScore: 4, jargonTerms: [] }
    );
    // 1.0 * 0.4 + 0.75 * 0.35 + 0.75 * 0.25 = 0.4 + 0.2625 + 0.1875 = 0.85
    expect(score).toBe(0.85);
  });
});
