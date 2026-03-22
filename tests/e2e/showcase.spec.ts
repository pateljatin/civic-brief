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

test.describe('Showcase grid page', () => {
  test('loads and shows page title', async ({ page }) => {
    await page.goto('/showcase');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('renders all 5 scenario cards', async ({ page }) => {
    await page.goto('/showcase');
    const cards = page.locator('a[href^="/showcase/"]');
    await expect(cards).toHaveCount(5);
  });

  test('each card has correct link', async ({ page }) => {
    await page.goto('/showcase');
    const expectedSlugs = ['budget', 'school-board', 'zoning', 'legislation', 'health-insurance'];
    for (const slug of expectedSlugs) {
      await expect(page.locator(`a[href="/showcase/${slug}"]`)).toBeVisible();
    }
  });

  test('cards show titles', async ({ page }) => {
    await page.goto('/showcase');
    await expect(page.getByText('Budget Season')).toBeVisible();
    await expect(page.getByText('School Board')).toBeVisible();
    await expect(page.getByText('Zoning Change')).toBeVisible();
    await expect(page.getByText('State Legislation')).toBeVisible();
    // Title is "Health Insurance & Rx Costs" — match partially to avoid special-char fragility
    await expect(page.getByText(/Health Insurance/)).toBeVisible();
  });

  test('passes accessibility checks', async ({ page }) => {
    await page.goto('/showcase');
    await checkA11y(page, 'Showcase');
  });

  test('has security headers', async ({ page }) => {
    const response = await page.goto('/showcase');
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
    expect(response?.headers()['x-frame-options']).toBe('DENY');
  });
});

test.describe('Showcase detail page', () => {
  test('loads budget scenario', async ({ page }) => {
    await page.goto('/showcase/budget');
    await expect(page.locator('h1')).toContainText('Budget Season');
  });

  test('shows back link to showcase', async ({ page }) => {
    await page.goto('/showcase/budget');
    await expect(page.locator('a[href="/showcase"]')).toBeVisible();
  });

  test('renders scenario hero', async ({ page }) => {
    await page.goto('/showcase/budget');
    const heroSection = page.locator('[data-testid="scenario-hero"]');
    await expect(heroSection).toBeVisible();
  });

  test('returns 404 for invalid scenario', async ({ page }) => {
    const response = await page.goto('/showcase/nonexistent');
    expect(response?.status()).toBe(404);
  });

  test('passes accessibility checks', async ({ page }) => {
    await page.goto('/showcase/budget');
    await checkA11y(page, 'Showcase Detail');
  });
});

test.describe('Homepage showcase link', () => {
  test('has "See it in action" link to /showcase', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('a[href="/showcase"]');
    await expect(link).toBeVisible();
  });
});
