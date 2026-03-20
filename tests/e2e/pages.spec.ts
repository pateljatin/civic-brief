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

test.describe('Home page (landing)', () => {
  test('loads and shows headline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('your language');
  });

  test('has try it now CTA', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('a[href="/upload"]').first();
    await expect(cta).toBeVisible();
  });

  test('shows scenario tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Five scenarios')).toBeVisible();
  });

  test('scenario tabs work', async ({ page }) => {
    await page.goto('/');
    await page.getByText('School Board').click();
    await expect(page.getByText('Resolution 2026-0142')).toBeVisible();
  });

  test('shows how it works section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('How it works')).toBeVisible();
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

  test('shows daily limit indicator', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.getByText(/demo uses remaining today|Daily demo limit/)).toBeVisible();
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
    await expect(page.getByText('Demo brief (database not connected)')).toBeVisible();
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
    await expect(page.getByText(/High confidence/)).toBeVisible();
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

test.describe('Language switching', () => {
  test('demo brief switches to Spanish labels and content', async ({ page }) => {
    await page.goto('/brief/demo');

    // English labels visible initially
    await expect(page.getByText('What changed')).toBeVisible();
    await expect(page.getByText('Who is affected')).toBeVisible();

    // Click Espanol pill
    await page.getByRole('button', { name: 'Espanol' }).click();

    // Section labels should be in Spanish
    await expect(page.getByText('Que cambio')).toBeVisible();
    await expect(page.getByText('Quien se ve afectado')).toBeVisible();
    await expect(page.getByText('Que puedes hacer')).toBeVisible();
    await expect(page.getByText('A donde va el dinero')).toBeVisible();
    await expect(page.getByText('Fechas importantes')).toBeVisible();
    await expect(page.getByText('Alta confianza')).toBeVisible();

    // Content should be Spanish (use heading to avoid strict mode on multiple matches)
    await expect(page.getByRole('heading', { name: /impuesto a la propiedad/ })).toBeVisible();

    // Feedback button should be translated
    await expect(page.getByRole('button', { name: /til/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reportar/i })).toBeVisible();
  });

  test('demo brief switches back to English', async ({ page }) => {
    await page.goto('/brief/demo');

    // Switch to Spanish then back to English
    await page.getByRole('button', { name: 'Espanol' }).click();
    await expect(page.getByText('Que cambio')).toBeVisible();

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('What changed')).toBeVisible();
    await expect(page.getByText('Who is affected')).toBeVisible();
    await expect(page.getByText('High confidence')).toBeVisible();
  });
});

test.describe('Landing redirect', () => {
  test('/landing redirects to /', async ({ page }) => {
    await page.goto('/landing');
    await expect(page).toHaveURL('/');
  });
});

test.describe('Navigation', () => {
  test('nav bar is present on all pages', async ({ page }) => {
    for (const path of ['/', '/upload', '/brief/demo']) {
      await page.goto(path);
      await expect(page.getByText('Civic Brief').first()).toBeVisible();
    }
  });

  test('upload link navigates to upload page', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/upload"]');
    await expect(page).toHaveURL('/upload');
  });

  test('footer has GitHub link', async ({ page }) => {
    await page.goto('/');
    const ghLink = page.locator('a[href="https://github.com/pateljatin/civic-brief"]').first();
    await expect(ghLink).toBeVisible();
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
