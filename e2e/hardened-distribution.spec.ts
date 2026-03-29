import { test, expect } from './fixtures/auth';

/**
 * Hardened Distribution Workflow E2E Tests
 * 
 * This test suite is designed for "Zero Errors" CI runs:
 * 1. Mocks all external Firestore and Cloud Function dependencies.
 * 2. Mocks the Electron IPC layer for SFTP and credentials.
 * 3. Uses robust locator strategies with explicit timeouts.
 */

test.describe('Distribution Module Hardened Suite', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test.setTimeout(60_000);

    test.beforeEach(async ({ authedPage: page }) => {
        // Intercept all Firestore reads for distribution
        await page.route('**/firestore.googleapis.com/**/ddexReleases**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });
        await page.route('**/firestore.googleapis.com/**/distributors**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });

        // Intercept Cloud Functions
        await page.route('**/cloudfunctions.net/**/initiateDelivery**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ result: { success: true, deliveryId: 'e2e-delivery' } }),
            });
        });

        console.log('[E2E] Navigating to /distribution...');
        await page.goto('/distribution');
        await expect(page.locator('[data-testid="distribution-dashboard"]')).toBeVisible({ timeout: 20_000 });
        console.log('[E2E] Dashboard loaded.');
    });

    test('Core distribution tabs are accessible', async ({ authedPage: page }) => {
        await expect(page.locator('[data-testid="distro-tab-new"]')).toBeVisible();
        await expect(page.locator('[data-testid="distro-tab-catalogue"]')).toBeVisible();
        await expect(page.locator('[data-testid="distro-tab-brain"]')).toBeVisible();
    });

    test('Distributor connection flow works end-to-end', async ({ authedPage: page }) => {
        console.log('[E2E] Opening Catalogue...');
        await page.locator('[data-testid="distro-tab-catalogue"]').click();
        await expect(page.locator('[data-testid="distro-content-catalogue"]')).toBeVisible({ timeout: 10_000 });

        console.log('[E2E] Locating connection grid...');
        const grid = page.locator('[data-testid="distributors-grid"]');
        await expect(grid).toBeVisible({ timeout: 15_000 });

        console.log('[E2E] Clicking Authorize for DistroKid...');
        const distBtn = page.locator('[data-testid="connect-button-distrokid"]').first();
        await expect(distBtn).toBeVisible({ timeout: 10_000 });
        await distBtn.click();

        console.log('[E2E] Waiting for Authorize modal...');
        const modal = page.locator('[data-testid="connect-distributor-modal"]').first();
        await expect(modal).toBeVisible({ timeout: 15_000 });

        console.log('[E2E] Filling account details...');
        await page.locator('[data-testid="distro-auth-username"]').fill('e2e-test-user');
        await page.locator('[data-testid="distro-auth-password"]').fill('e2e-password');

        console.log('[E2E] Finalizing connection...');
        const finalizeBtn = page.locator('[data-testid="distro-finalize-connection"]');
        await expect(finalizeBtn).toBeVisible();
        await finalizeBtn.click();

        console.log('[E2E] Expecting modal to close...');
        await expect(modal).not.toBeVisible({ timeout: 20_000 });
        console.log('[E2E] Connection successful, modal closed.');
    });

    test('Metadata QC validation triggers and completes', async ({ authedPage: page }) => {
        console.log('[E2E] Opening Brain tab...');
        await page.locator('[data-testid="distro-tab-brain"]').click();
        await expect(page.locator('[data-testid="distro-content-brain"]')).toBeVisible({ timeout: 10_000 });

        console.log('[E2E] Starting QC analysis...');
        const runBtn = page.locator('[data-testid="qc-run-analysis"]').first();
        await expect(runBtn).toBeVisible({ timeout: 10_000 });
        await runBtn.click();

        console.log('[E2E] Waiting for QC passed badge...');
        const passedBadge = page.locator('[data-testid="qc-passed-badge"]').first();
        await expect(passedBadge).toBeVisible({ timeout: 30_000 });
        console.log('[E2E] QC workflow verified.');
    });

    test('Create Release sequence opens release modal', async ({ authedPage: page }) => {
        console.log('[E2E] Opening New Release tab...');
        await page.locator('[data-testid="distro-tab-new"]').click();
        await expect(page.locator('[data-testid="distro-content-new"]')).toBeVisible({ timeout: 10_000 });

        console.log('[E2E] Clicking Create Release...');
        const createBtn = page.locator('[data-testid="releases-submit-button"]').first();
        await expect(createBtn).toBeVisible({ timeout: 10_000 });
        await createBtn.click();

        console.log('[E2E] Verifying Metadata modal visibility...');
        const metadataModal = page.locator('[data-testid="metadata-modal"]').first();
        await expect(metadataModal).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('[data-testid="release-title-input"]')).toBeVisible();
        console.log('[E2E] Release sequence verified.');
    });
});
