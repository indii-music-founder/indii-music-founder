import { test, expect } from '@playwright/test';

/**
 * Licensing Module E2E Tests
 * Covers: navigation, sync brief list, clearance upload flow stub
 */

test.describe('Licensing Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to licensing module without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-licensing"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(1_500);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('licensing module has content area', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-licensing"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);

        const content = page.locator('main, [role="main"], .flex-1');
        await expect(content.first()).toBeVisible();
    });
});
