# C16: Civic Eval Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score every civic brief for readability and tone at creation time, display quality badges in the UI.

**Architecture:** Shared eval module (`src/lib/eval/`) with deterministic FK readability + Gemini Flash tone scoring. FK runs synchronously in the pipeline; Gemini fires async (non-blocking). Hybrid DB storage: `eval_overall_score` column for queries, `eval_details` JSONB for dimension breakdown. New `QualityBadges` component renders alongside existing `ConfidenceScore`.

**Tech Stack:** Vitest, `syllable` (npm), AI SDK v6 (`ai` + `@ai-sdk/google`), Zod v4, Supabase Postgres, React 19, Next.js 16

---

## File Structure

### New Files
- `supabase/migrations/011_eval_scores.sql` — Migration: 3 new columns + index on briefs
- `src/lib/eval/schemas.ts` — Zod schemas for EvalDetails and EvalResult
- `src/lib/eval/readability.ts` — FK grade + ease computation (pure, deterministic)
- `src/lib/eval/tone.ts` — Gemini Flash tone/jargon prompt + structured output
- `src/lib/eval/scoring.ts` — Composite overall score computation
- `src/lib/eval/index.ts` — `scoreBrief()` orchestrator + re-exports
- `src/components/QualityBadges.tsx` — Reading level + tone badges
- `scripts/eval-briefs.ts` — Backfill script for existing briefs
- `tests/unit/eval-readability.test.ts` — FK readability unit tests
- `tests/unit/eval-scoring.test.ts` — Composite scoring unit tests
- `tests/unit/eval-schemas.test.ts` — Zod schema validation tests
- `tests/unit/quality-badges.test.tsx` — QualityBadges component tests
- `tests/integration/eval-tone.test.ts` — Gemini Flash integration smoke test

### Modified Files
- `src/lib/ai/schemas.ts` — Re-export eval schemas for backwards compat
- `src/lib/types.ts` — Add `EvalDetails` to `Brief` interface
- `src/lib/pipeline.ts` — Call `scoreBrief()` after brief creation
- `src/app/api/summarize/route.ts` — Call `scoreBrief()` after brief creation (non-pipeline path)
- `src/app/brief/[id]/page.tsx` — Fetch eval_details, pass to CivicBrief
- `src/components/CivicBrief.tsx` — Add `evalDetails` prop, render QualityBadges
- `src/lib/ui-strings.ts` — Add reading level + tone badge labels
- `package.json` — Add `syllable` dependency

---

### Task 1: Install syllable + migration

**Files:**
- Modify: `package.json`
- Create: `supabase/migrations/011_eval_scores.sql`

- [ ] **Step 1: Install syllable package**

```bash
npm install syllable
```

- [ ] **Step 2: Create migration file**

Create `supabase/migrations/011_eval_scores.sql`:

```sql
-- C16: Eval scoring columns on briefs
-- Hybrid strategy: dedicated columns for queryable fields, JSONB for dimension details.

ALTER TABLE briefs ADD COLUMN eval_overall_score NUMERIC(4,2);
ALTER TABLE briefs ADD COLUMN eval_scored_at TIMESTAMPTZ;
ALTER TABLE briefs ADD COLUMN eval_details JSONB DEFAULT '{}';

-- Partial index: only index rows that have been scored
CREATE INDEX idx_briefs_eval_overall
  ON briefs (eval_overall_score)
  WHERE eval_overall_score IS NOT NULL;

COMMENT ON COLUMN briefs.eval_overall_score IS 'Composite quality score (0-1). Weighted: readability 40%, tone 35%, jargon 25%.';
COMMENT ON COLUMN briefs.eval_scored_at IS 'When the eval was last computed.';
COMMENT ON COLUMN briefs.eval_details IS 'Full eval dimension breakdown. Shape: {readabilityGrade, readabilityEase, toneScore, jargonScore, jargonTerms, provider}';
```

- [ ] **Step 3: Apply migration to Supabase**

```bash
npx supabase db query --linked -f supabase/migrations/011_eval_scores.sql
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json supabase/migrations/011_eval_scores.sql
git commit -m "feat(c16): add syllable dep + migration 011 for eval scoring columns"
```

---

### Task 2: Eval schemas (Zod)

**Files:**
- Create: `src/lib/eval/schemas.ts`
- Create: `tests/unit/eval-schemas.test.ts`
- Modify: `src/lib/ai/schemas.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/eval-schemas.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/eval-schemas.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/eval/schemas'`

