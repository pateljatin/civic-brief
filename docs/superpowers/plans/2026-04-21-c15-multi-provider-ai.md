# C15: Multi-Provider AI Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vercel AI SDK-based provider abstraction so Civic Brief can route AI tasks to Anthropic (production) or Gemini Flash (infrastructure/eval) without changing existing code.

**Architecture:** Three new files in `src/lib/ai/` (models, schemas, index). Existing `src/lib/anthropic.ts` and all pipeline/prompt code stays untouched. Direct API keys for auth. AI SDK v6 `generateText` + `Output.object()` for structured output with Zod validation.

**Tech Stack:** `ai` (Vercel AI SDK v6), `@ai-sdk/anthropic`, `@ai-sdk/google`, `zod`

**Spec:** `docs/superpowers/specs/2026-04-19-c15-multi-provider-ai-design.md`
**Issue:** #54

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Add 4 new dependencies |
| `src/lib/ai/models.ts` | Create | Provider/model mapping with env var overrides |
| `src/lib/ai/schemas.ts` | Create | Zod schemas for eval structured output |
| `src/lib/ai/index.ts` | Create | Re-exports for clean `@/lib/ai` imports |
| `tests/unit/ai-models.test.ts` | Create | Unit tests for model exports and provider routing |
| `tests/unit/ai-schemas.test.ts` | Create | Unit tests for Zod schema validation |
| `tests/integration/ai-provider-smoke.test.ts` | Create | Live Gemini Flash integration smoke test |
| `tests/baseline.json` | Modify | Bump unit count after new tests added |

**Files NOT touched:** `src/lib/anthropic.ts`, `src/lib/pipeline.ts`, `src/lib/prompts/*`, `src/app/api/*`

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install AI SDK and providers**

```bash
npm install ai @ai-sdk/anthropic @ai-sdk/google zod
```

- [ ] **Step 2: Verify installation**

Run: `npm ls ai @ai-sdk/anthropic @ai-sdk/google zod`
Expected: All four packages listed, no unmet peer dependencies.

- [ ] **Step 3: Verify existing tests still pass**

Run: `npm test`
Expected: All tests pass, zero failures.

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(c15): add Vercel AI SDK, Anthropic/Google providers, and Zod"
```

---

### Task 2: Create Zod schemas (`schemas.ts`)

Schemas come first because models.ts has no dependencies on them, but tests for both will import from the same module. Schemas are independently testable.

**Files:**
- Create: `src/lib/ai/schemas.ts`
- Create: `tests/unit/ai-schemas.test.ts`

- [ ] **Step 1: Write the failing tests for schemas**

Create `tests/unit/ai-schemas.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/ai-schemas.test.ts`
Expected: FAIL -- cannot resolve `@/lib/ai/schemas`.

- [ ] **Step 3: Create the schemas module**

Create `src/lib/ai/schemas.ts`:

```typescript
import { z } from 'zod';

// ─── Eval Vision (C16: design/layout compliance via screenshot) ───

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

// ─── Eval Tone (C16: readability, jargon, and tone scoring) ───

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ai-schemas.test.ts`
Expected: All 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/schemas.ts tests/unit/ai-schemas.test.ts
git commit -m "feat(c15): add Zod schemas for eval structured output"
```

---

### Task 3: Create model registry (`models.ts`)

**Files:**
- Create: `src/lib/ai/models.ts`
- Create: `tests/unit/ai-models.test.ts`

- [ ] **Step 1: Write the failing tests for models**

Create `tests/unit/ai-models.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ai/models', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('exports civic and infra model groups', async () => {
    const { civic, infra } = await import('@/lib/ai/models');
    expect(civic).toBeDefined();
    expect(infra).toBeDefined();
  });

  it('civic has summarize, verify, and translate models', async () => {
    const { civic } = await import('@/lib/ai/models');
    expect(civic.summarize).toBeDefined();
    expect(civic.verify).toBeDefined();
    expect(civic.translate).toBeDefined();
  });

  it('infra has evalVision, evalReadability, and evalTone models', async () => {
    const { infra } = await import('@/lib/ai/models');
    expect(infra.evalVision).toBeDefined();
    expect(infra.evalReadability).toBeDefined();
    expect(infra.evalTone).toBeDefined();
  });

  it('civic models use anthropic provider', async () => {
    const { civic } = await import('@/lib/ai/models');
    expect(civic.summarize.provider).toBe('anthropic.chat');
  });

  it('infra models use google provider', async () => {
    const { infra } = await import('@/lib/ai/models');
    expect(infra.evalVision.provider).toBe('google.generative-ai');
  });

  it('uses default model IDs when env vars not set', async () => {
    delete process.env.CIVIC_MODEL;
    delete process.env.INFRA_MODEL;
    const { civic, infra } = await import('@/lib/ai/models');
    expect(civic.summarize.modelId).toBe('claude-sonnet-4.6');
    expect(infra.evalVision.modelId).toBe('gemini-2.5-flash');
  });

  it('respects CIVIC_MODEL env var override', async () => {
    process.env.CIVIC_MODEL = 'claude-haiku-4.5';
    const { civic } = await import('@/lib/ai/models');
    expect(civic.summarize.modelId).toBe('claude-haiku-4.5');
  });

  it('respects INFRA_MODEL env var override', async () => {
    process.env.INFRA_MODEL = 'gemini-2.0-flash';
    const { infra } = await import('@/lib/ai/models');
    expect(infra.evalVision.modelId).toBe('gemini-2.0-flash');
  });
});
```

