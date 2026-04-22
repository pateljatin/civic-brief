import { describe, it, expect } from 'vitest';
import {
  EvalVisionResultSchema,
  EvalToneResultSchema,
  type EvalVisionResult,
  type EvalToneResult,
} from '@/lib/ai/schemas';

describe('EvalVisionResultSchema', () => {
  const validVisionResult: EvalVisionResult = {
    route: '/',
    layoutScore: 4,
    colorCompliance: true,
    fontCompliance: true,
    mobileResponsive: true,
    issues: [],
    overall: 'pass',
  };

  it('accepts valid vision eval result', () => {
    const result = EvalVisionResultSchema.safeParse(validVisionResult);
    expect(result.success).toBe(true);
  });

  it('accepts result with issues', () => {
    const result = EvalVisionResultSchema.safeParse({
      ...validVisionResult,
      issues: ['Low contrast on nav links', 'Heading uses wrong font'],
      overall: 'warning',
    });
    expect(result.success).toBe(true);
  });

  it('rejects layoutScore outside 1-5 range', () => {
    const result = EvalVisionResultSchema.safeParse({
      ...validVisionResult,
      layoutScore: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects layoutScore above 5', () => {
    const result = EvalVisionResultSchema.safeParse({
      ...validVisionResult,
      layoutScore: 6,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid overall value', () => {
    const result = EvalVisionResultSchema.safeParse({
      ...validVisionResult,
      overall: 'maybe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = EvalVisionResultSchema.safeParse({
      route: '/',
      layoutScore: 4,
    });
    expect(result.success).toBe(false);
  });
});

describe('EvalToneResultSchema', () => {
  const validToneResult: EvalToneResult = {
    briefId: '550e8400-e29b-41d4-a716-446655440000',
    toneScore: 4,
    jargonScore: 5,
    jargonTerms: [],
    readabilityGrade: 7.2,
    overall: 'pass',
  };

  it('accepts valid tone eval result', () => {
    const result = EvalToneResultSchema.safeParse(validToneResult);
    expect(result.success).toBe(true);
  });

  it('accepts result with jargon terms found', () => {
    const result = EvalToneResultSchema.safeParse({
      ...validToneResult,
      jargonScore: 2,
      jargonTerms: ['ordinance', 'appropriation', 'amortization'],
      overall: 'fail',
    });
    expect(result.success).toBe(true);
  });

  it('rejects toneScore outside 1-5 range', () => {
    const result = EvalToneResultSchema.safeParse({
      ...validToneResult,
      toneScore: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing briefId', () => {
    const { briefId, ...noBriefId } = validToneResult;
    const result = EvalToneResultSchema.safeParse(noBriefId);
    expect(result.success).toBe(false);
  });
});
