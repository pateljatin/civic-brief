# C16: Civic Eval Agent Design Spec

**Date:** 2026-04-25
**Issue:** #55
**Status:** Draft
**Author:** Jatin + Engineer Agent

---

## What This Is

An inline evaluation system that scores every civic brief for readability, tone, and jargon at creation time. Scores are stored alongside the brief and displayed as quality badges in the UI. Investors and users see three trust signals on every brief: factuality confidence (existing), reading level, and plain-language tone.

## Why

1. **Investor confidence.** "How do you know the AI output is good?" Three visible quality dimensions answer this concretely.
2. **Civic mission proof.** A "Grade 7 Reading Level" badge next to a government budget summary proves accessibility in one glance.
3. **Quality regression detection.** If a prompt change or model update degrades output quality, scores surface the regression immediately.
4. **Foundation for provider comparison.** Once scoring is inline, we can compare brief quality across Claude vs Gemini and route to the better provider per task.

## Provider Strategy

| Task | Provider | Rationale |
|------|----------|-----------|
| FK readability scoring | None (deterministic) | Pure math, no LLM needed |
| Tone/jargon scoring | Gemini Flash (`infra.evalTone`) | Cost-isolated from production Anthropic quota. ~$0.02/eval vs ~$0.20 via Sonnet |
| Civic summarization | Anthropic Sonnet (unchanged) | Trust-critical, quality paramount |
| Factuality verification | Anthropic Sonnet (unchanged) | Trust-critical, accuracy paramount |

---

## Database: Hybrid Column Strategy

Migration 011. Three new columns on `briefs`:

```sql
-- Overall composite score: the one number we filter/sort/display.
-- Computed as weighted average of readability + tone dimensions.
ALTER TABLE briefs ADD COLUMN eval_overall_score NUMERIC(4,2);

-- When the eval was last run (for freshness/cache invalidation).
ALTER TABLE briefs ADD COLUMN eval_scored_at TIMESTAMPTZ;

-- All eval dimension details. Shape enforced by Zod at app layer.
-- Keys promoted to dedicated columns when query patterns demand it.
ALTER TABLE briefs ADD COLUMN eval_details JSONB DEFAULT '{}';
```

Index on `eval_overall_score` for filtering:

```sql
CREATE INDEX idx_briefs_eval_overall ON briefs (eval_overall_score) WHERE eval_overall_score IS NOT NULL;
```

### eval_details JSONB Shape

Validated by Zod schema at the application layer:

```typescript
{
  readabilityGrade: number,     // FK grade level (target: <= 8)
  readabilityEase: number,      // Flesch Reading Ease (target: >= 60)
  toneScore: number,            // 1-5 from Gemini Flash
  jargonScore: number,          // 1-5 from Gemini Flash
  jargonTerms: string[],        // flagged jargon terms
  provider: string,             // "gemini-2.5-flash" or "deterministic-only"
}
```

### eval_overall_score Computation

Weighted average, normalized to 0-1 scale:

- FK readability: 40% weight. Grade <= 8 = 1.0, grade 9 = 0.7, grade 10 = 0.4, grade > 10 = 0.1
- Tone score: 35% weight. Normalized: (score - 1) / 4
- Jargon score: 25% weight. Normalized: (score - 1) / 4

This weighting prioritizes readability (the core civic mission) over subjective tone/jargon.

---

## Architecture

### Module Structure

```
src/lib/eval/
  readability.ts    -- FK grade + ease computation (pure, deterministic)
  tone.ts           -- Gemini Flash tone/jargon prompt + structured output via AI SDK
  scoring.ts        -- Composite score computation (weighted average)
  schemas.ts        -- Zod schemas for EvalDetails and EvalScores
  index.ts          -- scoreBrief() orchestrator, re-exports
```

### Pipeline Integration

In `processCivicDocument()` (src/lib/pipeline.ts):

```
existing flow:
  extract PDF -> summarize -> verify -> translate -> store brief

new addition (after store):
  1. Compute FK readability from brief text (synchronous, <1ms)
  2. Fire Gemini Flash tone/jargon eval (async, non-blocking)
  3. Compute composite score
  4. Update brief row with eval_overall_score + eval_scored_at + eval_details
```