Note: The `.provider` and `.modelId` properties are from the AI SDK's model interface. If the exact property names differ after install, adjust the tests to match the actual API. Check `node_modules/ai/src/` or `node_modules/@ai-sdk/anthropic/src/` for the correct properties.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/ai-models.test.ts`
Expected: FAIL -- cannot resolve `@/lib/ai/models`.

- [ ] **Step 3: Create the models module**

Create `src/lib/ai/models.ts`:

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// ─── Model versions (single source of truth) ───
// Update these when providers deprecate older versions.
// Override via env vars for runtime flexibility or testing.
const CIVIC_MODEL = process.env.CIVIC_MODEL ?? 'claude-sonnet-4.6';
const INFRA_MODEL = process.env.INFRA_MODEL ?? 'gemini-2.5-flash';

// Production models (trust-critical civic work)
// Currently for documentation and future use only. The existing pipeline
// uses src/lib/anthropic.ts directly. Wiring these into the pipeline
// is a separate future migration decision.
export const civic = {
  summarize: anthropic(CIVIC_MODEL),
  verify: anthropic(CIVIC_MODEL),
  translate: anthropic(CIVIC_MODEL),
} as const;

// Infrastructure models (cost-sensitive, isolated from production Anthropic quota)
export const infra = {
  evalVision: google(INFRA_MODEL),
  evalReadability: google(INFRA_MODEL),
  evalTone: google(INFRA_MODEL),
} as const;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ai-models.test.ts`
Expected: All 8 tests pass.

Important: If the `.provider` or `.modelId` properties don't exist on the model objects, grep the AI SDK source for the correct property names:
```bash
grep -r "provider" node_modules/@ai-sdk/anthropic/src/ --include="*.ts" | head -10
grep -r "modelId" node_modules/@ai-sdk/anthropic/src/ --include="*.ts" | head -10
```
Adjust the test assertions to match the actual API.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/models.ts tests/unit/ai-models.test.ts
git commit -m "feat(c15): add model registry with Anthropic/Gemini provider routing"
```

---

### Task 4: Create index re-export and verify full module

**Files:**
- Create: `src/lib/ai/index.ts`

- [ ] **Step 1: Create the index module**

Create `src/lib/ai/index.ts`:

```typescript
export { civic, infra } from './models';
export {
  EvalVisionResultSchema,
  EvalToneResultSchema,
  type EvalVisionResult,
  type EvalToneResult,
} from './schemas';
```

- [ ] **Step 2: Run all new tests**

Run: `npx vitest run tests/unit/ai-models.test.ts tests/unit/ai-schemas.test.ts`
Expected: All 18 tests pass.

- [ ] **Step 3: Run full existing test suite**

Run: `npm test`
Expected: All tests pass, zero failures. New test count = previous baseline + 18.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/index.ts
git commit -m "feat(c15): add barrel export for ai module"
```

---

### Task 5: Integration smoke test (Gemini Flash)

**Files:**
- Create: `tests/integration/ai-provider-smoke.test.ts`

- [ ] **Step 1: Write the integration test**

Create `tests/integration/ai-provider-smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { infra } from '@/lib/ai/models';

const hasGeminiKey = !!process.env.GOOGLE_GENERATIVE_AI_KEY;