- [ ] **Step 3: Write the schemas**

Create `src/lib/eval/schemas.ts`:

```typescript
import { z } from 'zod';

/**
 * Shape stored in briefs.eval_details JSONB.
 * Tone fields are optional because FK readability is computed first (sync),
 * and Gemini tone scoring backfills async.
 */
export const EvalDetailsSchema = z.object({
  readabilityGrade: z.number(),
  readabilityEase: z.number(),
  toneScore: z.number().min(1).max(5).optional(),
  jargonScore: z.number().min(1).max(5).optional(),
  jargonTerms: z.array(z.string()).optional(),
  provider: z.string(),
});

export type EvalDetails = z.infer<typeof EvalDetailsSchema>;

/**
 * Full eval result including computed fields.
 * Used internally by the eval pipeline, not stored directly.
 */
export const EvalResultSchema = EvalDetailsSchema.extend({
  overallScore: z.number().min(0).max(1),
  scoredAt: z.string().datetime(),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/eval-schemas.test.ts
```

Expected: PASS (all 6 tests)

- [ ] **Step 5: Update ai/schemas.ts to re-export**

In `src/lib/ai/schemas.ts`, replace the existing `EvalVisionResultSchema` and `EvalToneResultSchema` with re-exports:

```typescript
import { z } from 'zod';

// ─── Re-export eval schemas from canonical location ───
export { EvalDetailsSchema, EvalResultSchema } from '@/lib/eval/schemas';
export type { EvalDetails, EvalResult } from '@/lib/eval/schemas';

// Legacy schemas kept for any existing imports (remove in follow-up)
export const EvalVisionResultSchema = z.object({
  route: z.string(),
  layoutScore: z.number().min(1).max(5),
  colorCompliance: z.boolean(),
  fontCompliance: z.boolean(),
  mobileResponsive: z.boolean(),
  issues: z.array(z.string()),
  overall: z.enum(['pass', 'fail', 'warning']),
});

export type EvalVisionResult = z.infer<typeof EvalVisionResultSchema>;

export const EvalToneResultSchema = z.object({
  briefId: z.string(),
  toneScore: z.number().min(1).max(5),
  jargonScore: z.number().min(1).max(5),
  jargonTerms: z.array(z.string()),
  readabilityGrade: z.number(),
  overall: z.enum(['pass', 'fail', 'warning']),
});

export type EvalToneResult = z.infer<typeof EvalToneResultSchema>;
```

- [ ] **Step 6: Run all existing tests to verify no regressions**

```bash
npx vitest run
```

Expected: all 374+ tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/eval/schemas.ts src/lib/ai/schemas.ts tests/unit/eval-schemas.test.ts
git commit -m "feat(c16): eval Zod schemas with partial support for async tone scoring"
```

---

### Task 3: FK readability module

**Files:**
- Create: `src/lib/eval/readability.ts`
- Create: `tests/unit/eval-readability.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/eval-readability.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/eval-readability.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/eval/readability'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/eval/readability.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/eval-readability.test.ts
```

Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/eval/readability.ts tests/unit/eval-readability.test.ts
git commit -m "feat(c16): FK readability scoring module with syllable-based computation"
```

---

### Task 4: Composite scoring module

**Files:**
- Create: `src/lib/eval/scoring.ts`
- Create: `tests/unit/eval-scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/eval-scoring.test.ts`:

```typescript
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
    // Grade 7 (1.0) * 0.4 = 0.4, tone/jargon weights redistributed: 0.4/0.4 = 1.0
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/eval-scoring.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/eval/scoring'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/eval/scoring.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/eval-scoring.test.ts
```

Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/eval/scoring.ts tests/unit/eval-scoring.test.ts
git commit -m "feat(c16): composite eval scoring with readability-weighted computation"
```

---

### Task 5: Gemini Flash tone/jargon module

**Files:**
- Create: `src/lib/eval/tone.ts`
- Create: `tests/integration/eval-tone.test.ts`

- [ ] **Step 1: Write the integration test**

Create `tests/integration/eval-tone.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { evaluateTone } from '@/lib/eval/tone';

