import { describe, it, expect } from 'vitest';
import { computeReadability } from '@/lib/eval/readability';

describe('computeReadability', () => {
  it('scores simple text at a low grade level', () => {
    // "The cat sat on the mat." — very simple language
    const result = computeReadability('The cat sat on the mat. The dog ran in the yard.');
    expect(result.grade).toBeLessThan(5);
    expect(result.ease).toBeGreaterThan(80);
    expect(result.wordCount).toBe(12);
    expect(result.sentenceCount).toBe(2);
  });

  it('scores complex text at a high grade level', () => {
    const complex =
      'The appropriation of fiduciary instruments necessitates comprehensive deliberation regarding jurisdictional compliance with constitutionally mandated procedural requirements.';
    const result = computeReadability(complex);
    expect(result.grade).toBeGreaterThan(12);
    expect(result.ease).toBeLessThan(30);
  });

  it('handles typical civic brief text in the target range', () => {
    const civic =
      'The city council voted to increase the property tax rate by 8 percent. This affects all homeowners in the city. The new rate takes effect on January 1. You can submit comments at the next public hearing on March 15.';
    const result = computeReadability(civic);
    expect(result.grade).toBeGreaterThanOrEqual(4);
    expect(result.grade).toBeLessThanOrEqual(10);
  });

  it('returns defaults for empty text', () => {
    const result = computeReadability('');
    expect(result.grade).toBe(0);
    expect(result.ease).toBe(0);
    expect(result.wordCount).toBe(0);
    expect(result.sentenceCount).toBe(0);
    expect(result.syllableCount).toBe(0);
  });

  it('handles single sentence without period', () => {
    const result = computeReadability('The budget increased by ten percent');
    expect(result.sentenceCount).toBe(1);
    expect(result.wordCount).toBe(6);
  });

  it('handles text with multiple sentence terminators', () => {
    const result = computeReadability('Is this a question? Yes! It is.');
    expect(result.sentenceCount).toBe(3);
  });
});
