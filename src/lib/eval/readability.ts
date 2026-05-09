import { syllable } from 'syllable';

export interface ReadabilityResult {
  /** Flesch-Kincaid Grade Level (lower = easier) */
  grade: number;
  /** Flesch Reading Ease (higher = easier, target >= 60) */
  ease: number;
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
}

/**
 * Compute Flesch-Kincaid readability scores for a text string.
 *
 * Input should be the combined brief section text (what_changed, who_affected,
 * what_to_do, budget_impact, deadlines, context), not the raw PDF text.
 *
 * Uses the same formulas mandated by US DoD and federal plain language guidelines.
 */
export function computeReadability(text: string): ReadabilityResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { grade: 0, ease: 0, wordCount: 0, sentenceCount: 0, syllableCount: 0 };
  }

  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  if (wordCount === 0) {
    return { grade: 0, ease: 0, wordCount: 0, sentenceCount: 0, syllableCount: 0 };
  }

  // Count sentences by terminal punctuation (.!?)
  const sentenceMatches = trimmed.match(/[.!?]+/g);
  const sentenceCount = Math.max(sentenceMatches ? sentenceMatches.length : 1, 1);

  // Count syllables using the syllable package
  const syllableCount = words.reduce((sum, word) => {
    // Strip punctuation for syllable counting
    const clean = word.replace(/[^a-zA-Z]/g, '');
    return sum + (clean ? syllable(clean) : 0);
  }, 0);

  // Flesch-Kincaid Grade Level
  const grade =
    0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;

  // Flesch Reading Ease
  const ease =
    206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);

  return {
    grade: Math.round(grade * 10) / 10,
    ease: Math.round(ease * 10) / 10,
    wordCount,
    sentenceCount,
    syllableCount,
  };
}
