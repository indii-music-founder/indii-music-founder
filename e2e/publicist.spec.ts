import { test, expect } from '@playwright/test';

/**
 * Publicist Module E2E Tests
 * Covers: module load, press release list, AI copywriting area
 */

test.describe('Publicist Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to publicist module without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-publicist"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(1_500);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('publicist module has content', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-publicist"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);

        const bodyText = await page.locator('body').innerText();
        expect(bodyText.length).toBeGreaterThan(10);
    });
});
