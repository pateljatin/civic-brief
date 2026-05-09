# C16 Civic Eval Agent: Planning Retrospective

**Date:** 2026-05-08
**Issue:** #55, PR #66
**Planned:** 12 tasks
**Actual:** 12 tasks + 4 hygiene commits, single session implementation, finished from a prior session

---

## Planned vs Actual

| Task | Planned commits | Actual commits | Delta |
|------|-----------------|----------------|-------|
| 1. syllable dep + migration 011 | 1 | 1 (`b2559bb`) | On target |
| 2. Eval Zod schemas | 1 | 1 (`bca118b`) | On target |
| 3. FK readability module | 1 | 1 (`5e01640`) | On target |
| 4. Composite scoring | 1 | 2 (`5706810`, `c08f112`) | +1 trivial doc comment |
| 5. Gemini Flash tone | 1 | 1 (`593be23`) | On target |
| 6. Eval orchestrator | 1 | 1 (`e03929e`) | On target |
| 7. Pipeline integration | 1 | 2 (`4845d2a`, `d5aaa2a`) | +1 baseline bump |
| 8. UI strings (en/es/hi) | 1 | 1 (`3748b8d`) | On target |
| 9. QualityBadges component | 1 | 1 (`8ec3f39`) | On target |
| 10. Wire badges into UI | 1 | 1 (`b5f33fa`) | On target |
| 11. Backfill script | 1 | 1 (`7acdb6a`) | On target |
| 12. Final verification | 1 | 2 (`f83d17e`, `c2b1b6a`) | +1 SSR pending tone fix |
| **Unplanned: spec + plan docs commit** | -- | 1 (`1119e81`) | Should have been Task 0 |

## Unplanned Additions

| Addition | Category | Should it have been in the plan? |
|----------|----------|--------------------------------|
| `c08f112` clarify FK-only path comment | Code review hygiene | No. One-line clarification surfaced during self-review of scoring tests. Correct scope to ship inline. |
| `d5aaa2a` baseline bump to 394 | Expected hygiene | Yes. Plan's "Review checkpoint budget" rule (from C8 retro) says plans with 10+ commits should budget hygiene commits. Mid-plan baseline bumps are exactly this. |
| `f83d17e` baseline bump to 406 | Expected hygiene | Same as above. Two bumps because tests landed in two waves (FK module + tone module). Acceptable. |
| `c2b1b6a` suppress stuck pending tone badge on SSR + guard NaN readability | Bug found in verification | No. Found correctly during Task 12 verification. Proves the verification step works. |
| `1119e81` add design spec and implementation plan to git | Plan hygiene | Yes. The spec and plan markdown files were never committed during plan creation — they sat untracked through 15 implementation commits. Should have been Task 0 or a `docs(c16): add plan` commit at the very start. |

## What Went Well

1. **Plan tracked tightly to commits.** 12 planned tasks → 12 task commits, with each commit's message quoting the planned commit message verbatim. Subagents had no ambiguity about scope per task.
2. **Async/sync split paid off.** The FK-sync, tone-async architecture from the spec held up. Hydration flash was the only surprise and was a one-commit fix.
3. **Hybrid storage shape (column + JSONB) survived first contact.** `eval_overall_score` for indexable queries, `eval_details` for breakdown. No need to alter schema as we wired the UI.
4. **Verification caught a real bug.** Task 12 surfaced the SSR pending tone bug. Without verification on the actual rendered output, this would have shipped to production and triggered a hydration mismatch warning.
5. **Zero scope creep on shared infrastructure.** Despite touching the pipeline, summarize route, brief detail, and showcase pages, the diff stayed focused. Nothing added "while we're here."

## What Went Wrong

1. **Spec and plan docs were never committed.** They sat untracked on the working copy across 15 commits. When the branch was about to ship, they had to be added in a final cleanup commit. Should have been a Task 0: "Commit the plan before starting work."
2. **Long-lived branch.** C16 branch was created on 2026-04-27 and merged on 2026-05-08 — 11 days. During that window, main moved (CSP fix in #62) and required a merge before squash. Not blocking, but adds friction.
3. **Two baseline bumps signal staged completion.** Two bumps mean tests landed in two waves and the baseline was pushed twice. Cheap to do, but a single consolidated bump at the end of the plan is cleaner.

## Extracted Rules

1. **Task 0: commit the spec and plan to the feature branch before any code commits.** This is a one-line addition to every plan. Without it, subagents may work from a doc that doesn't exist on the branch they're committing to, and hygiene gets pushed to the end.
2. **One baseline bump per feature, at the end.** If the plan touches the test count, plan exactly one `chore: bump test baseline to N` commit at Task 12. Mid-plan bumps signal staged shipping that doesn't need to ship staged.
3. **Never let a feature branch live longer than ~7 days without rebasing onto main.** Long-lived branches are mergeable in this case (zero file overlap with the CSP fix), but the longer they live, the more likely a real conflict appears. Worth a calendar reminder for any branch crossing 5 days.

## Metrics

- **Commits on branch:** 16 (12 planned task commits + 1 doc clarify + 2 baseline bumps + 1 SSR fix + 1 docs add)
- **Files changed (vs main):** 25 (4 from main's CSP fix merged in + 21 net C16 files)
- **Tests added:** 32 (407 total, up from 375 pre-C16)
- **Dependencies added:** 1 (`syllable`)
- **Migration:** 011 (3 columns + 1 partial index on `briefs`)
- **CI runtime:** 1m2s
- **Time from branch creation to merge:** 11 days (2026-04-27 → 2026-05-08)
- **Snapshot before merge:** 269M (`civic-brief-20260508-220829-c16-pre-merge.7z`)