const hasGeminiKey = !!process.env.GOOGLE_GENERATIVE_AI_KEY;

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
  it('skips when GOOGLE_GENERATIVE_AI_KEY is not set', () => {
    expect(hasGeminiKey).toBe(false);
  });
});
```

- [ ] **Step 2: Write the implementation**

Create `src/lib/eval/tone.ts`:

```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { infra } from '@/lib/ai/models';

export interface ToneResult {
  toneScore: number;
  jargonScore: number;
  jargonTerms: string[];
}

const ToneResponseSchema = z.object({
  toneScore: z.number().min(1).max(5),
  jargonScore: z.number().min(1).max(5),
  jargonTerms: z.array(z.string()),
});

const TONE_EVAL_PROMPT = `You are a plain-language evaluator for civic summaries. Score the following text on two dimensions.

**Tone (1-5):**
5 = Reads like a knowledgeable neighbor explaining local government over coffee
4 = Clear and accessible, minor stiffness
3 = Understandable but noticeably formal
2 = Reads like a government press release
1 = Reads like the original government document, dense and bureaucratic

**Jargon (1-5):**
5 = No jargon. A high school student would understand every word.
4 = One or two technical terms, but meaning is clear from context
3 = Several specialized terms that need explanation
2 = Frequently uses legal/government terminology without explanation
1 = Dense with unexplained technical, legal, or financial terms

**Jargon terms:** List any words or phrases a high school student would not understand.

Return JSON only.`;

/**
 * Evaluate a civic brief's tone and jargon level using Gemini Flash.
 * Returns scores (1-5) and a list of flagged jargon terms.
 */
export async function evaluateTone(briefText: string): Promise<ToneResult> {
  const result = await generateText({
    model: infra.evalTone,
    output: Output.object({ schema: ToneResponseSchema }),
    messages: [
      { role: 'system', content: TONE_EVAL_PROMPT },
      { role: 'user', content: briefText },
    ],
  });

  if (!result.output) {
    throw new Error('Gemini Flash returned no structured output for tone evaluation');
  }

  return result.output;
}
```

- [ ] **Step 3: Run integration test (requires GOOGLE_GENERATIVE_AI_KEY)**

```bash
npx vitest run tests/integration/eval-tone.test.ts
```

Expected: PASS (2 tests pass if key set, 1 skip test if not)

- [ ] **Step 4: Commit**

```bash
git add src/lib/eval/tone.ts tests/integration/eval-tone.test.ts
git commit -m "feat(c16): Gemini Flash tone/jargon evaluation with structured output"
```

---

### Task 6: Eval orchestrator (index.ts)

**Files:**
- Create: `src/lib/eval/index.ts`

- [ ] **Step 1: Write the orchestrator**

Create `src/lib/eval/index.ts`:

```typescript
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
```

- [ ] **Step 2: Run all tests to verify no regressions**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/eval/index.ts
git commit -m "feat(c16): eval orchestrator with sync/async scoring modes"
```

---

### Task 7: Pipeline integration

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/pipeline.ts`
- Modify: `src/app/api/summarize/route.ts`

- [ ] **Step 1: Update Brief type in types.ts**

Add eval fields to the `Brief` interface in `src/lib/types.ts`. After line 128 (after `created_at: string;`):

```typescript
  eval_overall_score: number | null;
  eval_scored_at: string | null;
  eval_details: Record<string, unknown> | null;
```

Add eval fields to the `SummarizeResult` non-duplicate variant. In the `brief` object inside `SummarizeResult`, after `confidence_level`:

```typescript
      evalDetails?: {
        readabilityGrade: number;
        readabilityEase: number;
      };
```

- [ ] **Step 2: Add eval scoring to pipeline.ts**

At the top of `src/lib/pipeline.ts`, add the import:

```typescript
import { scoreBriefSync, scoreBriefFull } from '@/lib/eval';
```

Add `evalDetails` to `PipelineResult` interface (after `previous_version_id`):

```typescript
  /** Eval scores computed for the English brief (FK readability + tone). */
  evalDetails?: { readabilityGrade: number; readabilityEase: number };