**Critical: eval is non-blocking.** The brief response returns to the user immediately with the FK readability score included (computed synchronously). Gemini tone scoring fires as a fire-and-forget async call that updates the brief row when complete. The upload response includes `evalDetails.readabilityGrade` and `evalDetails.readabilityEase` but `toneScore` and `jargonScore` will be null initially. The UI renders the FK badge immediately and shows "Scoring..." for the tone badge. The brief detail page (`/brief/[id]`) fetches fresh data on load, so by the time a user navigates to their brief, the Gemini score is typically already backfilled (~2-3s). If Gemini is down, the brief still saves with only FK scores.

### Flow Diagram

```
User uploads PDF
       |
  [Extract + Summarize + Verify + Translate + Store]  <-- existing pipeline
       |
  [Brief returned to user with factuality confidence]  <-- response sent here
       |
  [Background: FK readability computed]  <-- synchronous, fast
       |
  [Background: Gemini Flash tone/jargon scoring]  <-- async, ~2-3s
       |
  [Background: Composite score computed + brief row updated]
       |
  [UI polls or refreshes to show eval badges]
```

### Backfill Script

`scripts/eval-briefs.ts` -- fetches all briefs with `eval_overall_score IS NULL`, scores them in sequence (respecting Gemini rate limits), updates rows. For existing briefs and recovery from scoring failures.

Run with: `npx tsx scripts/eval-briefs.ts`

---

## UI: Quality Badges

### Badge Design

Three badges displayed in a row inside `CivicBrief.tsx`, alongside the existing `ConfidenceScore` component:

| Badge | Source | Display Text | Green | Yellow | Red |
|-------|--------|-------------|-------|--------|-----|
| Confidence | Existing verifier | "92% Confidence" | >= 80% | >= 50% | < 50% |
| Reading Level | FK grade (deterministic) | "Grade 7 Reading Level" | <= 8 | 9-10 | > 10 |
| Tone | Gemini Flash | "Plain Language: 4/5" | >= 4 | 3 | <= 2 |

### Components

- **`src/components/QualityBadges.tsx`** -- New component. Renders reading level + tone badges. Same visual style as `ConfidenceScore` (pill shape, colored dot + text, border-radius: 20px).
- **`src/components/CivicBrief.tsx`** -- Updated to render `QualityBadges` alongside `ConfidenceScore` in a flex row.

### Five States

| State | Behavior |
|-------|----------|
| **Default** | All three badges rendered with scores |
| **Loading** | FK badge shown immediately. Tone badge shows "Scoring..." with subtle opacity pulse |
| **Empty** | `eval_details` is null (old briefs, no backfill yet). Eval badges don't render. No "N/A" clutter. |
| **Error** | Gemini failed. FK badge shown. Tone badge omitted (not "Error"). |
| **Demo** | Showcase briefs render hardcoded eval scores from scenario config |

### Badge Visual Spec

