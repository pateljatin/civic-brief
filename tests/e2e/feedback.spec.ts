import { test, expect } from '@playwright/test';

test.describe('Community Feedback', () => {
  test('shows feedback buttons on demo brief page', async ({ page }) => {
    await page.goto('/brief/demo');

    const helpfulBtn = page.getByRole('button', { name: /helpful/i });
    const reportBtn = page.getByRole('button', { name: /report issue/i });

    await expect(helpfulBtn).toBeVisible();
    await expect(reportBtn).toBeVisible();
  });

  test('shows helpful count on demo brief', async ({ page }) => {
    await page.goto('/brief/demo');
    await expect(page.getByRole('button', { name: /helpful \(0\)/i })).toBeVisible();
  });

  test('demo brief feedback buttons are disabled', async ({ page }) => {
    await page.goto('/brief/demo');

    const helpfulBtn = page.getByRole('button', { name: /helpful/i });
    const reportBtn = page.getByRole('button', { name: /report issue/i });

    await expect(helpfulBtn).toBeDisabled();
    await expect(reportBtn).toBeDisabled();
  });

  test('feedback section is accessible', async ({ page }) => {
    await page.goto('/brief/demo');

    // Disabled demo buttons have a tooltip explaining why
    const helpfulBtn = page.getByRole('button', { name: /helpful/i });
    const reportBtn = page.getByRole('button', { name: /report issue/i });

    await expect(helpfulBtn).toBeVisible();
    await expect(reportBtn).toBeVisible();

    // Both buttons should have a title attribute with the demo tooltip
    await expect(helpfulBtn).toHaveAttribute('title', /sign in/i);
    await expect(reportBtn).toHaveAttribute('title', /sign in/i);
  });
});
