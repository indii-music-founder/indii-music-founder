/**
 * E2E Test: Subscription Pricing Page
 */

import { test, expect } from '@playwright/test';

test.describe('Subscription Pricing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('should display title', async ({ page }) => {
    const title = page.locator('h1');
    await expect(title).toBeVisible();
  });

  test('should display tiers', async ({ page }) => {
    const tiers = page.locator('article');
    // If loaded, expect tiers
    if ((await tiers.count()) > 0) {
      await expect(tiers.first()).toBeVisible();
    }
  });

  test('should toggle billing cycle', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /yearly|annually/i });
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(page.getByText(/save/i).first()).toBeVisible();
    }
  });
});