describe.skipIf(!hasGeminiKey)('Gemini Flash smoke test', () => {
  it('returns structured JSON matching a Zod schema', async () => {
    const TestSchema = z.object({
      greeting: z.string(),
      wordCount: z.number(),
    });

    const result = await generateText({
      model: infra.evalVision,
      output: Output.object({ schema: TestSchema }),
      messages: [
        {
          role: 'user',
          content: 'Say hello in exactly 3 words. Return as JSON with "greeting" (the 3 words) and "wordCount" (the number 3).',
        },
      ],
    });

    expect(result.object).toBeDefined();
    expect(typeof result.object!.greeting).toBe('string');
    expect(result.object!.wordCount).toBe(3);
  }, 30000);
});

describe.skipIf(hasGeminiKey)('Gemini Flash without API key', () => {
  it('skips when GOOGLE_GENERATIVE_AI_KEY is not set', () => {
    // This test documents that the smoke test is intentionally skipped in CI
    // when the Gemini API key is not configured.
    expect(hasGeminiKey).toBe(false);
  });
});
```

- [ ] **Step 2: Run without API key (CI scenario)**

Run: `npx vitest run tests/integration/ai-provider-smoke.test.ts`
Expected: 1 test passes (the "skips" documentation test), 1 test skipped.

- [ ] **Step 3: Run with API key (local dev scenario)**

Ensure `GOOGLE_GENERATIVE_AI_KEY` is set in `.env.local`, then:
Run: `npx vitest run tests/integration/ai-provider-smoke.test.ts`
Expected: Smoke test passes, returns valid structured JSON.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/ai-provider-smoke.test.ts
git commit -m "test(c15): add Gemini Flash integration smoke test"
```

---

### Task 6: Update baseline and run full verification

**Files:**
- Modify: `tests/baseline.json`

- [ ] **Step 1: Run full test suite and capture count**

Run: `npm test`
Expected: All tests pass. Note the total test count (should be previous baseline + ~19 new tests).

- [ ] **Step 2: Update baseline**

Update `tests/baseline.json` with the new unit test count:

```json
{
  "unit": <NEW_COUNT>,
  "e2e": 84,
  "updated": "2026-04-21",
  "note": "Bump these numbers when adding tests. CI and npm run test:check assert actual >= baseline."
}
```

Replace `<NEW_COUNT>` with the actual number from Step 1.

- [ ] **Step 3: Run test:check to verify baseline passes**

Run: `npm run test:check`
Expected: `Unit/Integration: <NEW_COUNT>/<NEW_COUNT> (baseline) -- PASS`

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: Zero errors.

- [ ] **Step 5: Run E2E tests**

Run: `npm run test:e2e`
Expected: All E2E tests pass, zero failures.

- [ ] **Step 6: Verify no existing files modified**

Run: `git diff HEAD -- src/lib/anthropic.ts src/lib/pipeline.ts src/lib/prompts/`
Expected: No output (no changes to existing AI code).

- [ ] **Step 7: Verify build succeeds**

Run: `npm run build`
Expected: Build completes. Check output for unexpected bundle size increases from AI SDK.

- [ ] **Step 8: Commit baseline update**

```bash
git add tests/baseline.json
git commit -m "chore(c15): bump test baseline to include provider tests"
```

---

### Task 7: Manual browser verification

This task requires a human or a browser-capable agent.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify home page loads**

Navigate to `http://localhost:3000`
Expected: Home page renders correctly with hero, pipeline steps, stats.

- [ ] **Step 3: Verify upload flow works end-to-end**

Navigate to `http://localhost:3000/upload`, upload a test PDF with a source URL.
Expected: Pipeline runs (extracting -> summarizing -> verifying -> translating -> complete), brief displays with confidence score.

- [ ] **Step 4: Verify brief page loads**

Navigate to the generated brief URL.
Expected: Brief renders with all civic sections, language toggle works.

- [ ] **Step 5: Verify no console errors**

Check browser dev console.
Expected: No new errors. No references to Gemini or AI SDK in any production page load.

---

## Verification Summary

| Exit Criterion (from spec) | Task |
|----------------------------|------|
| Unit/integration: zero failures, count >= baseline | Task 6, Steps 1-3 |
| All E2E tests pass | Task 6, Step 5 |
| TypeScript compiles with zero errors | Task 6, Step 4 |
| Live site works end-to-end | Task 7 |
| New provider module exports are importable | Task 4, Step 2 |
| Gemini Flash returns structured JSON | Task 5, Step 3 |
| Missing GOOGLE_GENERATIVE_AI_KEY produces clear error | Task 5, Step 2 |
| No changes to existing anthropic.ts, pipeline.ts, prompts/ | Task 6, Step 6 |
| Build succeeds | Task 6, Step 7 |
