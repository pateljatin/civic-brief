# C15: Multi-Provider AI Architecture Design Spec

**Date:** 2026-04-19
**Issue:** #54
**Status:** Draft
**Author:** Jatin + Jatin's Engineer Agent

---

## What This Is

A provider abstraction layer using the Vercel AI SDK that lets Civic Brief route AI tasks to different providers based on workload type. Anthropic (Sonnet) stays the production provider for trust-critical civic work. Gemini Flash is added as a cost-efficient provider for infrastructure tasks (eval, scoring). The existing `src/lib/anthropic.ts` is untouched.

## Why

1. **Workload isolation.** Eval/scoring tasks should not compete with production civic summarization for Anthropic rate limits and budget.
2. **Cost.** Gemini Flash is ~90% cheaper than Sonnet for rubric-style tasks. Eval runs drop from ~$0.20 to ~$0.02 per run.
3. **Extensibility.** Adding a third provider (OpenAI, Mistral, local models) should be one `npm install` + one line in a config file, not a new adapter class.
4. **Future translation migration.** Once C16 (Eval Agent) can validate translation quality across providers, translation can move to Gemini for cost savings and stronger Hindi support. This spec lays the foundation.

## Provider Strategy (Locked Decision)

| Workload | Provider | Rationale |
|----------|----------|-----------|
| Civic summarization | Anthropic Sonnet | Trust-critical, quality paramount |
| Factuality verification | Anthropic Sonnet | Trust-critical, accuracy paramount |
| Translation | Anthropic Sonnet (for now) | Civic terminology precision; migrate to Gemini after quality validation via C16 |
| Eval: vision/design | Gemini Flash | Cost-sensitive, rubric task |
| Eval: readability/tone | Gemini Flash | Cost-sensitive, scoring task |
| Deterministic eval (Lighthouse, FK) | None | No LLM needed |

---

## Architecture

### Module Structure

```
src/lib/ai/
  models.ts       # Task -> provider/model mapping (the only config file)
  schemas.ts      # Zod schemas for structured AI output (eval types initially)
  index.ts        # Re-exports for clean imports
```

### Existing Code (UNCHANGED)

```
src/lib/anthropic.ts    # Stays exactly as-is. Not wrapped, not replaced.
src/lib/prompts/        # All civic prompts stay. They call anthropic.ts directly.
src/lib/pipeline.ts     # Stays. Calls anthropic.ts generateJSON<T>() directly.
```

The existing pipeline (`anthropic.ts` -> `generateJSON<T>()` -> manual JSON parsing) continues to work unchanged. New code (C16 eval, future features) imports from `src/lib/ai/` instead.

### models.ts

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// ─── Model versions (single source of truth) ───
// Update these when providers deprecate older versions.
// Can also be overridden via env vars for runtime flexibility.
const CIVIC_MODEL = process.env.CIVIC_MODEL ?? 'claude-sonnet-4.6';
const INFRA_MODEL = process.env.INFRA_MODEL ?? 'gemini-2.5-flash';

// Production models (trust-critical civic work)
// Note: defined here for documentation and future use. NOT wired into
// the existing pipeline in this spec. The existing pipeline continues
// to use src/lib/anthropic.ts directly. Wiring civic models through
// AI SDK is a separate future migration decision.
export const civic = {
  summarize: anthropic(CIVIC_MODEL),
  verify: anthropic(CIVIC_MODEL),
  translate: anthropic(CIVIC_MODEL),
} as const;

// Infrastructure models (cost-sensitive, isolated from production)
export const infra = {
  evalVision: google(INFRA_MODEL),
  evalReadability: google(INFRA_MODEL),
  evalTone: google(INFRA_MODEL),
} as const;
```

Adding a provider later: `npm install @ai-sdk/openai`, add one line. No interfaces, no adapters, no registry.

Auth approach: Direct API keys (ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_KEY) in .env.local. Vercel AI Gateway is available as a future upgrade for cost dashboards and failover, but adds complexity we don't need yet. Switching to Gateway later is a 30-minute change (swap model imports for string slugs).

### schemas.ts

Zod schemas for structured output. Initially contains eval-related schemas only (used by C16). Example structure:

```typescript
import { z } from 'zod';

export const EvalVisionResultSchema = z.object({
  route: z.string(),
  layoutScore: z.number().min(1).max(5),
  colorCompliance: z.boolean(),
  fontCompliance: z.boolean(),
  mobileResponsive: z.boolean(),
  issues: z.array(z.string()),
  overall: z.enum(['pass', 'fail', 'warning']),
});

export const EvalToneResultSchema = z.object({
  briefId: z.string(),
  toneScore: z.number().min(1).max(5),
  jargonScore: z.number().min(1).max(5),
  jargonTerms: z.array(z.string()),
  readabilityGrade: z.number(),
  overall: z.enum(['pass', 'fail', 'warning']),
});

export type EvalVisionResult = z.infer<typeof EvalVisionResultSchema>;
export type EvalToneResult = z.infer<typeof EvalToneResultSchema>;
```

These schemas serve dual purpose: runtime validation of LLM output (via AI SDK `generateText` + `Output.object()`) and TypeScript types (via `z.infer`).

### Usage Pattern (for C16 and future consumers)

```typescript
import { generateText, Output } from 'ai';
import { infra } from '@/lib/ai/models';
import { EvalVisionResultSchema } from '@/lib/ai/schemas';

