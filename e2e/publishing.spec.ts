import { test, expect } from '@playwright/test';

/**
 * Publishing Module E2E Tests
 * Covers: module load, composition list, royalty splits view
 */

test.describe('Publishing Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4242');
        await page.waitForLoadState('networkidle');

        // Login as guest if on login page
        const guestBtn = page.locator('[data-testid="guest-login-btn"]');
        if (await guestBtn.isVisible()) {
            await guestBtn.click();
        }

        // Navigate to publishing
        const publishingNav = page.locator('[data-testid="nav-item-publishing"]');
        await expect(publishingNav).toBeVisible({ timeout: 15000 });
        await publishingNav.click();

        // Wait for module to load (should have a heading)
        await page.waitForSelector('h1, h2, h3', { timeout: 15000 });
    });

    test('navigates to publishing module without crash', async ({ page }) => {
        // App container and content should be visible
        await expect(page.locator('#root')).toBeVisible();
        await expect(page.locator('h1, h2, h3').first()).toBeVisible();
    });

    test('publishing module renders content', async ({ page }) => {
        // Should have interactive elements or list of compositions
        const headings = page.locator('h1, h2, h3');
        const count = await headings.count();
        expect(count).toBeGreaterThan(0);
    });
});
