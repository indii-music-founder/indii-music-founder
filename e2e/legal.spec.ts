import { test, expect } from '@playwright/test';

/**
 * Legal Module E2E Test
 */
test.describe('Legal Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4242');
        await page.waitForLoadState('networkidle');

        // Login as guest if on login page
        const guestBtn = page.locator('[data-testid="guest-login-btn"]');
        if (await guestBtn.isVisible()) {
            await guestBtn.click();
        }

        // Navigate to legal
        const legalNav = page.locator('[data-testid="nav-item-legal"]');
        await expect(legalNav).toBeVisible({ timeout: 10000 });
        await legalNav.click();

        // Wait for module header
        await page.waitForSelector('h1:has-text("Legal")', { timeout: 15000 });
    });

    test('should navigate to legal module', async ({ page }) => {
        await expect(page.locator('h1')).toContainText(/Legal/i);
    });

    test('should switch between Legal tabs', async ({ page }) => {
        // Test DMCA tab
        const dmcaTab = page.locator('[data-testid="legal-tab-dmca"]');
        await dmcaTab.click();
        await expect(dmcaTab).toHaveAttribute('data-state', 'active');

        // Test Counsel tab
        const counselTab = page.locator('[data-testid="legal-tab-counsel"]');
        await counselTab.click();
        await expect(counselTab).toHaveAttribute('data-state', 'active');

        // Test Analyzer tab
        const analyzerTab = page.locator('[data-testid="legal-tab-analyzer"]');
        await analyzerTab.click();
        await expect(analyzerTab).toHaveAttribute('data-state', 'active');
    });

    test('should show file drop area in Analyzer mode', async ({ page }) => {
        const dropArea = page.locator('text=/Drop contract here/i').first();
        await expect(dropArea).toBeVisible();
    });
});
