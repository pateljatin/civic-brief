# C63 CSP Regression CI: Planning Retrospective

**Date:** 2026-05-09
**Issue:** #63, PR #69
**Planned:** Light brainstorm (3 questions) → 4 files + commit + monitor CI
**Actual:** 4 files + 1 fix iteration + 2 squashed commits, single overnight session

---

## Planned vs Actual

| Step | Planned | Actual | Delta |
|------|---------|--------|-------|
| Brainstorm | 3 questions, locked design | 3 questions, locked design | On target |
| Spec doc | Sonnet subagent writes design doc | 1 subagent (`docs/superpowers/specs/2026-05-08-csp-regression-ci-design.md`) | On target |
| Workflow YAML | Sonnet subagent writes `csp-regression.yml` | 1 subagent + manual fix to action versions and stale comment | +1 manual fix commit-internal |
| Test header injection | Sonnet subagent edits `csp.spec.ts` | 1 subagent + manual addition of `x-vercel-set-bypass-cookie` header | +1 manual fix commit-internal |
| CONTRIBUTING.md | Haiku subagent appends Security subsection | 1 subagent | On target |
| Local verification | typecheck + vitest + baseline | typecheck + 407/407 vitest + baseline gate | On target |
| First CI run | Pass | **Fail** — `vercel.live/feedback.js` CSP false positive on every page-load test | -1 unplanned iteration |
| Fix iteration | Not planned | Filter `vercel.live/*` in violation listener (commit `880ec35`) | +1 commit |
| Final CI run | Pass | Pass (csp-check 51s, test 58s, Vercel deploys pass) | On target |
| Watcher script | One-shot `gh pr checks` poll loop | First version used `jq` (not on Windows bash); rewrote with `gh --jq` flag | +1 internal rewrite |

## Unplanned Additions

| Addition | Category | Should it have been in the plan? |
|----------|----------|--------------------------------|
| Action version verification (`gh api` for `actions/checkout`, `setup-node`, `upload-artifact` latest releases) | Subagent verification | Yes — implicit. Subagents WILL claim "current" versions that may be wrong (`actions/upload-artifact@v7` does not exist; latest is v6.0.2). Anything a subagent looks up against external services should be cross-checked before commit. |
| `x-vercel-set-bypass-cookie: true` added alongside `x-vercel-protection-bypass` | Defense in depth, missed during initial design | Borderline. The workflow YAML subagent flagged it; the test edit subagent did not. Better catch from the workflow subagent's wider doc-reading scope. |
| `vercel.live/*` violation filter in `csp.spec.ts` | Bug found in CI verification | No. Vercel-preview-only widget injection is non-obvious knowledge (now captured in `feedback_vercel_live_preview_widget.md`). Acceptable to discover via the first real CI run. |
| Watcher rewrite (`jq` → `gh --jq`) | Windows env gotcha | Yes — should have remembered. `feedback`-class memory exists for "Windows jq NOT available." Cost: one wasted 20-min watcher cycle. |
| Manual edit to fix workflow action versions (v6/v7 → v4 for consistency) | Subagent hallucination correction | Yes — the same as the action version verification. The subagent claimed verification but produced one wrong version (`upload-artifact@v7`). |

## What Went Well

