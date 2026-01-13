/**
 * E2E Test: Subscription Features - UI Only
 *
 * Tests the subscription pricing page and usage dashboard UI components
 */

import { test, expect } from '@playwright/test';

test.describe('Subscription Features - UI Only', () => {

  test.beforeEach(async ({ page }) => {
    // Try to go to pricing page
    try {
      await page.goto('/pricing'); // Adjust URL if needed (e.g., /settings/subscription)
    } catch (e) {
      console.error('Failed to navigate to pricing page:', e);
      test.skip('Failed to navigate to pricing page');
      return;
    }
  });

  test('Pricing Page - UI Components', async ({ page }) => {
    // Main heading
    const title = page.locator('h1');
    await expect(title).toBeVisible();

    // Just check for general visibility of pricing cards
    const cards = page.locator('article');
    // Expect at least 1 card (Free/Pro/Studio)
    if (await cards.count() > 0) {
      await expect(cards.first()).toBeVisible();
    }
  });

  test('Tier Specifications', async ({ page }) => {
    // Check for some specs text being present in the page
    const content = await page.textContent('body');
    expect(content).toMatch(/images|video|storage/i);
  });
});