```

After the jurisdiction tagging block (after `await tagBriefJurisdictions(esBrief.id, ...)` around line 289), add eval scoring:

```typescript
  // Step 6: Eval scoring (FK sync + Gemini async)
  const briefTextForEval = buildSummaryText(civicContent);
  const syncEval = scoreBriefSync(briefTextForEval);

  // Write FK-only scores immediately
  Promise.resolve(
    db.from('briefs')
      .update({
        eval_overall_score: syncEval.overallScore,
        eval_scored_at: new Date().toISOString(),
        eval_details: syncEval.details,
      })
      .eq('id', enBrief.id)
  ).catch((err: unknown) => console.error('Failed to write FK eval scores:', err));

  // Fire Gemini tone scoring async (non-blocking, backfills scores)
  scoreBriefFull(briefTextForEval)
    .then((fullEval) => {
      Promise.resolve(
        db.from('briefs')
          .update({
            eval_overall_score: fullEval.overallScore,
            eval_scored_at: new Date().toISOString(),
            eval_details: fullEval.details,
          })
          .eq('id', enBrief.id)
      ).catch((err: unknown) => console.error('Failed to write full eval scores:', err));
    })
    .catch((err: unknown) => console.error('Full eval scoring failed:', err));
```

Update the return statement to include eval details:

```typescript
  return {
    source_id: source.id,
    brief_ids: [
      { language: 'en', brief_id: enBrief.id },
      { language: 'es', brief_id: esBrief.id },
    ],
    verification: {
      confidence_score: verification.confidence_score,
      confidence_level: verification.confidence_level,
    },
    content: civicContent,
    translations,
    previous_version_id: previousBriefId,
    evalDetails: {
      readabilityGrade: syncEval.details.readabilityGrade,
      readabilityEase: syncEval.details.readabilityEase,
    },
  };
```

- [ ] **Step 3: Update summarize route response**

In `src/app/api/summarize/route.ts`, add the import at the top:

```typescript
import { scoreBriefSync, scoreBriefFull } from '@/lib/eval';
```

In the `db` branch (around line 383), after the `logUsageEvent` call, add eval scoring (same pattern as pipeline.ts):

```typescript
      // Eval scoring (FK sync + Gemini async)
      const briefTextForEval = [
        civicContent.what_changed,
        civicContent.who_affected,
        civicContent.what_to_do,
        civicContent.money,
      ].filter(Boolean).join(' ');

      const syncEval = scoreBriefSync(briefTextForEval);

      // Write FK-only scores immediately
      Promise.resolve(
        db.from('briefs')
          .update({
            eval_overall_score: syncEval.overallScore,
            eval_scored_at: new Date().toISOString(),
            eval_details: syncEval.details,
          })
          .eq('id', enBrief.id)
      ).catch((err: unknown) => console.error('Failed to write FK eval scores:', err));

      // Fire Gemini tone scoring async (non-blocking)
      scoreBriefFull(briefTextForEval)
        .then((fullEval) => {
          Promise.resolve(
            db.from('briefs')
              .update({
                eval_overall_score: fullEval.overallScore,
                eval_scored_at: new Date().toISOString(),
                eval_details: fullEval.details,
              })
              .eq('id', enBrief.id)
          ).catch((err: unknown) => console.error('Failed to write full eval scores:', err));
        })
        .catch((err: unknown) => console.error('Full eval scoring failed:', err));
```

Add `evalDetails` to the JSON response (after `translations` in the response around line 394):

```typescript
        evalDetails: {
          readabilityGrade: syncEval.details.readabilityGrade,
          readabilityEase: syncEval.details.readabilityEase,
        },
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (pipeline tests mock DB, so eval writes are fire-and-forget)

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/pipeline.ts src/app/api/summarize/route.ts
git commit -m "feat(c16): wire eval scoring into pipeline and summarize route"
```

---

### Task 8: UI strings for quality badges

**Files:**
- Modify: `src/lib/ui-strings.ts`

- [ ] **Step 1: Add eval badge strings to UIStrings interface and all languages**

Add to the `UIStrings` interface:

```typescript
  readingLevel: string;
  plainLanguage: string;
  scoring: string;
```

Add to the `en` strings object:

```typescript
    readingLevel: 'Reading Level',
    plainLanguage: 'Plain Language',
    scoring: 'Scoring...',
```

Add to the `es` strings object:

```typescript
    readingLevel: 'Nivel de Lectura',
    plainLanguage: 'Lenguaje Sencillo',
    scoring: 'Evaluando...',
```

Add to the `hi` strings object:

```typescript
    readingLevel: 'पठन स्तर',
    plainLanguage: 'सरल भाषा',
    scoring: 'मूल्यांकन...',
