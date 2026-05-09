import { test, expect } from '@playwright/test';

// Vercel preview deployments are auth-walled by Deployment Protection. The
// bypass header is only sent when the secret is present (no-op locally and
// against public production). The set-bypass-cookie header asks Vercel to also
// set a session cookie so navigation requests Playwright initiates outside
// extraHTTPHeaders coverage still bypass the wall.
const extraHTTPHeaders: Record<string, string> = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? {
      'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
      'x-vercel-set-bypass-cookie': 'true',
    }
  : {};

test.use({ extraHTTPHeaders });

/**
 * Regression test for the C17/C18 CSP miss (issue #61).
 *
 * The production CSP must not block Next.js's RSC bootstrap inline scripts.
 * If `script-src` lacks a per-request nonce + `'strict-dynamic'`, the browser
 * blocks every chunk and hydration silently fails — interactive UI breaks.
 *
 * Run modes:
 *   - default               : uses playwright.config baseURL (dev server);
 *                             this test is meaningful only against a prod
 *                             build, so dev-mode runs are a smoke check.
 *   - E2E_BASE_URL=<url>    : run against an external URL (deployed prod or
 *                             a Vercel preview). This is the one that
 *                             actually exercises the production CSP.
 */

const BASE = process.env.E2E_BASE_URL ?? '';
const url = (path: string) => (BASE ? `${BASE}${path}` : path);

const PAGES = ['/', '/showcase', '/upload', '/location'];

for (const path of PAGES) {
  test(`no CSP script-src violations on ${path}`, async ({ page }) => {
    const violations: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (
        /Content Security Policy directive/i.test(text) &&
        /script-src/i.test(text)
      ) {
        violations.push(text);
      }
    });

    await page.goto(url(path), { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    expect(
      violations,
      `CSP script-src violations on ${path}:\n${violations.join('\n---\n')}`
    ).toHaveLength(0);
  });
}

test('production CSP keeps unsafe-eval out of script-src', async ({
  request,
}) => {
  if (!BASE) {
    test.skip(true, 'Set E2E_BASE_URL to a production-build URL to run this');
  }

  const r = await request.get(`${BASE}/`);
  const csp = r.headers()['content-security-policy'] ?? '';

  expect(csp, 'no CSP header').toBeTruthy();
  // unsafe-eval stays banned in prod even though we currently allow
  // unsafe-inline (see proxy.ts comment on issue #61 follow-up).
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
  expect(csp).toContain("frame-ancestors 'none'");
});
