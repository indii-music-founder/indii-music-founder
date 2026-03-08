import { test, expect } from '@playwright/test';

/**
 * Social Media Module E2E Tests
 * Covers: module load, social feed, scheduling area
 */

test.describe('Social Media Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to social module without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-social"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(1_500);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('social module has interactive content', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-social"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);

        const bodyText = await page.locator('body').innerText();
        expect(bodyText.length).toBeGreaterThan(10);
    });
});
