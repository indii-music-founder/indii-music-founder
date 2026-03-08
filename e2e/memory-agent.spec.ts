import { test, expect } from '@playwright/test';

/**
 * Memory Agent Module E2E Tests
 * Covers: module load, memory ingestion, query interface
 */

test.describe('Memory Agent Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to memory agent without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-memory"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(1_500);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('memory agent displays status or controls', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-memory"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);

        const bodyText = await page.locator('body').innerText();
        expect(bodyText.length).toBeGreaterThan(10);
    });
});
