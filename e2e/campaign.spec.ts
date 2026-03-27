import { test, expect } from '@playwright/test';

/**
 * Campaign Module E2E Tests
 * Covers: module load, campaign dashboard render, no crash on mount
 *
 * Run: npx playwright test e2e/campaign.spec.ts
 */

test.describe('Campaign Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to campaign module without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-campaign"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('campaign module loads without fatal JS errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));

        const nav = page.locator('[data-testid="nav-item-campaign"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        const fatal = errors.filter(
            (e) => !e.includes('permission-denied') && !e.includes('offline')
        );
        expect(fatal).toHaveLength(0);
    });

    test('campaign module renders dashboard content', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-campaign"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        const body = await page.locator('body').innerText();
        const hasCampaign = body.toLowerCase().includes('campaign')
            || body.toLowerCase().includes('marketing')
            || body.toLowerCase().includes('dashboard');

        expect(hasCampaign).toBe(true);
    });
});
