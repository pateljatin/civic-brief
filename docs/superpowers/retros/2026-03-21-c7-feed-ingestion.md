# C7 Planning Retrospective (2026-03-21)

## Spec vs Reality

**Planned tasks:** 15 (implementation plan task table)
**Actual commits:** 17 (15 planned + 1 code review fix + 1 config/chore)
**Unplanned work:** ~12% of commits
**Files planned:** ~27 (25 new + 2 modified, per task table)
**Files actual:** 40 changed (7,806 insertions)

## Post-Planning Additions

| Item | Category | Root Cause | Lesson |
|---|---|---|---|
| Code review fixes across modules (`02e8f69`) | Bug fix | Issues found during mid-implementation review (import paths, error messages, edge cases) | Plan should include a review checkpoint commit. Expect ~1 fix commit per 10 implementation commits. |
| Cron auth header format (`7a6b041`) | Bug fix | Vercel cron uses `Authorization: Bearer ${CRON_SECRET}`, not `x-vercel-cron-secret`. Spec didn't verify against current Vercel docs. | Specs involving Vercel platform features must link to the specific docs page and quote the exact API contract. |
| Worker concurrency limits in vercel.json | Planning miss | Spec defined the worker route but didn't specify Vercel function config (maxDuration, memory) | Route specs must include deployment config (timeout, memory, concurrency) alongside the route definition. |
| Environment variable documentation | Planning miss | INGEST_HMAC_SECRET, RESEND_API_KEY, ADMIN_EMAIL not in the plan's "what to verify" section | Every new env var must appear in both the plan's verification checklist AND the CLAUDE.md environment section. |
| Legistar + OpenStates combined into single commit | Plan deviation | Plan had separate tasks (9, 10) but implementation was cleaner as one commit | When two tasks share 80%+ structure (both are fetcher implementations), the plan should note they may merge. |

## Systemic Patterns (convert to CLAUDE.md rules)

1. **Platform API contracts in specs:** When a spec depends on a platform behavior (Vercel cron auth, Supabase RLS, etc.), quote the exact API contract and link to the docs page. Don't describe from memory.
2. **Deployment config is part of route design:** Any new API route spec must include: maxDuration, memory, concurrency limits, and whether it needs Fluid Compute.
3. **Env var lifecycle:** New env vars get a row in the plan's verification table with: name, where to set (local, Vercel production, Vercel preview), and who/what provisions it.
4. **Review checkpoint commits:** Plans with 10+ implementation commits should budget one "address review findings" commit. This is not unplanned work; it's expected hygiene.
5. **Fetcher consolidation rule:** When 2+ tasks are structural clones (same interface, same test pattern, different data source), note in the plan that they may ship as one commit.

## What Worked Well

- **Research phase paid off:** The pre-spec research doc (c7-feed-ingestion-research.md) answered 8 open product questions before the spec was drafted. Zero scope surprises during implementation.
- **Spec review caught security issues early:** 12 security findings (4 critical) were identified during spec review, not during code review. SSRF protection was designed before any code existed.
- **TDD discipline held:** Every module had tests written before implementation. 228 tests passing at merge, zero regressions in existing test suite.
- **Pipeline extraction refactor was clean:** Extracting `processCivicDocument()` from the upload route into a shared module (Task 6) was the riskiest refactor. The spec's "reuse analysis" section made it straightforward.
- **12% unplanned vs C8's 40%:** The C8 retro lessons (state machine tables, NOT in scope section, Supabase patterns) directly reduced planning misses. The spec template improvements worked.
- **Fire-and-forget architecture was the right call:** HMAC-signed worker dispatch avoided the complexity of a job queue while keeping the cron orchestrator simple. No state management bugs.
- **Cost controls designed upfront:** Daily budget (50 API calls), auto-disable at 5 failures, and conditional HTTP requests were all in the spec. No runaway API costs.

## Comparison: C7 vs C8

| Metric | C8 | C7 | Delta |
|---|---|---|---|
| Unplanned work | 40% | 12% | -28pp |
| Post-planning additions | 15 | 5 | -10 |
| Planning misses | 8 | 3 | -5 |
| Bug fixes (unplanned) | 4 | 2 | -2 |
| Emergent issues | 2 | 0 | -2 |

The spec template improvements from C8's retro (render tree audit, state machine tables, five states per component, NOT in scope, TypeScript types for API responses) measurably reduced planning misses. C7 was also server-side only (no UI), which eliminates an entire category of planning misses (rendering states, i18n, responsive layout).