const result = await generateText({
  model: infra.evalVision,
  output: Output.object({ schema: EvalVisionResultSchema }),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Evaluate this page against our design system...' },
        { type: 'image', image: screenshotBuffer },
      ],
    },
  ],
});
// result.output is typed as EvalVisionResult, validated by Zod
```

---

## Dependencies

### New npm packages

| Package | Purpose | Type |
|---------|---------|------|
| `ai` | Vercel AI SDK core | dependency |
| `@ai-sdk/anthropic` | Anthropic provider for AI SDK | dependency |
| `@ai-sdk/google` | Google/Gemini provider for AI SDK | dependency |
| `zod` | Schema validation for structured output | dependency |

### New environment variables

| Name | Where | Who provisions | Required? |
|------|-------|----------------|-----------|
| `GOOGLE_GENERATIVE_AI_KEY` | .env.local, Vercel prod, Vercel preview | Manual (Google AI Studio) | Yes for eval features; app runs without it |

### Graceful degradation

If `GOOGLE_GENERATIVE_AI_KEY` is not set:
- `infra` models throw a clear error when called: "GOOGLE_GENERATIVE_AI_KEY is not set. Eval features require a Gemini API key."
- All existing functionality is unaffected (uses `anthropic.ts` directly, not `models.ts`)
- CI tests that don't test eval pass without the key

---

## What Changes

### Files Created (3)

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `src/lib/ai/models.ts` | ~25 | Task-to-model mapping |
| `src/lib/ai/schemas.ts` | ~40 | Zod schemas for eval output |
| `src/lib/ai/index.ts` | ~5 | Re-exports |

### Files Modified (1)

| File | Change |
|------|--------|
| `package.json` | Add `ai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `zod` |

### Files NOT Modified

| File | Why |
|------|-----|
| `src/lib/anthropic.ts` | Existing pipeline stays untouched |
| `src/lib/pipeline.ts` | No changes to civic processing |
| `src/lib/prompts/*` | No changes to civic prompts |
| `src/app/api/*` | No changes to API routes |

---

## Testing

### Unit tests (new file: `tests/unit/ai-providers.test.ts`)

| Test | What it proves |
|------|---------------|
| `models.ts exports civic and infra objects` | Module structure is correct |
| `civic models use anthropic provider` | Production workloads route to Anthropic |
| `infra models use google provider` | Eval workloads route to Gemini |
| `schemas validate correct input` | Zod schemas accept well-formed data |
| `schemas reject malformed input` | Zod schemas catch bad LLM output |
| `missing GOOGLE_GENERATIVE_AI_KEY throws descriptive error` | Graceful degradation message |

### Integration test (new file: `tests/integration/ai-provider-smoke.test.ts`)

One test that calls Gemini Flash with a trivial prompt and validates structured JSON response. Skipped when `GOOGLE_GENERATIVE_AI_KEY` is not set (same pattern as Supabase tests in CI).

### Existing tests

All existing unit/integration tests and E2E tests must pass with zero failures. This is the primary exit criterion.

---

## Exit Criteria

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | Unit/integration: zero failures, count >= baseline | `npm run test:check` (reads `tests/baseline.json`) |
| 2 | All existing E2E tests pass (zero failures) | `npm run test:e2e` |
| 3 | TypeScript compiles with zero errors | `npm run typecheck` |
| 4 | Live site works: upload PDF, get brief, translate, verify | Manual browser test |
| 5 | New provider module exports are importable | Unit test |
| 6 | Gemini Flash returns structured JSON matching Zod schema | Integration smoke test |
| 7 | Missing GOOGLE_GENERATIVE_AI_KEY produces clear error (not crash) | Unit test |
| 8 | No changes to existing anthropic.ts, pipeline.ts, or prompts/ | `git diff` inspection |
| 9 | Build succeeds on Vercel (preview deploy) | Vercel preview URL |

---

## NOT in Scope

- Eval system prompts, screenshot capture, Lighthouse CI (that is C16)
- Migrating existing pipeline from `anthropic.ts` to AI SDK
- Translation provider migration to Gemini
- Any changes to existing API routes or UI components
- Rate limiting or cost tracking for Gemini calls
- Fallback/retry logic across providers (premature; revisit when we have real failure data)

---

## Concurrent Request Scenario

Not applicable. This spec adds a module with no write paths. The `models.ts` file exports stateless model references. Multiple callers can use them concurrently without contention (AI SDK handles connection pooling internally).

---

## Risks

| Risk | Mitigation |
|------|-----------|
| AI SDK adds bundle size | It is tree-shakeable; only imported providers are bundled. Verify with `next build` output. |
| Gemini structured output differs from Anthropic | Zod schema validation catches shape mismatches at runtime. Integration smoke test validates. |
| Zod dependency conflicts | Check for existing Zod usage (none currently). Pin to latest stable. |
| GOOGLE_GENERATIVE_AI_KEY leaks | Same .env.local pattern as ANTHROPIC_API_KEY. Never committed. |

---

## Future (Out of Scope, Documented for Context)

1. **C16 (Civic Eval Agent):** First consumer of `infra` models. Uses `evalVision`, `evalReadability`, `evalTone` with prompts defined in C16's scope.
2. **Translation migration:** Move `civic.translate` from Anthropic to Gemini after C16 validates quality parity. Change one line in `models.ts`.
3. **Pipeline migration:** Optionally migrate `src/lib/anthropic.ts` callers to AI SDK for unified interface. Separate decision, separate spec.
4. **OpenAI addition:** `npm install @ai-sdk/openai`, add model to `models.ts`. No architectural changes needed.
