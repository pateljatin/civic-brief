import { describe, it, expect } from 'vitest';
import { EvalDetailsSchema, EvalResultSchema } from '@/lib/eval/schemas';

describe('EvalDetailsSchema', () => {
  it('accepts valid eval details', () => {
    const valid = {
      readabilityGrade: 7.2,
      readabilityEase: 65.3,
      toneScore: 4,
      jargonScore: 5,
      jargonTerms: [],
      provider: 'deterministic-only',
    };
    expect(EvalDetailsSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts partial eval details (FK only, no tone yet)', () => {
    const partial = {
      readabilityGrade: 7.2,
      readabilityEase: 65.3,
      provider: 'deterministic-only',
    };
    expect(EvalDetailsSchema.safeParse(partial).success).toBe(true);
  });

  it('rejects tone score outside 1-5 range', () => {
    const invalid = {
      readabilityGrade: 7.2,
      readabilityEase: 65.3,
      toneScore: 6,
      jargonScore: 3,
      jargonTerms: [],
      provider: 'gemini-2.5-flash',
    };
    expect(EvalDetailsSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects jargon score outside 1-5 range', () => {
    const invalid = {
      readabilityGrade: 7.2,
      readabilityEase: 65.3,
      toneScore: 4,
      jargonScore: 0,
      jargonTerms: [],
      provider: 'gemini-2.5-flash',
    };
    expect(EvalDetailsSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('EvalResultSchema', () => {
  it('accepts full eval result with computed fields', () => {
    const valid = {
      readabilityGrade: 7.2,
      readabilityEase: 65.3,
      toneScore: 4,
      jargonScore: 5,
      jargonTerms: ['appropriation'],
      provider: 'gemini-2.5-flash',
      overallScore: 0.85,
      scoredAt: '2026-04-27T12:00:00.000Z',
    };
    expect(EvalResultSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects overall score outside 0-1 range', () => {
    const invalid = {
      readabilityGrade: 7.2,
      readabilityEase: 65.3,
      toneScore: 4,
      jargonScore: 5,
      jargonTerms: [],
      provider: 'gemini-2.5-flash',
      overallScore: 1.5,
      scoredAt: '2026-04-27T12:00:00.000Z',
    };
    expect(EvalResultSchema.safeParse(invalid).success).toBe(false);
  });
});
