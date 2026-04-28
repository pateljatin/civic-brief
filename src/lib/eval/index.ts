export { computeReadability } from './readability';
export type { ReadabilityResult } from './readability';
export { evaluateTone } from './tone';
export type { ToneResult } from './tone';
export { computeOverallScore, readabilityToNormalized } from './scoring';
export { EvalDetailsSchema, EvalResultSchema } from './schemas';
export type { EvalDetails, EvalResult } from './schemas';

import { computeReadability } from './readability';
import { evaluateTone } from './tone';
import { computeOverallScore } from './scoring';
import type { EvalDetails } from './schemas';

interface ScoreBriefResult {
  /** FK readability result (always available, synchronous). */
  details: EvalDetails;
  /** Composite overall score (0-1). */
  overallScore: number;
}

/**
 * Compute readability score synchronously.
 * Returns immediately with FK-only scores (no Gemini call).
 */
export function scoreBriefSync(briefText: string): ScoreBriefResult {
  const readability = computeReadability(briefText);
  const overallScore = computeOverallScore(readability, null);

  return {
    details: {
      readabilityGrade: readability.grade,
      readabilityEase: readability.ease,
      provider: 'deterministic-only',
    },
    overallScore,
  };
}

/**
 * Compute full eval scores including Gemini Flash tone scoring.
 * Falls back to FK-only if Gemini fails.
 */
export async function scoreBriefFull(briefText: string): Promise<ScoreBriefResult> {
  const readability = computeReadability(briefText);

  try {
    const tone = await evaluateTone(briefText);
    const overallScore = computeOverallScore(readability, tone);

    return {
      details: {
        readabilityGrade: readability.grade,
        readabilityEase: readability.ease,
        toneScore: tone.toneScore,
        jargonScore: tone.jargonScore,
        jargonTerms: tone.jargonTerms,
        provider: 'gemini-2.5-flash',
      },
      overallScore,
    };
  } catch (err) {
    console.error('Gemini tone eval failed, using FK-only:', err);
    const overallScore = computeOverallScore(readability, null);

    return {
      details: {
        readabilityGrade: readability.grade,
        readabilityEase: readability.ease,
        provider: 'deterministic-only',
      },
      overallScore,
    };
  }
}