```

- [ ] **Step 2: Run tests to verify no regressions**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/lib/ui-strings.ts
git commit -m "feat(c16): add eval badge UI strings for en/es/hi"
```

---

### Task 9: QualityBadges component

**Files:**
- Create: `src/components/QualityBadges.tsx`
- Create: `tests/unit/quality-badges.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/quality-badges.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QualityBadges from '@/components/QualityBadges';

describe('QualityBadges', () => {
  it('renders reading level badge with grade', () => {
    render(<QualityBadges evalDetails={{ readabilityGrade: 7.2, readabilityEase: 65 }} />);
    expect(screen.getByText(/Grade 7/)).toBeDefined();
  });

  it('renders tone badge when tone score is available', () => {
    render(
      <QualityBadges
        evalDetails={{
          readabilityGrade: 7.2,
          readabilityEase: 65,
          toneScore: 4,
          jargonScore: 5,
        }}
      />
    );
    expect(screen.getByText(/4\/5/)).toBeDefined();
  });

  it('shows scoring state when tone is not yet available', () => {
    render(<QualityBadges evalDetails={{ readabilityGrade: 7.2, readabilityEase: 65 }} />);
    expect(screen.getByText(/Scoring/)).toBeDefined();
  });

  it('renders nothing when evalDetails is null', () => {
    const { container } = render(<QualityBadges evalDetails={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('applies green color for grade <= 8', () => {
    render(<QualityBadges evalDetails={{ readabilityGrade: 7.0, readabilityEase: 70 }} />);
    const badge = screen.getByText(/Grade 7/).closest('div');
    expect(badge?.style.background).toContain('e9f5ec');
  });

  it('applies yellow color for grade 9-10', () => {
    render(<QualityBadges evalDetails={{ readabilityGrade: 9.5, readabilityEase: 55 }} />);
    const badge = screen.getByText(/Grade 10/).closest('div');
    expect(badge?.style.background).toContain('fef3e2');
  });

  it('applies red color for grade > 10', () => {
    render(<QualityBadges evalDetails={{ readabilityGrade: 12.0, readabilityEase: 30 }} />);
    const badge = screen.getByText(/Grade 12/).closest('div');
    expect(badge?.style.background).toContain('fee2e2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/quality-badges.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/QualityBadges'`

- [ ] **Step 3: Write the component**

Create `src/components/QualityBadges.tsx`:

```tsx
'use client';

import { getUIStrings } from '@/lib/ui-strings';

interface EvalDetailsProps {
  readabilityGrade: number;
  readabilityEase: number;
  toneScore?: number;
  jargonScore?: number;
}

interface QualityBadgesProps {
  evalDetails: EvalDetailsProps | null;
  lang?: string;
}

function getReadabilityColor(grade: number) {
  if (grade <= 8) {
    return {
      bg: 'var(--green-light, #e9f5ec)',
      color: 'var(--green, #2d6a4f)',
    };
  }
  if (grade <= 10) {
    return {
      bg: '#fef3e2',
      color: 'var(--accent, #b44d12)',
    };
  }
  return {
    bg: '#fee2e2',
    color: '#dc2626',
  };
}

function getToneColor(score: number) {
  if (score >= 4) {
    return {
      bg: 'var(--green-light, #e9f5ec)',
      color: 'var(--green, #2d6a4f)',
    };
  }
  if (score >= 3) {
    return {
      bg: '#fef3e2',
      color: 'var(--accent, #b44d12)',
    };
  }
  return {
    bg: '#fee2e2',
    color: '#dc2626',
  };
}

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 14px',
  borderRadius: '20px',
  fontSize: '13px',
  fontWeight: 600,
} as const;

const dotStyle = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
} as const;

export default function QualityBadges({ evalDetails, lang = 'en' }: QualityBadgesProps) {
  if (!evalDetails) return null;

  const ui = getUIStrings(lang);
  const roundedGrade = Math.round(evalDetails.readabilityGrade);
  const readColor = getReadabilityColor(evalDetails.readabilityGrade);
  const hasTone = evalDetails.toneScore != null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {/* Reading Level Badge */}
      <div
        style={{
          ...badgeStyle,
          background: readColor.bg,
          color: readColor.color,
        }}
      >
        <span aria-hidden="true" style={{ ...dotStyle, background: readColor.color }} />
        Grade {roundedGrade} {ui.readingLevel}
      </div>

      {/* Tone Badge */}
      {hasTone ? (
        <div
          style={{
            ...badgeStyle,
            background: getToneColor(evalDetails.toneScore!).bg,
            color: getToneColor(evalDetails.toneScore!).color,
          }}
        >
          <span
            aria-hidden="true"
            style={{ ...dotStyle, background: getToneColor(evalDetails.toneScore!).color }}
          />
          {ui.plainLanguage}: {evalDetails.toneScore}/5
        </div>
      ) : (
        <div
          style={{
            ...badgeStyle,
            background: 'var(--warm, #f5f0e8)',
            color: 'var(--muted, #8a8a92)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <span
            aria-hidden="true"
            style={{ ...dotStyle, background: 'var(--muted, #8a8a92)' }}
          />
          {ui.plainLanguage}: {ui.scoring}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/quality-badges.test.tsx
```

Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/QualityBadges.tsx tests/unit/quality-badges.test.tsx
git commit -m "feat(c16): QualityBadges component with reading level + tone badges"
```

---

### Task 10: Wire badges into CivicBrief + brief pages

**Files:**
- Modify: `src/components/CivicBrief.tsx`
- Modify: `src/app/brief/[id]/page.tsx`
- Modify: `src/app/showcase/[scenario]/page.tsx`

- [ ] **Step 1: Add evalDetails prop to CivicBrief**

In `src/components/CivicBrief.tsx`:

Add the import at the top:

```typescript
import QualityBadges from './QualityBadges';
```

Add to `CivicBriefProps` interface (after `generatedAt?: string;`):

```typescript
  evalDetails?: {
    readabilityGrade: number;
    readabilityEase: number;
    toneScore?: number;
    jargonScore?: number;
  } | null;
