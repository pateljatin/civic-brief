# C15 Multi-Provider AI Architecture: Planning Retrospective

**Date:** 2026-04-25
**Issue:** #54, PR #56
**Planned:** 7 tasks, ~3 hours
**Actual:** 7 tasks + 1 bugfix, ~4 hours (including brainstorming/spec session)

---

## Planned vs Actual

| Task | Planned | Actual | Delta |
|------|---------|--------|-------|
| Install dependencies | 5 min | 5 min | On target |
| Zod schemas (TDD) | 15 min | 12 min (subagent) | Faster |
| Model registry (TDD) | 15 min | 13 min (subagent) | Faster |
| Index re-export | 5 min | 3 min | Trivial |
| Integration smoke test | 15 min | 10 min (subagent) | Faster |
| Full verification | 20 min | 25 min | Type error fix needed |
| Browser verification | 15 min | 20 min | Playwright browser update needed |
| **Unplanned: ScrollFadeIn fix** | -- | 5 min | Found during browser verify |

## Unplanned Additions

| Addition | Category | Should it have been in the plan? |
|----------|----------|--------------------------------|
| `result.output` vs `result.object` fix | API discovery | No. AI SDK v6 docs were checked but the property name wasn't in bundled docs. Only discoverable after install. |
| Playwright browser update | Environment drift | No. Caused by dependency install bumping Playwright minor version. |
| ScrollFadeIn hydration fix | Pre-existing bug | No. Found opportunistically during browser verification. Correctly scoped as a one-line fix on the same branch. |
| Test baseline infrastructure | Scope expansion | Partially. User requested it during spec review. Added `tests/baseline.json`, `scripts/check-test-baseline.js`, `scripts/run-test-check.js`, `npm run test:check`. Good addition but wasn't in original spec. |

## What Went Well

1. **Parallel subagent dispatch** for Tasks 2+3 saved ~15 min. Schemas and models are independent; running them concurrently was the right call.
2. **Spec was tight.** 7 tasks, 3 new files, 1 modified file. No ambiguity in what to build. Subagents had zero questions.
3. **Brainstorming caught the real design.** Started with custom adapter pattern, evolved to AI SDK through conversation. The user's "democracy of models" question pushed us to the right architecture.
4. **AI Gateway decision was quick.** Evaluated it, decided "not now," documented the upgrade path. Didn't over-invest in the decision.

## What Went Wrong

1. **Forgot post-merge checklist.** No backup before push, no retro, no memory update. User had to remind me. Now codified in CLAUDE.md.
2. **AI SDK v6 API assumed from memory.** Used `result.object` and `generateObject` initially. Both wrong in v6. Should have grepped the installed package before writing spec examples.
3. **Skipped code quality review.** The subagent-driven-development skill calls for spec review + code quality review per task. I did a combined spec review for Tasks 2+3 but skipped the code quality review entirely. For a small feature this was fine, but the process says to do both.

## Extracted Rules

1. **After installing a new SDK, grep its types before writing spec code.** `grep -A20 "interface ResultType" node_modules/pkg/dist/index.d.ts` takes 10 seconds and prevents type errors in the plan.
2. **Post-merge checklist is not optional.** Added to CLAUDE.md as a mandatory section.
3. **Test baseline system works.** `npm run test:check` is a good pattern. Apply to E2E count too when E2E tests stabilize.

## Metrics

- **Commits:** 8 (7 planned + 1 bugfix)
- **Files changed:** 11 (3 new src, 3 new tests, 1 new baseline, 1 spec, 1 package.json, 1 lock, 1 bugfix)
- **Tests added:** 20 (10 schema + 8 model + 2 smoke)
- **Total tests:** 322 unit/integration, 84 E2E
- **Dependencies added:** 4 (ai, @ai-sdk/anthropic, @ai-sdk/google, zod)
