import { test, expect } from '@playwright/test';

/**
 * Distribution Pipeline E2E Test
 */
test.describe('Distribution Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4242');
        await page.waitForLoadState('networkidle');

        // Navigate to distribution
        const distroNav = page.locator('[data-testid="nav-item-distribution"]');
        await expect(distroNav).toBeVisible({ timeout: 10000 });
        await distroNav.click();

        // Wait for module header
        await page.waitForSelector('h1:has-text("Direct Distribution")', { timeout: 10000 });
    });

    test('should navigate to distribution module', async ({ page }) => {
        await expect(page.locator('h1')).toContainText(/Distribution/i);
    });

    test('should switch between Distribution tabs', async ({ page }) => {
        // Test Catalogue tab
        const catalogueTab = page.locator('[data-testid="distro-tab-catalogue"]');
        await catalogueTab.click();
        await expect(catalogueTab).toHaveAttribute('data-state', 'active');

        // Test Analytics tab
        const analyticsTab = page.locator('[data-testid="distro-tab-analytics"]');
        await analyticsTab.click();
        await expect(analyticsTab).toHaveAttribute('data-state', 'active');

        // Test Transmissions tab
        const transTab = page.locator('[data-testid="distro-tab-transmissions"]');
        await transTab.click();
        await expect(transTab).toHaveAttribute('data-state', 'active');
    });

    test('should display release creation form in New Release tab', async ({ page }) => {
        const newTab = page.locator('[data-testid="distro-tab-new"]');
        await newTab.click();

        // Look for release button/form indicators
        const content = page.locator('text=/Release|Track|Metadata/i').first();
        await expect(content).toBeVisible();
    });
});
