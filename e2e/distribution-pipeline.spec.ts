import { test, expect } from './fixtures/auth';

/**
 * Distribution Pipeline E2E Test
 */
test.describe('Distribution Pipeline Secondary Tests', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // Mock Firestore distribution collection reads to prevent loading spinners hanging
        await page.route('**/firestore.googleapis.com/**/ddexReleases**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });
        await page.route('**/firestore.googleapis.com/**/distributors**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });

        await page.goto('/distribution');
        await page.waitForLoadState('networkidle');

        // Wait for module header
        await page.waitForSelector('h1:has-text("Distribution")', { timeout: 10000 });
    });

    test('should navigate to distribution module', async ({ authedPage: page }) => {
        await expect(page.locator('h1')).toContainText(/Distribution/i);
    });

    test('should switch between Distribution tabs', async ({ authedPage: page }) => {
        // Test Catalogue tab
        const catalogueTab = page.locator('[data-testid="distro-tab-catalogue"]');
        await catalogueTab.click();
        await expect(catalogueTab).toHaveAttribute('data-state', 'active');

        // Test Authority tab
        const authorityTab = page.locator('[data-testid="distro-tab-authority"]');
        await authorityTab.click();
        await expect(authorityTab).toHaveAttribute('data-state', 'active', { timeout: 10_000 });

        // Test Transmission tab
        const transTab = page.locator('[data-testid="distro-tab-transmission"]');
        await transTab.click();
        await expect(transTab).toHaveAttribute('data-state', 'active', { timeout: 10_000 });
    });

    test('should display release creation form in New Release tab', async ({ authedPage: page }) => {
        const newTab = page.locator('[data-testid="distro-tab-new"]');
        await newTab.click();

        // Look for release button/form indicators
        const content = page.locator('text=/Release|Track|Metadata/i').first();
        await expect(content).toBeVisible({ timeout: 15_000 });
    });
});