Match existing `ConfidenceScore` style:
- Font: 13px, weight 600
- Padding: 6px 14px
- Border-radius: 20px
- Color dot: 8px circle, left of text
- Colors: Use existing CSS vars (--green/--green-light for high, --accent/#fef3e2 for medium, #dc2626/#fee2e2 for low)

---

## Eval Module Details

### readability.ts

Pure function. No external dependencies beyond `syllable` npm package.

```typescript
interface ReadabilityResult {
  grade: number;       // FK Grade Level
  ease: number;        // Flesch Reading Ease
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
}

function computeReadability(text: string): ReadabilityResult
```

**Flesch-Kincaid Grade Level formula:**
`0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59`

**Flesch Reading Ease formula:**
`206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)`

Input: the combined text of all civic brief sections (what_changed, who_affected, what_to_do, budget_impact, deadlines, context). Not the raw PDF text.

### tone.ts

Uses Gemini Flash via AI SDK structured output.

```typescript
interface ToneResult {
  toneScore: number;        // 1-5
  jargonScore: number;      // 1-5
  jargonTerms: string[];    // flagged terms
}

async function evaluateTone(briefText: string): Promise<ToneResult>
```

Prompt rubric (sent to Gemini Flash):
- **Tone (1-5):** Does this read like a knowledgeable neighbor explaining local government (5) or like the original government document (1)?
- **Jargon (1-5):** 5 = no jargon. 1 = dense with unexplained technical/legal terms.
- **Jargon terms:** List any terms a high school student wouldn't understand.

Uses `infra.evalTone` from `src/lib/ai/models.ts` and `EvalToneResultSchema` from schemas (to be moved to `src/lib/eval/schemas.ts`).

### scoring.ts

Pure function. Computes the composite overall score.

```typescript
function computeOverallScore(readability: ReadabilityResult, tone: ToneResult): number
```

Weights: readability 40%, tone 35%, jargon 25%. Output: 0-1 scale.

---

## Zod Schemas

Move eval-related schemas from `src/lib/ai/schemas.ts` to `src/lib/eval/schemas.ts`:

```typescript
// What gets stored in eval_details JSONB
export const EvalDetailsSchema = z.object({
  readabilityGrade: z.number(),
  readabilityEase: z.number(),
  toneScore: z.number().min(1).max(5),
  jargonScore: z.number().min(1).max(5),
  jargonTerms: z.array(z.string()),
  provider: z.string(),
});

export type EvalDetails = z.infer<typeof EvalDetailsSchema>;

// Full eval result (includes computed fields)
export const EvalResultSchema = EvalDetailsSchema.extend({
  overallScore: z.number().min(0).max(1),
  scoredAt: z.string().datetime(),
});

export type EvalResult = z.infer<typeof EvalResultSchema>;
```

Update `src/lib/ai/schemas.ts` to re-export from eval for backwards compatibility, then remove in a follow-up.

---

## Concurrent Request Handling

Two simultaneous uploads of the same PDF:
- Each gets its own brief row (existing dedup is by content_hash on `sources`, not briefs)
- Each triggers its own eval scoring
- No conflict: eval writes to its own brief row

Two eval backfill runs simultaneously:
- Script should SELECT ... FOR UPDATE SKIP LOCKED to avoid double-scoring
- Or simpler: backfill script is manual, run one at a time

---

## Dependencies

- `syllable` npm package (pure JS, no native deps) -- for FK computation
- `@ai-sdk/google` (already installed via C15) -- for Gemini Flash
- `ai` (already installed via C15) -- AI SDK core

No new external services. No new env vars (GOOGLE_GENERATIVE_AI_API_KEY already configured for C15).

---

## NOT in Scope

- Lighthouse CI (layer 1) -- separate future PR
- Playwright screenshot regression (layer 2) -- separate future PR
- LLM vision design compliance (layer 4) -- waiting for design system maturity
- Self-heal loop (subagent auto-fix) -- needs subagent infrastructure
- Eval history/trends dashboard -- v1.2
- Admin UI for eval reports -- v1.2
- Translation quality scoring -- future, after eval proves stable
- Promoting JSONB keys to dedicated columns -- driven by query patterns, not speculated

---

## Testing Strategy

### Unit Tests (Vitest)

- `readability.ts`: Known-text inputs with pre-computed FK scores. Edge cases: empty text, single sentence, very long text.
- `scoring.ts`: Weight computation with known inputs. Boundary values (grade exactly 8, tone exactly 3).
- `schemas.ts`: Valid and invalid eval_details shapes.

### Integration Tests

- `tone.ts`: Smoke test with Gemini Flash (skip when GOOGLE_GENERATIVE_AI_API_KEY not set, same pattern as C15).
- Pipeline integration: Upload a brief, verify eval_overall_score is populated (requires Supabase + Gemini).

### E2E Tests (Playwright)

- Brief page renders quality badges when eval scores present
- Brief page renders gracefully when eval scores are null (old briefs)
- Badge colors match thresholds (green/yellow/red)
- Mobile responsive layout for badge row

---

## Deployment Config

No new API routes. Eval runs inside the existing `/api/summarize` route.

The backfill script runs locally via `npx tsx`, not as a deployed route.

No new env vars. No new cron jobs. No Fluid Compute changes.

---

## Migration: 011_eval_scores.sql

```sql
-- C16: Eval scoring columns on briefs
ALTER TABLE briefs ADD COLUMN eval_overall_score NUMERIC(4,2);
ALTER TABLE briefs ADD COLUMN eval_scored_at TIMESTAMPTZ;
ALTER TABLE briefs ADD COLUMN eval_details JSONB DEFAULT '{}';

CREATE INDEX idx_briefs_eval_overall
  ON briefs (eval_overall_score)
  WHERE eval_overall_score IS NOT NULL;

COMMENT ON COLUMN briefs.eval_overall_score IS 'Composite quality score (0-1). Weighted: readability 40%, tone 35%, jargon 25%.';
COMMENT ON COLUMN briefs.eval_scored_at IS 'When the eval was last computed.';
COMMENT ON COLUMN briefs.eval_details IS 'Full eval dimension breakdown. Shape: {readabilityGrade, readabilityEase, toneScore, jargonScore, jargonTerms, provider}';
```
