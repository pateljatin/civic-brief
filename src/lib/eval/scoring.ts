import type { ReadabilityResult } from './readability';

interface ToneInput {
  toneScore: number;
  jargonScore: number;
  jargonTerms: string[];
}

/** Weights for composite score computation. */
const WEIGHTS = {
  readability: 0.4,
  tone: 0.35,
  jargon: 0.25,
} as const;

/**
 * Convert FK grade level to a 0-1 normalized score.
 * Grade <= 8 is ideal (1.0). Higher grades penalize progressively.
 */
export function readabilityToNormalized(grade: number): number {
  if (grade <= 8) return 1.0;
  if (grade <= 9) return 0.7;
  if (grade <= 10) return 0.4;
  return 0.1;
}

/**
 * Compute the composite overall score from readability and tone results.
 *
 * When tone is null (Gemini hasn't responded yet), the score is based
 * on readability alone — the readability normalized value becomes the
 * overall score (since it's the only dimension available).
 *
 * Returns a value between 0 and 1, rounded to 2 decimal places.
 */
export function computeOverallScore(
  readability: ReadabilityResult,
  tone: ToneInput | null
): number {
  const readNorm = readabilityToNormalized(readability.grade);

  if (!tone) {
    // FK-only: readability is the entire score
    return Math.round(readNorm * 100) / 100;
  }

  const toneNorm = (tone.toneScore - 1) / 4;
  const jargonNorm = (tone.jargonScore - 1) / 4;

  const score =
    WEIGHTS.readability * readNorm +
    WEIGHTS.tone * toneNorm +
    WEIGHTS.jargon * jargonNorm;

  return Math.round(score * 100) / 100;
}
