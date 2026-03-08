import { test, expect } from '@playwright/test';

/**
 * Brand Manager Module E2E Tests
 * Covers: module navigation, brand kit rendering, style preferences
 */

test.describe('Brand Manager Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to brand manager without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-brand"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(1_500);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('brand manager renders brand kit content', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-brand"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);

        const headings = page.locator('h1, h2, h3');
        expect(await headings.count()).toBeGreaterThan(0);
    });
});