```

Add `evalDetails` to the destructured props in the component function (after `generatedAt`):

```typescript
  evalDetails,
```

In the header `<div>` that contains `ConfidenceScore` and `LanguageToggle` (around line 257-277), add `QualityBadges` after the `ConfidenceScore` component:

Replace the existing header div content (lines 258-277) with:

```tsx
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <ConfidenceScore score={confidenceScore} level={confidenceLevel} lang={activeLang} />
            <QualityBadges evalDetails={evalDetails ?? null} lang={activeLang} />
          </div>
          {displayLanguages.length > 1 && (
            <LanguageToggle
              current={activeLang}
              available={displayLanguages}
              onChange={handleLanguageChange}
              loading={translating || externalLoading}
            />
          )}
        </div>
```

- [ ] **Step 2: Update brief/[id]/page.tsx to fetch and pass eval data**

In `src/app/brief/[id]/page.tsx`:

Update the `getBrief` function's Supabase query to include eval columns. Add `eval_overall_score, eval_scored_at, eval_details` to the select string (around line 129):

```typescript
    const { data: brief } = await db
      .from('briefs')
      .select(`
        id,
        headline,
        summary,
        content,
        is_published,
        published_at,
        source_id,
        language_id,
        eval_overall_score,
        eval_scored_at,
        eval_details,
        sources (
          id,
          source_url,
          title,
          factuality_score,
          confidence_level
        ),
        languages (
          bcp47,
          name
        )
      `)
      .eq('id', id)
      .eq('is_published', true)
      .single();
```

In the `BriefPage` component, where `CivicBrief` is rendered for real briefs (around line 299), add the `evalDetails` prop:

```typescript
        evalDetails={briefData.eval_details ? {
          readabilityGrade: (briefData.eval_details as Record<string, unknown>).readabilityGrade as number,
          readabilityEase: (briefData.eval_details as Record<string, unknown>).readabilityEase as number,
          toneScore: (briefData.eval_details as Record<string, unknown>).toneScore as number | undefined,
          jargonScore: (briefData.eval_details as Record<string, unknown>).jargonScore as number | undefined,
        } : null}
```

For the mock/demo brief rendering (around line 247), add:

```typescript
          evalDetails={{ readabilityGrade: 7.2, readabilityEase: 65, toneScore: 4, jargonScore: 5 }}
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/CivicBrief.tsx src/app/brief/[id]/page.tsx
git commit -m "feat(c16): wire QualityBadges into CivicBrief and brief detail page"
```

---

### Task 11: Backfill script

**Files:**
- Create: `scripts/eval-briefs.ts`

- [ ] **Step 1: Write the backfill script**

Create `scripts/eval-briefs.ts`:

```typescript
/**
 * Backfill eval scores for existing briefs that have no eval data.
 *
 * Usage: npx tsx scripts/eval-briefs.ts [--dry-run] [--limit N]
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: GOOGLE_GENERATIVE_AI_KEY (for tone scoring; FK-only without it)
 */

