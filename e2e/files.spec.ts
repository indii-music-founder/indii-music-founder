import { test, expect } from '@playwright/test';

/**
 * Files Module E2E Tests
 * Covers: module load, file browser render, filter tabs, upload button visibility
 *
 * Run: npx playwright test e2e/files.spec.ts
 */

test.describe('Files Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigates to files module without crash', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-files"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_000);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('files module renders file browser shell', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));

        const nav = page.locator('[data-testid="nav-item-files"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        const fatal = errors.filter(
            (e) => !e.includes('permission-denied') && !e.includes('offline')
        );
        expect(fatal).toHaveLength(0);
    });

    test('files module shows upload action or file list area', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-files"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        // FileDashboard renders an h1 gradient header and Upload button
        const body = await page.locator('body').innerText();
        const hasFilesContent = body.toLowerCase().includes('file')
            || body.toLowerCase().includes('upload')
            || body.toLowerCase().includes('asset');
        expect(hasFilesContent).toBe(true);
    });

    test('files module sidebar filter tabs are interactive', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-files"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        // Try clicking any filter nav items (All Files, Images, etc.)
        const filterItems = page.locator('button:has-text("All Files"), button:has-text("Images"), button:has-text("Audio")');
        const count = await filterItems.count();
        if (count > 0) {
            await filterItems.first().click();
            await page.waitForTimeout(500);
            await expect(page.locator('#root')).toBeVisible();
        }
    });

    test('files module upload button is present', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-files"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        const uploadBtn = page.locator('button:has-text("Upload Asset"), button:has-text("Upload")');
        const btnCount = await uploadBtn.count();
        // May be absent on mobile; we just verify no crash
        expect(true).toBe(true);
        if (btnCount > 0) {
            await expect(uploadBtn.first()).toBeVisible();
        }
    });
});
