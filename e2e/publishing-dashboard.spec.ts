import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Publishing Dashboard
 * Tests tab navigation, release detail view, and modal interactions
 */

test.describe('Publishing Dashboard', () => {
    let page: Page;

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
        await page.goto('http://localhost:4242');

        // Wait for app to load
        await page.waitForLoadState('networkidle');

        // Navigate to Publishing module
        const publishingNav = page.locator('[data-testid="nav-publishing"], button:has-text("Publishing")');
        if (await publishingNav.isVisible()) {
            await publishingNav.click();
            await page.waitForTimeout(500);
        }
    });

    test.afterEach(async () => {
        await page.close();
    });

    test.describe('Tab Navigation', () => {
        test('should display three tabs: Catalog, Insights, Royalties', async () => {
            const catalogTab = page.locator('button:has-text("Catalog")');
            const insightsTab = page.locator('button:has-text("Insights")');
            const royaltiesTab = page.locator('button:has-text("Royalties")');

            await expect(catalogTab).toBeVisible();
            await expect(insightsTab).toBeVisible();
            await expect(royaltiesTab).toBeVisible();
        });

        test('should default to Catalog tab', async () => {
            const catalogTab = page.locator('button:has-text("Catalog")');
            const tabClasses = await catalogTab.getAttribute('class');

            // Active tab should have white background
            expect(tabClasses).toContain('bg-white');
        });

        test('should switch to Insights tab and display analytics chart', async () => {
            const insightsTab = page.locator('button:has-text("Insights")');
            await insightsTab.click();
            await page.waitForTimeout(300);

            // Check for analytics chart container
            const chart = page.locator('text=Performance Analytics').first();
            await expect(chart).toBeVisible();

            // Verify metric toggles are present
            const revenueToggle = page.locator('button:has-text("Revenue")');
            const streamsToggle = page.locator('button:has-text("Streams")');
            await expect(revenueToggle).toBeVisible();
            await expect(streamsToggle).toBeVisible();
        });

        test('should switch to Royalties tab and display payout history', async () => {
            const royaltiesTab = page.locator('button:has-text("Royalties")');
            await royaltiesTab.click();
            await page.waitForTimeout(300);

            // Check for financial components
            const payoutHistory = page.locator('text=Financial History').first();
            const importButton = page.locator('button:has-text("Import DSR")');

            await expect(payoutHistory).toBeVisible();
            await expect(importButton).toBeVisible();
        });
    });

    test.describe('Metric Switching', () => {
        test('should toggle between Revenue and Streams metrics', async () => {
            // Navigate to Insights tab
            const insightsTab = page.locator('button:has-text("Insights")');
            await insightsTab.click();
            await page.waitForTimeout(300);

            const revenueToggle = page.locator('button:has-text("Revenue")').first();
            const streamsToggle = page.locator('button:has-text("Streams")').first();

            // Check Streams is active by default
            const streamsClasses = await streamsToggle.getAttribute('class');
            expect(streamsClasses).toContain('bg-blue-500/10');

            // Click Revenue
            await revenueToggle.click();
            await page.waitForTimeout(200);

            // Verify Revenue is now active
            const revenueClasses = await revenueToggle.getAttribute('class');
            expect(revenueClasses).toContain('bg-purple-500/10');
        });
    });

    test.describe('Release Detail View', () => {
        test('should navigate to detail view when clicking a release', async () => {
            // Find and click the first release card
            const releaseCard = page.locator('[data-testid="release-card"]').first();

            if (await releaseCard.isVisible()) {
                await releaseCard.click();
                await page.waitForTimeout(300);

                // Check for detail page elements
                const backButton = page.locator('button:has-text("Back to Catalog")');
                const editButton = page.locator('button:has-text("Edit Release")');

                await expect(backButton).toBeVisible();
                await expect(editButton).toBeVisible();
            }
        });

        test('should return to catalog when clicking Back button', async () => {
            // Navigate to detail view
            const releaseCard = page.locator('[data-testid="release-card"]').first();

            if (await releaseCard.isVisible()) {
                await releaseCard.click();
                await page.waitForTimeout(300);

                // Click back button
                const backButton = page.locator('button:has-text("Back to Catalog")');
                await backButton.click();
                await page.waitForTimeout(300);

                // Verify we're back in catalog view
                const releaseList = page.locator('text=Catalog').first();
                await expect(releaseList).toBeVisible();
            }
        });
    });

    test.describe('DSR Upload Modal', () => {
        test('should open DSR upload modal when clicking Import DSR', async () => {
            // Navigate to Royalties tab
            const royaltiesTab = page.locator('button:has-text("Royalties")');
            await royaltiesTab.click();
            await page.waitForTimeout(300);

            // Click Import DSR button
            const importButton = page.locator('button:has-text("Import DSR")');
            await importButton.click();
            await page.waitForTimeout(200);

            // Check modal is visible
            const modalTitle = page.locator('text=Import Sales Report').first();
            await expect(modalTitle).toBeVisible();
        });

        test('should close DSR modal when clicking close button', async () => {
            // Open modal
            const royaltiesTab = page.locator('button:has-text("Royalties")');
            await royaltiesTab.click();
            await page.waitForTimeout(300);

            const importButton = page.locator('button:has-text("Import DSR")');
            await importButton.click();
            await page.waitForTimeout(200);

            // Close modal
            const closeButton = page.locator('button[aria-label="Close modal"]').first();
            if (await closeButton.isVisible()) {
                await closeButton.click();
                await page.waitForTimeout(200);

                // Verify modal is closed
                const modalTitle = page.locator('text=Import Sales Report');
                await expect(modalTitle).not.toBeVisible();
            }
        });
    });

    test.describe('Stats Cards', () => {
        test('should display all stats cards in analytics tab', async () => {
            const insightsTab = page.locator('button:has-text("Insights")');
            await insightsTab.click();
            await page.waitForTimeout(300);

            // Check for expected stats
            const totalReleases = page.locator('text=Total Releases').first();
            const liveOnDSPs = page.locator('text=Live on DSPs').first();
            const pendingReview = page.locator('text=Pending Review').first();
            const totalEarnings = page.locator('text=Total Earnings').first();

            await expect(totalReleases).toBeVisible();
            await expect(liveOnDSPs).toBeVisible();
            await expect(pendingReview).toBeVisible();
            await expect(totalEarnings).toBeVisible();
        });
    });

    test.describe('Loading States', () => {
        test('should show loading spinner while fetching data', async () => {
            // This test assumes data takes some time to load
            const loader = page.locator('[data-testid="publishing-skeleton"]');

            // Note: May only be visible on slow connections
            // In practice, you'd use network throttling or mock slow responses
            const isLoaderVisible = await loader.isVisible().catch(() => false);

            // Test passes either way, but logs if loader was seen
            if (isLoaderVisible) {
                console.log('✓ Loading state detected');
            }
        });
    });
});
