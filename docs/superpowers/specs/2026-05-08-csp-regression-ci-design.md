# C63: CSP Regression CI Design Spec

**Date:** 2026-05-08
**Issue:** #63
**Status:** Draft
**Author:** Jatin + Engineer Agent

---

## Why

PR #61 dropped `'unsafe-inline'` from the production `script-src` directive during CSP hardening. The change was verified against the dev server and via curl, neither of which exercises the production CSP in a real browser. Next.js RSC bootstrap emits inline scripts that the hardened directive blocked; hydration silently failed on every page in production for roughly two weeks. The regression surfaced only when an unrelated redeploy changed the environment.

PR #62 added `tests/e2e/csp.spec.ts` as a regression guard, but the test runs locally on demand only. It does nothing to stop the same class of bug from shipping again. This spec turns that test into an automatic PR check against a production-built deployment.

---

## Goal

Run `tests/e2e/csp.spec.ts` against the Vercel preview URL on every PR, and hard-fail the PR check if any assertion fails.

---

## Architecture and Data Flow

```
PR opened / pushed
       |
  [Vercel builds preview deployment]
       |
  [GitHub emits `deployment_status` event: state=success, environment=Preview]
       |
  [csp-regression.yml triggers]
       |
  [Workflow reads environment_url from event payload]
       |
  [Guard: skip if environment_url matches civic-brief.vercel.app (production alias)]
       |
  [Guard: exit 1 if VERCEL_AUTOMATION_BYPASS_SECRET is not set]
       |
  [Install Playwright + Chromium]
       |
  [Run: E2E_BASE_URL=<preview_url> npx playwright test tests/e2e/csp.spec.ts --project chromium]
        (extraHTTPHeaders: { x-vercel-protection-bypass: <secret> } injected in csp.spec.ts)
       |
  [Pass / Fail -> GitHub check on PR]
```

### Why `deployment_status`, not `pull_request`

`pull_request` events from forks run in the fork's context and cannot access repo secrets. The CSP bypass token is a secret. A workflow that silently skips on every external contribution is not a guardrail.

`deployment_status` events run in the base repository's context regardless of fork origin. Secrets are available. The practical trade-off: fork PRs only get the check after a maintainer approves the Vercel preview deployment (standard OSS gate). That is acceptable; maintainer approval already gates the deploy itself.

GitHub Actions docs: "With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner when a workflow is triggered from a forked repository." ([docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)) `deployment_status` is exempt because it fires in the base repo context, not the fork's.

### Bypass auth

Vercel deployment protection walls preview URLs by default. The bypass mechanism sends two headers on every Playwright request: `x-vercel-protection-bypass: <VERCEL_AUTOMATION_BYPASS_SECRET>` to authorize the request, and `x-vercel-set-bypass-cookie: true` to ask Vercel to set a session cookie that covers any browser-initiated navigations Playwright does not route through `extraHTTPHeaders`. The headers are injected directly in `tests/e2e/csp.spec.ts` via `test.use({ extraHTTPHeaders })` at module scope when `VERCEL_AUTOMATION_BYPASS_SECRET` is set in the environment.

Vercel docs on the bypass header: "Set the `x-vercel-protection-bypass` header to the value of your Bypass for Automation secret." ([vercel.com/docs/deployments/deployment-protection](https://vercel.com/docs/deployments/deployment-protection))

---

## Components

| File | Change |
|------|--------|
| `.github/workflows/csp-regression.yml` | ADD. New workflow triggered by `deployment_status`. |
| `tests/e2e/csp.spec.ts` | MODIFY. Inject `x-vercel-protection-bypass` header via `extraHTTPHeaders` when `E2E_BASE_URL` is set. |
| `CONTRIBUTING.md` | MODIFY. One paragraph: note that CSP is checked automatically on every PR against the preview deploy, and that `VERCEL_AUTOMATION_BYPASS_SECRET` must be configured in GitHub repo secrets. |
| This spec doc | ADD. |

### Environment variables

| Variable | Where to set | Who provisions |
|----------|-------------|----------------|
| `VERCEL_AUTOMATION_BYPASS_SECRET` | GitHub repo secrets (Actions) | Maintainer, from Vercel dashboard under Deployment Protection |

The secret is NOT needed in `.env.local` and NOT needed in Vercel's own env vars. It lives only in GitHub Actions secrets.

---

## Failure Modes

| Scenario | What happens |
|----------|-------------|
| `VERCEL_AUTOMATION_BYPASS_SECRET` not set in GitHub Actions | Workflow exits 1 immediately with message: "VERCEL_AUTOMATION_BYPASS_SECRET is not set. Add it to GitHub repo secrets." PR check is red. No test work runs. |
| `environment_url` matches production alias `civic-brief.vercel.app` | Workflow skips with a logged warning. Prevents running the check against production on post-merge deploys. |
| Vercel preview takes longer than usual to reach `state=success` | Not a workflow concern. GitHub does not emit `deployment_status` until Vercel reports success. The workflow starts only after the event fires. |
| Preview URL returns 401 (bypass header missing or wrong secret) | Playwright `page.goto()` lands on Vercel's auth wall, not the app. Console CSP assertions pass vacuously; the `Content-Security-Policy` header assertion fails because the Vercel auth page does not set the app's CSP header. PR check is red. The failure message makes the root cause clear. |
| CSP test fails because a legit code change broke hydration | PR check is red. That is the intended behavior. |
| Chromium not available on runner | `npx playwright install --with-deps chromium` step fails before tests run. PR check is red with a clear install error. |

---

## Verification

After merging, the check works correctly if all of the following are true:

1. A new PR is opened. Vercel creates a preview. The `csp-regression` check appears on the PR alongside the existing `CI / test` check.
2. The check passes green on a clean PR with no CSP changes.
3. A test branch that manually strips `'unsafe-inline'` from the production `script-src` in `src/proxy.ts` causes the check to go red. (Reproduce the #61 class of bug; confirm the guard catches it.)
4. GitHub Actions logs show the preview URL under test, the bypass header in use, and per-page pass/fail lines from Playwright.
5. A fork PR from an external contributor shows the check as pending until a maintainer approves the Vercel preview deploy, then resolves to pass or fail.

---

## Out of Scope

- Running the full E2E suite (`npx playwright test` without a file filter) against the preview. Only `tests/e2e/csp.spec.ts` runs in this workflow.
- Replacing or modifying the existing `CI / test` job in `.github/workflows/ci.yml`. The dev-mode E2E job stays as-is.
- A post-merge CSP check against the production URL. That is a separate decision (cron-based UptimeRobot or a `deployment_status` filter on the production environment).
- Switching the CSP to nonce + `'strict-dynamic'`. Blocked on Next.js 16 + Turbopack auto-nonce reliability. See the comment in `src/proxy.ts`.
- Playwright browsers other than Chromium. CSP enforcement behavior is consistent across engines for the assertions in this test.
