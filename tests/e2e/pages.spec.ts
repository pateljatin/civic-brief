import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── Accessibility helper ──
async function checkA11y(page: import('@playwright/test').Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    // Allow known non-critical issues during development
    (v) => !['color-contrast'].includes(v.id)
  );

  if (violations.length > 0) {
    const summary = violations
      .map((v) => `${v.id}: ${v.description} (${v.nodes.length} instances)`)
      .join('\n');
    console.warn(`Accessibility issues on ${name}:\n${summary}`);
  }

  // Fail on serious or critical violations
  const serious = violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  expect(serious, `Serious a11y violations on ${name}`).toHaveLength(0);
}

test.describe('Home page', () => {
  test('loads and shows headline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Government documents');
  });

  test('has upload link', async ({ page }) => {
    await page.goto('/');
    const uploadLink = page.locator('a[href="/upload"]').first();
    await expect(uploadLink).toBeVisible();
  });

  test('passes accessibility checks', async ({ page }) => {
    await page.goto('/');
    await checkA11y(page, 'Home');
  });
});

test.describe('Upload page', () => {
  test('loads and shows form', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.locator('h1')).toContainText('Upload a document');
  });

  test('has file drop zone', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.getByText('Drop a government PDF here, or click to browse')).toBeVisible();
  });

  test('has source URL input', async ({ page }) => {
    await page.goto('/upload');
    const input = page.locator('#sourceUrl');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'url');
    await expect(input).toHaveAttribute('required', '');
  });

  test('submit button is disabled without file and URL', async ({ page }) => {
    await page.goto('/upload');
    const button = page.locator('button[type="submit"]');
    await expect(button).toBeDisabled();
  });

  test('passes accessibility checks', async ({ page }) => {
    await page.goto('/upload');
    await checkA11y(page, 'Upload');
  });
});

test.describe('Brief demo page', () => {
  test('loads demo brief', async ({ page }) => {
    await page.goto('/brief/demo');
    await expect(page.getByText('Demo brief')).toBeVisible();
  });

  test('shows civic brief sections', async ({ page }) => {
    await page.goto('/brief/demo');
    await expect(page.getByText('What changed')).toBeVisible();
    await expect(page.getByText('Who is affected')).toBeVisible();
    await expect(page.getByText('What you can do')).toBeVisible();
  });

  test('shows confidence score', async ({ page }) => {
    await page.goto('/brief/demo');
    await expect(page.getByText(/92%/)).toBeVisible();
    await expect(page.getByText('High confidence')).toBeVisible();
  });

  test('shows source verification link', async ({ page }) => {
    await page.goto('/brief/demo');
    await expect(page.getByText(/Verify/)).toBeVisible();
  });

  test('passes accessibility checks', async ({ page }) => {
    await page.goto('/brief/demo');
    await checkA11y(page, 'Brief Demo');
  });
});

test.describe('Landing page', () => {
  test('loads all sections', async ({ page }) => {
    await page.goto('/landing');
    await expect(page.locator('h1')).toContainText('your language');
    await expect(page.getByText('Five scenarios')).toBeVisible();
    await expect(page.getByText('How it works')).toBeVisible();
  });

  test('scenario tabs work', async ({ page }) => {
    await page.goto('/landing');
    // Click School Board tab
    await page.getByText('School Board').click();
    await expect(page.getByText('Resolution 2026-0142')).toBeVisible();
  });

  test('passes accessibility checks', async ({ page }) => {
    await page.goto('/landing');
    await checkA11y(page, 'Landing');
  });
});

test.describe('Navigation', () => {
  test('nav bar is present on all pages', async ({ page }) => {
    for (const path of ['/', '/upload', '/landing', '/brief/demo']) {
      await page.goto(path);
      await expect(page.getByText('Civic Brief').first()).toBeVisible();
    }
  });

  test('upload link navigates to upload page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/upload"]');
    await expect(page).toHaveURL('/upload');
  });
});

test.describe('Security headers', () => {
  test('response has security headers', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response!.headers();

    // These are set in next.config.js
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

test.describe('Mobile responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('home page renders on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('upload form is usable on mobile', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.getByText('Drop a government PDF here, or click to browse')).toBeVisible();
    const input = page.locator('#sourceUrl');
    await expect(input).toBeVisible();
  });
});
