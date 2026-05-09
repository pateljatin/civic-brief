import { describe, it, expect } from 'vitest';
import { evaluateTone } from '@/lib/eval/tone';

const hasGeminiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

describe.skipIf(!hasGeminiKey)('evaluateTone (Gemini Flash)', () => {
  it('scores plain-language civic text with high tone and jargon scores', async () => {
    const text =
      'The city council voted to increase the property tax rate by 8 percent. This affects all homeowners. You can submit comments at the next public hearing on March 15.';

    const result = await evaluateTone(text);

    expect(result.toneScore).toBeGreaterThanOrEqual(1);
    expect(result.toneScore).toBeLessThanOrEqual(5);
    expect(result.jargonScore).toBeGreaterThanOrEqual(1);
    expect(result.jargonScore).toBeLessThanOrEqual(5);
    expect(Array.isArray(result.jargonTerms)).toBe(true);
    // Plain text should score well
    expect(result.toneScore).toBeGreaterThanOrEqual(3);
    expect(result.jargonScore).toBeGreaterThanOrEqual(3);
  }, 30000);

  it('flags jargon in dense government text', async () => {
    const text =
      'The appropriation of fiduciary instruments pursuant to Section 4.2(b) of the Municipal Code necessitates comprehensive deliberation regarding jurisdictional compliance with constitutionally mandated procedural requirements for eminent domain proceedings.';

    const result = await evaluateTone(text);

    expect(result.toneScore).toBeLessThanOrEqual(3);
    expect(result.jargonTerms.length).toBeGreaterThan(0);
  }, 30000);
});

describe.skipIf(hasGeminiKey)('evaluateTone without API key', () => {
  it('skips when GOOGLE_GENERATIVE_AI_API_KEY is not set', () => {
    expect(hasGeminiKey).toBe(false);
  });
});
