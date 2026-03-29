import { test, expect } from './fixtures/auth';

/**
 * Distribution Workflow E2E Tests
 *
 * This version is optimized for CI stability:
 * 1. Uses explicit waits for loading states
 * 2. Handles Firestore snapshot delays
 * 3. Uses robust data-testid locators
 *
 * Run: npx playwright test e2e/distribution-workflow.spec.ts --workers=1
 */

test.describe('Distribution Module', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    // ── Global timeout per test (prevents zombie hangs) ────────────────
    test.setTimeout(60_000);

    test.beforeEach(async ({ authedPage: page }) => {
        // Mock DDEX/delivery Cloud Functions
        await page.route('**/cloudfunctions.net/**/initiateDelivery**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: { deliveryId: 'delivery-mock-001', status: 'queued', distributor: 'DistroKid' },
                }),
            });
        });

        await page.route('**/cloudfunctions.net/**/getDeliveryStatus**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: { deliveryId: 'delivery-mock-001', status: 'delivered', distributor: 'DistroKid', deliveredAt: new Date().toISOString() },
                }),
            });
        });

        await page.route('**/cloudfunctions.net/**/validateDDEX**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: { valid: true, errors: [], warnings: ['Cover art warning'] },
                }),
            });
        });

        // Direct navigation
        await page.goto('/distribution');

        // Confirm module hydration - the dashboard shell should be visible quickly
        await expect(page.locator('[data-testid="distribution-dashboard"]')).toBeVisible({ timeout: 30_000 });
    });

    test('distribution module loads and shows live system status', async ({ authedPage: page }) => {
        // Wait for the dashboard shell
        await expect(page.locator('[data-testid="distribution-dashboard"]')).toBeVisible({ timeout: 15_000 });

        // Check for the "Live System" badge specifically
        const liveBadge = page.locator('span:has-text("Live System"), [data-testid="live-system-badge"]').first();
        await expect(liveBadge).toBeVisible({ timeout: 10_000 });

        // Ensure the presence of the navigation tabs
        await expect(page.locator('[data-testid="distro-tab-new"]')).toBeVisible();
        await expect(page.locator('[data-testid="distro-tab-catalogue"]')).toBeVisible();
    });

    test('Releases tab renders content area with hydration awareness', async ({ authedPage: page }) => {
        // Releases is the default tab.
        const content = page.locator('[data-testid="distro-content-new"]');
        await expect(content).toBeVisible();

        // Wait for hydration/loading to finish
        const loader = page.locator('[data-testid="releases-loading"]');
        if (await loader.isVisible()) {
            await expect(loader).not.toBeVisible({ timeout: 20_000 });
        }

        // Verify either the list or empty state exists
        await expect(page.locator('[data-testid="releases-list"], [data-testid="releases-empty-state"]')).toBeVisible({ timeout: 10_000 });
    });

    test('Distributors tab shows connection grid and allows authorization', async ({ authedPage: page }) => {
        await page.locator('[data-testid="distro-tab-catalogue"]').click();
        await expect(page.locator('[data-testid="distro-content-catalogue"]')).toBeVisible();

        // The grid should be visible
        const grid = page.locator('[data-testid="distributors-grid"]');
        await expect(grid).toBeVisible({ timeout: 15_000 });

        // Select a distributor and open connection modal
        const distBtn = page.locator('[data-testid="connect-button-distrokid"], [data-testid="distributor-card-connect"]').first();
        await expect(distBtn).toBeVisible();
        await distBtn.click();

        // Verify modal content
        const modal = page.locator('[data-testid="connect-distributor-modal"]');
        await expect(modal).toBeVisible();
        await expect(page.locator('[data-testid="distro-config-tab-identity"]')).toBeVisible();

        // Fill a field and click submit (mocked success)
        const userField = page.locator('[data-testid="distro-auth-username"]');
        if (await userField.isVisible()) {
            await userField.fill('e2e-user');
        }

        const submitBtn = page.locator('[data-testid="distro-finalize-connection"]');
        await expect(submitBtn).toBeVisible();
        await submitBtn.click();

        // Modal should close
        await expect(modal).not.toBeVisible({ timeout: 10_000 });
    });

    test('Authority layer handles ISRC and UPC generation', async ({ authedPage: page }) => {
        // Use Authority tab
        await page.locator('[data-testid="distro-tab-authority"]').click();
        await expect(page.locator('[data-testid="distro-content-authority"]')).toBeVisible();

        // Mock interaction with generation buttons
        const isrcBtn = page.locator('[data-testid="authority-generate-isrc"]');
        const upcBtn = page.locator('[data-testid="authority-generate-upc"]');

        await expect(isrcBtn).toBeVisible();
        await expect(upcBtn).toBeVisible();

        // Note: Full workflow requires a selected release, but we verify button presence and basic layout
        await expect(page.locator('[data-testid="authority-release-selector"]')).toBeVisible();
    });

    test('Bank layer displays tax compliance and revenue data', async ({ authedPage: page }) => {
        await page.locator('[data-testid="distro-tab-bank"]').click();
        await expect(page.locator('[data-testid="distro-content-bank"]')).toBeVisible();

        // Check sub-tabs
        await expect(page.locator('[data-testid="distro-subtab-tax"]')).toBeVisible();
        await expect(page.locator('[data-testid="distro-subtab-waterfall"]')).toBeVisible();

        // Verify Tax Compliance section
        await expect(page.locator('[data-testid="bank-verify-tax-compliance"]')).toBeVisible();
    });

    test('Create Release workflow opens metadata modal', async ({ authedPage: page }) => {
        await page.locator('[data-testid="distro-tab-new"]').click();
        await expect(page.locator('[data-testid="distro-content-new"]')).toBeVisible();

        // Wait for loader to disappear
        const loader = page.locator('[data-testid="releases-loading"]');
        if (await loader.isVisible()) {
            await expect(loader).not.toBeVisible({ timeout: 20_000 });
        }

        // Click "Submit Release"
        const submitBtn = page.locator('[data-testid="releases-submit-button"]');
        await expect(submitBtn).toBeVisible();
        await submitBtn.click();

        // Modal content check
        await expect(page.locator('[data-testid="release-title-input"]')).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('[data-testid="release-artist-input"]')).toBeVisible();
    });

    test('QC analysis workflow in Brain tab', async ({ authedPage: page }) => {
        await page.locator('[data-testid="distro-tab-brain"]').click();
        await expect(page.locator('[data-testid="distro-content-brain"]')).toBeVisible();

        // The Brain tab has QCPanel and QCVisualizer.
        // Target the QCVisualizer one as it provides the deeper analysis
        const visualizer = page.locator('[data-testid="distro-content-brain"]');
        const runBtn = visualizer.locator('[data-testid="qc-run-analysis"]').first();

        await expect(runBtn).toBeVisible();
        await runBtn.click();

        // Wait for pass badge (Cleared for Delivery)
        await expect(page.locator('[data-testid="qc-passed-badge"]')).toBeVisible({ timeout: 15_000 });
    });
});
