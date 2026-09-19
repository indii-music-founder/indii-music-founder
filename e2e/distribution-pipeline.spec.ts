import { test, expect } from './fixtures/auth';

/**
 * Distribution Pipeline E2E Test
 *
 * Validates module navigation, tab switching across content panels,
 * and release creation form initialization with strict locators.
 *
 * Run: npx playwright test e2e/distribution-pipeline.spec.ts
 */
test.describe('Distribution Pipeline Tests', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ authedPage: page }) => {
        // Mock Firestore distribution collection reads to prevent loading spinners hanging
        await page.route('**/firestore.googleapis.com/**/ddexReleases**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });
        await page.route('**/firestore.googleapis.com/**/distributors**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });

        await page.goto('/distribution', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('distribution-dashboard')).toBeVisible({ timeout: 20_000 });
    });

    test('should navigate to distribution module and display live system badge', async ({ authedPage: page }) => {
        const dashboard = page.getByTestId('distribution-dashboard');
        await expect(dashboard).toBeVisible();
        await expect(dashboard.getByRole('heading', { level: 1 })).toContainText(/Distribution/i);
        await expect(dashboard.getByTestId('live-system-badge')).toBeVisible();
    });

    test('should switch between Distribution tabs and mount corresponding panels', async ({ authedPage: page }) => {
        // 1. Catalogue tab -> Distributor connections panel
        const catalogueTab = page.getByTestId('distro-tab-catalogue');
        await catalogueTab.click();
        await expect(catalogueTab).toHaveAttribute('data-state', 'active');
        await expect(page.getByTestId('distro-content-catalogue')).toBeVisible({ timeout: 10_000 });

        // 2. Authority tab -> Authority panel
        const authorityTab = page.getByTestId('distro-tab-authority');
        await authorityTab.click();
        await expect(authorityTab).toHaveAttribute('data-state', 'active', { timeout: 10_000 });
        await expect(page.getByTestId('distro-content-authority')).toBeVisible({ timeout: 10_000 });

        // 3. Transmission tab -> Transmission monitor
        const transTab = page.getByTestId('distro-tab-transmission');
        await transTab.click();
        await expect(transTab).toHaveAttribute('data-state', 'active', { timeout: 10_000 });
        await expect(page.getByTestId('distro-content-transmission')).toBeVisible({ timeout: 10_000 });
    });

    test('should display release creation form in New Release tab', async ({ authedPage: page }) => {
        const newTab = page.getByTestId('distro-tab-new');
        await newTab.click();
        await expect(newTab).toHaveAttribute('data-state', 'active');

        // Verify Releases content panel mounts
        const content = page.getByTestId('distro-content-new');
        await expect(content).toBeVisible({ timeout: 15_000 });

        // Submit release button must be interactive
        const submitBtn = content.getByTestId('releases-submit-button');
        await expect(submitBtn).toBeVisible();
        await submitBtn.click();

        // Metadata modal opens with release input controls
        const modal = page.getByTestId('metadata-modal');
        await expect(modal).toBeVisible({ timeout: 10_000 });
        await expect(modal.getByTestId('release-title-input')).toBeVisible();
        await expect(modal.getByTestId('release-artist-input')).toBeVisible();

        // Close modal
        await modal.getByRole('button', { name: 'Close modal' }).click();
        await expect(modal).toHaveCount(0);
    });
});
