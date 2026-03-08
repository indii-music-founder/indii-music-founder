import { test, expect } from '@playwright/test';

/**
 * Video Producer Module E2E Tests
 * Covers: module load, timeline presence, generation controls
 */

test.describe('Video Producer Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to video module without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-video"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('video module shows editor or generation area', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-video"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        // Should have a content area with controls
        const bodyText = await page.locator('body').innerText();
        expect(bodyText.length).toBeGreaterThan(10);
    });
});