import { createClient } from '@supabase/supabase-js';
import { scoreBriefSync, scoreBriefFull } from '../src/lib/eval';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 100;
const hasGemini = !!process.env.GOOGLE_GENERATIVE_AI_KEY;

async function main() {
  console.log(`Backfill eval scores (dry-run: ${dryRun}, limit: ${limit}, gemini: ${hasGemini})`);

  const { data: briefs, error } = await db
    .from('briefs')
    .select('id, content, headline')
    .is('eval_overall_score', null)
    .eq('is_published', true)
    .eq('language_id', 1) // English briefs only
    .limit(limit);

  if (error) {
    console.error('Failed to fetch briefs:', error);
    process.exit(1);
  }

  console.log(`Found ${briefs.length} briefs to score`);

  for (const brief of briefs) {
    const content = brief.content as Record<string, unknown>;
    const text = [
      content.what_changed,
      content.who_affected,
      content.what_to_do,
      content.money,
    ]
      .filter(Boolean)
      .join(' ');

    if (!text) {
      console.log(`  [skip] ${brief.id} — no content text`);
      continue;
    }

    try {
      const result = hasGemini
        ? await scoreBriefFull(text)
        : scoreBriefSync(text);

      console.log(
        `  [${dryRun ? 'dry' : 'ok'}] ${brief.id} — ` +
        `grade: ${result.details.readabilityGrade}, ` +
        `tone: ${result.details.toneScore ?? 'n/a'}, ` +
        `overall: ${result.overallScore}`
      );

      if (!dryRun) {
        await db
          .from('briefs')
          .update({
            eval_overall_score: result.overallScore,
            eval_scored_at: new Date().toISOString(),
            eval_details: result.details,
          })
          .eq('id', brief.id);
      }

      // Rate limit: 1s between Gemini calls
      if (hasGemini) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`  [error] ${brief.id}:`, err);
    }
  }

  console.log('Done.');
}

main();
```

- [ ] **Step 2: Test with dry run**

```bash
npx tsx scripts/eval-briefs.ts --dry-run --limit 5
```

Expected: prints found briefs and simulated scores without writing to DB

- [ ] **Step 3: Commit**

```bash
git add scripts/eval-briefs.ts
git commit -m "feat(c16): backfill script for scoring existing briefs"
```

---

### Task 12: Final integration test + verification

**Files:**
- None new (verification task)

- [ ] **Step 1: Run full unit test suite**

```bash
npx vitest run
```

Expected: all tests pass (380+ with new eval tests)

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Build the project**

```bash
npm run build
```

Expected: clean build, no errors

- [ ] **Step 4: Visual verification**

Start dev server and verify:
- `/brief/demo` shows quality badges (reading level + tone with mock data)
- Badges match the ConfidenceScore visual style (pill shape, colors)
- Badge row wraps properly on mobile viewport

```bash
npm run dev
```

- [ ] **Step 5: Run E2E tests**

```bash
npx playwright test
```

Expected: 84+ tests pass

- [ ] **Step 6: Commit any final adjustments**

```bash
git add -A
git commit -m "test(c16): verify eval integration across all test suites"
```

---

## Verification Checklist

- [ ] Migration 011 applied successfully
- [ ] `syllable` package installed
- [ ] FK readability scores simple text < grade 5
- [ ] FK readability scores complex text > grade 12
- [ ] Composite scoring weights: readability 40%, tone 35%, jargon 25%
- [ ] FK-only scoring works when Gemini is unavailable
- [ ] Pipeline fires eval non-blocking (brief response isn't delayed)
- [ ] Brief detail page fetches and renders eval_details
- [ ] QualityBadges renders green/yellow/red correctly per thresholds
- [ ] QualityBadges renders nothing when evalDetails is null
- [ ] QualityBadges shows "Scoring..." when tone is pending
- [ ] Demo brief page shows quality badges with mock data
- [ ] All existing tests still pass
- [ ] TypeScript compiles with 0 errors
- [ ] E2E tests pass on production build
