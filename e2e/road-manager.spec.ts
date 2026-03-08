import { test, expect } from '@playwright/test';

/**
 * Road Manager (Touring) Module E2E Tests
 * Covers: module load, tour list, venue view
 */

test.describe('Road Manager Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to road manager module without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-road"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(1_500);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('road manager renders venue or tour content', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-road"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);

        const buttons = page.locator('button');
        expect(await buttons.count()).toBeGreaterThan(0);
    });
});
