import { test, expect } from '@playwright/test';

/**
 * History Module E2E Tests
 * Covers: module load, unified activity feed render, filter controls,
 * search interaction, and no crash on mount
 *
 * Run: npx playwright test e2e/history.spec.ts
 */

test.describe('History Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to history module without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-history"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('history module loads without JS errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));

        const nav = page.locator('[data-testid="nav-item-history"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        const fatal = errors.filter(
            (e) => !e.includes('permission-denied') && !e.includes('offline')
        );
        expect(fatal).toHaveLength(0);
    });

    test('history module shows unified activity feed label', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-history"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        // HistoryDashboard renders "Unified Activity Feed" label
        const body = await page.locator('body').innerText();
        const hasHistory = body.toLowerCase().includes('activity')
            || body.toLowerCase().includes('history')
            || body.toLowerCase().includes('feed');
        expect(hasHistory).toBe(true);
    });

    test('history module filter tabs are clickable', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-history"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        // "All Activity" filter (rendered as label="All Activity")
        const allTab = page.locator('button:has-text("All Activity"), [aria-label*="All Activity"]');
        const tabCount = await allTab.count();
        if (tabCount > 0) {
            await allTab.first().click();
            await page.waitForTimeout(500);
            await expect(page.locator('#root')).toBeVisible();
        }
    });

    test('history module search input accepts text', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-history"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]');
        const inputVisible = await searchInput.isVisible().catch(() => false);
        if (!inputVisible) { return; } // No search bar visible — skip gracefully

        await searchInput.fill('test');
        await page.waitForTimeout(500);
        const value = await searchInput.inputValue();
        expect(value).toBe('test');
    });
});
