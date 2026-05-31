# Spec: Feedback Loop Closure (C19)

**Date:** 2026-05-31
**Status:** Approved
**Branch:** `feature/c19-feedback-loop`

## What We Are Building

Close the gap between human community flags and automated re-scoring. Today, when 2+ users flag `factual_error` or `missing_info`, the threshold is detected and `flagContext` is assembled — then logged and discarded. This spec wires that context into an actual re-verification run that can degrade the factuality score.

Also adds `docs/eval-strategy.md` for public community visibility into how the three-judge system works.

## NOT In Scope

- Improving Judge 2 (readability/tone) based on community flags — that is a v1.2 prompt-iteration item
- Storing source documents — privacy posture is unchanged
- UI changes to display re-verification history
- Notifying users when auto-reverification runs

## Architecture

### 1. `src/lib/prompts/civic-verify.ts`

Add optional `flagContext?: string` param to `CIVIC_VERIFY_USER`. When present, inject as an `<community_flags>` XML block after the summary, before the final instruction line.

```
<community_flags>
[factual_error]: The budget figure cited is $2.3M but the source says $3.2M
[missing_info]: Does not mention the sunset clause on page 4
</community_flags>
```

Claude is instructed: "Community members have flagged the following specific concerns. Investigate whether each flag is supported by the source document. This does not change your scoring criteria — score solely on factual accuracy."

The `<community_flags>` block is treated as untrusted content (same as `<source_document>` and `<civic_summary>`).

### 2. `src/lib/reverify.ts` (new file)

Single exported function: `reverifyBrief(briefId: string, flagContext: string): Promise<void>`

Steps:
1. Fetch `source_url` and `source_id` from `sources` via `brief_id`
2. Re-fetch the URL using `fetchWithSSRFProtection` from `src/lib/ssrf.ts`
3. Extract text in memory via `extractTextFromPDF` from `src/lib/pdf-extract.ts`
4. Call `generateJSON<VerificationResult>` with `CIVIC_VERIFY_SYSTEM` and `CIVIC_VERIFY_USER(text, summaryJson, flagContext)`
5. Trust-degrade write: only update `sources.factuality_score` if new score < current
6. Log a `reverification` row in `community_feedback` with `metadata.triggered_by = 'auto'`

Errors are caught and logged — never throw back to the feedback route caller. The feedback POST must always succeed regardless of reverification outcome.

### 3. `src/app/api/feedback/route.ts`

Replace `console.log(...)` in `checkAndTriggerReverification` with `reverifyBrief(briefId, flagContext)`. Keep the `.catch()` wrapper already present.

### 4. `docs/eval-strategy.md`

Public-facing doc covering:
- Three-judge overview (factuality, readability+tone, human community)
- Each judge's rubric and scoring bands
- The composite formula for Judge 2
- How Judge 3 triggers Judge 1 re-runs
- Trust-degrades-only invariant and why
- What is NOT yet automated (Judge 2 calibration from flags) and the v1.2 roadmap item
- Privacy invariant: no document storage, URL re-fetch only

## Data Flow

```
User submits feedback_type=factual_error
  → INSERT community_feedback
  → count >= 2?
    YES → reverifyBrief(briefId, flagContext)
      → fetch source_url from DB
      → re-fetch PDF (SSRF-protected)
      → extract text in memory
      → Claude verify with <community_flags> context
      → new_score < current_score?
        YES → UPDATE sources.factuality_score (degrade)
              INSERT community_feedback (reverification, triggered_by=auto)
        NO  → no write (trust preserved)
```

## Error Handling

| Scenario | Behavior |
|---|---|
| source_url returns 404/timeout | Log error, skip reverification |
| URL is not a PDF | Log error, skip reverification |
| Claude returns malformed JSON | `generateJSON` throws, caught by `.catch()`, logged |
| Score is higher than current | No write (trust-degrades-only invariant) |
| reverifyBrief throws | Caught in feedback route `.catch()`, feedback POST still returns 200 |

## TypeScript API Contract

```ts
// src/lib/reverify.ts
export async function reverifyBrief(
  briefId: string,
  flagContext: string
): Promise<void>

// src/lib/prompts/civic-verify.ts
export const CIVIC_VERIFY_USER = (
  sourceText: string,
  summaryJson: string,
  flagContext?: string   // new optional param
) => string
```

## Testing

- Unit: `reverifyBrief` with mocked Supabase + mocked `generateJSON` — covers degrade path, no-degrade path, PDF fetch failure
- Unit: `CIVIC_VERIFY_USER` — snapshot test that `flagContext` is present in output when provided, absent when not
- Integration: feedback route test — 2 flags triggers reverification call (spy on `reverifyBrief`)
- No new E2E tests needed (internal pipeline, not user-visible)

## Deployment Config

| Route | Change |
|---|---|
| `POST /api/feedback` | No change — existing maxDuration sufficient |
| `POST /api/verify` | No change |
| `src/lib/reverify.ts` | Server-only lib, no route config needed |

## Env Var Lifecycle

No new env vars. Uses existing `ANTHROPIC_API_KEY` and Supabase service role.
