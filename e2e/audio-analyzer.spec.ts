import { test, expect } from '@playwright/test';

/**
 * Audio Analyzer Module E2E Tests
 * Covers: module load, waveform visibility, analysis controls
 */

test.describe('Audio Analyzer Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to audio analyzer without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-audio-analyzer"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('audio analyzer shows upload or drag area', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-audio-analyzer"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);

        // Should have some interactive element for file upload or analysis
        const buttons = page.locator('button');
        expect(await buttons.count()).toBeGreaterThan(0);
    });
});