1. **Parallel subagent dispatch saved real wall-clock time.** Four subagents (3 Sonnet, 1 Haiku) wrote 4 files concurrently in ~5 min where serial would have been ~20 min. The model-per-task split (Haiku for the trivial doc append, Sonnet for the test edit and YAML and spec) was the right shape.
2. **Pre-CI smoke test caught the test would run cleanly against prod.** Running `E2E_BASE_URL=https://civic-brief.vercel.app npx playwright test tests/e2e/csp.spec.ts --project=chromium` before any CI change proved the test itself was sound. When CI failed, attribution was straightforward (preview-only environmental issue, not a CSP regression and not a test bug).
3. **Bypass header worked first try.** The unsafe-eval test passed in the first CI run, which proved Playwright was reaching the actual app (not Vercel's auth wall). That eliminated half the possible failure modes immediately.
4. **`deployment_status` trigger choice held up.** Workflow fired on the preview deploy of the feature branch as expected. No fork-PR scenarios tested in this session, but the design rationale (secrets in base-repo context) remains sound.
5. **User pre-approval boundary held.** Pre-flight discussion explicitly forbid touching `src/proxy.ts` or CSP itself without the user. When the first CI failure looked like a CSP regression, the diagnosis correctly identified it as a third-party (Vercel) injection rather than an own-origin issue, and the fix stayed in test code.

## What Went Wrong

1. **Subagent claimed action version verification but hallucinated `upload-artifact@v7`.** That version does not exist. Caught by manual `gh api repos/actions/upload-artifact/releases/latest` cross-check before push. Lesson: never trust a subagent's "I verified X via WebFetch" without spot-checking the answer. Subagents are not above hallucinating verification *steps*.
2. **Did not anticipate the Vercel preview-only feedback widget.** The `vercel.live/_next-live/feedback/feedback.js` script ships only on previews. Two ways to know in advance: (a) load a preview deploy in DevTools and look at console violations, (b) read Vercel's deployment-protection or comments docs. Neither was done. The CI failure loop made this visible at the cost of one extra commit and one extra Vercel deploy cycle.
3. **Watcher script was written without checking `feedback` memory.** Memory has the gotcha "Windows: `jq` and `bc` NOT available; use Node.js for JSON parsing." First watcher used `jq` directly. Cost: 20 min of silent failure during the user's overnight wait. The user's `feedback` memory style exists exactly to prevent this; it works only if I read it.

## Extracted Rules

1. **Cross-check subagent-reported version/API claims against an authoritative source** (`gh api repos/<owner>/<repo>/releases/latest`, `npm view <pkg> version`, official changelog) before commit. Subagents will say "I WebFetched X" and then state a wrong fact. The fact, not the verification claim, is what matters.
2. **Before any test that runs against a Vercel preview, manually load a preview deploy in DevTools and inventory environmental injections.** vercel.live, vercel.com toolbar, future widgets — preview deploys are not byte-for-byte production. Test code that asserts on console state must account for what ships in the actual environment under test, which is the preview, not main.
3. **Re-read the `feedback` memory section before writing any cross-platform shell script in this repo.** The Windows gotchas (no `jq`, no `bc`, no `zip`, use `7z`) are exactly the things memory exists for. A 5-second memory grep would have prevented the 20-min wasted watcher cycle.
4. **Always set the watcher's terminal exit cleanly.** The first watcher silently looped on `jq` errors and only emitted state at the timeout fallback. Watchers must emit on error, not just on success — match the Monitor skill's "silence is not success" principle.

## Memory Updates Made During This Work

- **Added** `feedback_vercel_live_preview_widget.md`: filter `vercel.live/*` in any preview-target CSP test
- **Added** `project_c63_csp_ci.md`: PR #69 status, two-iteration CI history
- **Updated** `MEMORY.md` Gotchas line to note `gh --jq` as the cross-platform jq workaround
- **Updated** `MEMORY.md` Project State checkpoint date and branch
- **Removed** `#63` from "Next v1.1 items (remaining)"

## Metrics

- **Commits on branch:** 2 (`bad4baa` initial, `880ec35` vercel.live filter fix), squashed at merge to `f53c449`
- **Files changed:** 4 (1 new workflow, 1 modified test, 1 modified doc, 1 new spec)
- **Tests added:** 0 (unit baseline unchanged at 407, E2E unchanged at 84). The new workflow runs a subset of existing E2E (`csp.spec.ts`, 5 tests) against a different target.
- **Dependencies added:** 0
- **Migration:** none
- **CI runtime:** 51s (`csp-check`), 58s (`test`)
- **Time from branch creation to merge:** ~17h (2026-05-08 23:30 UTC → 2026-05-09 23:49 UTC), most of it overnight wait between user setup of secret and CI completion
- **Snapshot before merge:** 269M (`civic-brief-20260509-164830-c63-pre-merge.7z`)
- **Subagent dispatch:** 4 parallel (3 Sonnet, 1 Haiku); ~80s longest, ~17s shortest
