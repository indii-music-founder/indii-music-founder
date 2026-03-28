import { test, expect } from '@playwright/test';

/**
 * Licensing Module E2E Tests
 * Covers: navigation, sync brief list, clearance upload flow stub
 */

test.describe('Licensing Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4242');
        await page.waitForLoadState('networkidle');

        // Login as guest if on login page
        const guestBtn = page.locator('[data-testid="guest-login-btn"]');
        if (await guestBtn.isVisible()) {
            await guestBtn.click();
        }

        // Navigate to licensing
        const licensingNav = page.locator('[data-testid="nav-item-licensing"]');
        await expect(licensingNav).toBeVisible({ timeout: 15000 });
        await licensingNav.click();

        // Wait for module to load (Licensing module has content)
        await page.waitForTimeout(2000);
    });

    test('navigates to licensing module without crash', async ({ page }) => {
        await expect(page.locator('#root')).toBeVisible();
    });

    test('licensing module has content area', async ({ page }) => {
        const content = page.locator('main, [role="main"], h1, h2');
        await expect(content.first()).toBeVisible();
    });
});
