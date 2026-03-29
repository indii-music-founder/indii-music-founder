import { test, expect } from './fixtures/auth';

/**
 * Distribution Workflow E2E Tests
 * Optimized for CI/CD stability.
 */

test.describe('Distribution Module', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    // Global timeout per test (prevents zombie hangs)
    test.setTimeout(60_000);

    test.beforeEach(async ({ authedPage: page }) => {
        // Mock Firestore distribution collection reads
        await page.route('**/firestore.googleapis.com/**/ddexReleases**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });

        await page.route('**/firestore.googleapis.com/**/distributors**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });

        console.log('[DISTRO TEST] Navigating to /distribution...');
        await page.goto('/distribution');

        console.log('[DISTRO TEST] Waiting for distribution-dashboard...');
        await expect(page.locator('[data-testid="distribution-dashboard"]')).toBeVisible({ timeout: 30_000 });
        console.log('[DISTRO TEST] distribution-dashboard is visible');
    });

    test('distribution module loads and shows live system status', async ({ authedPage: page }) => {
        const liveBadge = page.locator('[data-testid="live-system-badge"]').first();
        await expect(liveBadge).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('[data-testid="distro-tab-new"]')).toBeVisible();
        await expect(page.locator('[data-testid="distro-tab-catalogue"]')).toBeVisible();
    });

    test('Releases tab renders content area', async ({ authedPage: page }) => {
        await page.locator('[data-testid="distro-tab-new"]').click();
        // data-testid is distro-content-new in component
        const content = page.locator('[data-testid="distro-content-new"]');
        await expect(content).toBeVisible({ timeout: 15_000 });
    });

    test('Distributors tab shows connection grid and allows authorization', async ({ authedPage: page }) => {
        console.log('[DISTRO TEST] Navigating to Catalogue tab...');
        await page.locator('[data-testid="distro-tab-catalogue"]').click();
        await expect(page.locator('[data-testid="distro-content-catalogue"]')).toBeVisible({ timeout: 10_000 });

        console.log('[DISTRO TEST] Checking for distributors-grid...');
        const grid = page.locator('[data-testid="distributors-grid"]');
        await expect(grid).toBeVisible({ timeout: 15_000 });

        console.log('[DISTRO TEST] Clicking connect button...');
        // Correctly handle OR condition with locators
        const distBtn = page.locator('[data-testid="connect-button-distrokid"]').or(page.locator('[data-testid="distributor-card-connect"]')).first();
        await expect(distBtn).toBeVisible({ timeout: 10_000 });
        await distBtn.click({ force: true });

        console.log('[DISTRO TEST] Waiting for connect modal...');
        const modal = page.locator('[data-testid="connect-distributor-modal"]').first();
        await expect(modal).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('[data-testid="distro-config-tab-identity"]')).toBeVisible({ timeout: 10_000 });

        console.log('[DISTRO TEST] Filling auth fields...');
        // Fill username
        const userField = page.locator('[data-testid="distro-auth-username"]');
        if (await userField.isVisible()) {
            await userField.fill('e2e-user');
        }

        // Fill password (required for DistroKid identity tab)
        const passField = page.locator('[data-testid="distro-auth-password"]');
        if (await passField.isVisible()) {
            await passField.fill('mock-password');
        }

        console.log('[DISTRO TEST] Finalizing connection...');
        const submitBtn = page.locator('[data-testid="distro-finalize-connection"]');
        await expect(submitBtn).toBeVisible();
        await submitBtn.click();

        console.log('[DISTRO TEST] Waiting for modal to close...');
        // Modal should close
        await expect(modal).not.toBeVisible({ timeout: 15_000 });
        console.log('[DISTRO TEST] Modal closed successfully');
    });

    test('Create Release workflow opens metadata modal', async ({ authedPage: page }) => {
        await page.locator('[data-testid="distro-tab-new"]').click();
        await expect(page.locator('[data-testid="distro-content-new"]')).toBeVisible();

        // Check if ReleasesContent has a submit button or create button
        const createBtn = page.locator('[data-testid="releases-submit-button"]').or(page.locator('[data-testid="create-release-btn"]')).first();
        await expect(createBtn).toBeVisible({ timeout: 10_000 });
        await createBtn.click();

        // Modal should open
        const modal = page.locator('[data-testid="metadata-modal"]').first();
        await expect(modal).toBeVisible({ timeout: 15_000 });
    });

    test('QC analysis workflow in Brain tab', async ({ authedPage: page }) => {
        console.log('[DISTRO TEST] Navigating to Brain tab...');
        await page.locator('[data-testid="distro-tab-brain"]').click();
        await expect(page.locator('[data-testid="distro-content-brain"]')).toBeVisible({ timeout: 10_000 });

        console.log('[DISTRO TEST] Running QC analysis...');
        const runBtn = page.locator('[data-testid="qc-run-analysis"]');
        await expect(runBtn).toBeVisible({ timeout: 15_000 });
        await runBtn.click({ force: true });

        // Wait for passed badge (successful QC in mock mode)
        const passedBadge = page.locator('[data-testid="qc-passed-badge"]');
        await expect(passedBadge).toBeVisible({ timeout: 20_000 });
    });
});

test.describe('Distribution Delivery Pipeline (Item 279)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test.setTimeout(90_000);

    test.beforeEach(async ({ authedPage: page }) => {
        // Intercept Cloud Functions
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

        console.log('[DISTRO TEST] Navigating to /distribution (v2)...');
        await page.goto('/distribution');

        console.log('[DISTRO TEST] Waiting for distribution-dashboard...');
        await expect(page.locator('[data-testid="distribution-dashboard"]')).toBeVisible({ timeout: 30_000 });
    });

    test('Production-grade metadata workflow submits successfully', async ({ authedPage: page }) => {
        console.log('[DISTRO TEST] Navigating to New Release tab...');
        await page.locator('[data-testid="distro-tab-new"]').click();
        await expect(page.locator('[data-testid="distro-content-new"]')).toBeVisible({ timeout: 10_000 });

        console.log('[DISTRO TEST] Clicking create button...');
        const createBtn = page.locator('[data-testid="releases-submit-button"]').or(page.locator('[data-testid="create-release-btn"]')).first();
        await expect(createBtn).toBeVisible();
        await createBtn.click({ force: true });

        console.log('[DISTRO TEST] Filling release metadata...');
        const modal = page.locator('[data-testid="metadata-modal"]');
        await expect(modal).toBeVisible({ timeout: 15_000 });

        // Fill basic metadata
        await page.locator('[data-testid="release-title-input"]').fill('E2E Test Album');
        await page.locator('[data-testid="release-artist-input"]').fill('E2E Artist');
        await page.locator('[data-testid="release-track-title-input"]').fill('E2E Track 1');

        console.log('[DISTRO TEST] Submitting release...');
        const submitBtn = page.locator('[data-testid="release-submit-button"]');
        await expect(submitBtn).toBeVisible();
        await submitBtn.click({ force: true });

        console.log('[DISTRO TEST] Verifying completion...');
        // Should show "Done" button after progress completes
        const doneBtn = page.locator('[data-testid="release-done-button"]');
        await expect(doneBtn).toBeVisible({ timeout: 30_000 });
        await doneBtn.click();

        await expect(modal).not.toBeVisible();
        console.log('[DISTRO TEST] Release submission E2E complete');
    });
});
