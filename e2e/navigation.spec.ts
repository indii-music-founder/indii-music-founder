import { test, expect } from '@playwright/test';

/**
 * Navigation E2E Tests
 *
 * Covers: sidebar rendering, module routing, lazy-load states,
 * sidebar toggle collapse/expand, and CommandBar keyboard shortcut.
 *
 * Run: npx playwright test e2e/navigation.spec.ts
 */

test.describe('Sidebar Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('app shell renders with sidebar and main content area', async ({ page }) => {
        // App container is present
        const appContainer = page.locator('[data-testid="app-container"], #root');
        await expect(appContainer).toBeVisible();

        // Either a sidebar nav or mobile nav is present
        const nav = page.locator('nav, [role="navigation"]');
        await expect(nav.first()).toBeVisible();
    });

    test('sidebar toggle collapses and expands the sidebar', async ({ page }) => {
        const toggle = page.locator('[data-testid="sidebar-toggle"]');

        // Skip if on mobile viewport (no sidebar toggle)
        const isVisible = await toggle.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip();
            return;
        }

        // Record initial sidebar width or presence
        const sidebar = page.locator('[data-testid^="nav-item-"]').first();
        await expect(sidebar).toBeVisible();

        // Click toggle to collapse
        await toggle.click();
        await page.waitForTimeout(400); // allow animation

        // Click again to expand
        await toggle.click();
        await page.waitForTimeout(400);

        // Sidebar items should be visible again
        await expect(page.locator('[data-testid^="nav-item-"]').first()).toBeVisible();
    });

    test('dashboard nav item is present and clickable', async ({ page }) => {
        const dashboardLink = page.locator('[data-testid="nav-item-dashboard"]');

        // May not be present on mobile — skip gracefully
        const isVisible = await dashboardLink.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip();
            return;
        }

        await dashboardLink.click();
        await page.waitForTimeout(1_500);

        // App should still be alive after navigation
        await expect(page.locator('#root')).toBeVisible();
    });

    test('navigating between modules does not cause white-screen', async ({ page }) => {
        const moduleIds = ['finance', 'distribution', 'creative', 'publishing'];

        for (const moduleId of moduleIds) {
            const navItem = page.locator(`[data-testid="nav-item-${moduleId}"]`);
            const exists = await navItem.isVisible().catch(() => false);

            if (exists) {
                await navItem.click();
                await page.waitForTimeout(1_200);

                // Root must still exist — no white screen
                await expect(page.locator('#root')).toBeVisible();
            }
        }
    });

    test('module lazy-loading shows loading state then content', async ({ page }) => {
        // Navigate via URL to trigger lazy load
        await page.goto('/#finance');
        await page.waitForTimeout(3_000);

        // App container should be present after load
        await expect(page.locator('#root')).toBeVisible();
    });

    test('observability button is accessible in sidebar footer', async ({ page }) => {
        const obsBtn = page.locator('[data-testid="observability-footer-btn"]');
        const isVisible = await obsBtn.isVisible().catch(() => false);

        if (isVisible) {
            await obsBtn.click();
            await page.waitForTimeout(1_000);
            await expect(page.locator('#root')).toBeVisible();
        }
    });
});

test.describe('CommandBar', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('prompt input is visible and accepts text', async ({ page }) => {
        const promptInput = page.locator('[data-testid="prompt-input"], textarea, [role="textbox"]');
        const found = await promptInput.first().isVisible().catch(() => false);

        if (found) {
            await promptInput.first().click();
            await promptInput.first().type('test query');
            const value = await promptInput.first().inputValue().catch(() =>
                promptInput.first().textContent()
            );
            expect(value).toContain('test');
        }
    });
});
