import { test, expect } from './fixtures/auth';

/**
 * Hardened Distribution Workflow E2E Tests
 * 
 * Validates distributor connection flow, metadata QC validation,
 * and release creation modal sequences with zero bypass workarounds.
 *
 * Run: npx playwright test e2e/hardened-distribution.spec.ts
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

        await page.goto('/distribution', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('distribution-dashboard')).toBeVisible({ timeout: 20_000 });
    });

    test('Core distribution tabs are accessible', async ({ authedPage: page }) => {
        const dashboard = page.getByTestId('distribution-dashboard');
        await expect(dashboard.getByTestId('distro-tab-new')).toBeVisible();
        await expect(dashboard.getByTestId('distro-tab-catalogue')).toBeVisible();
        await expect(dashboard.getByTestId('distro-tab-brain')).toBeVisible();
    });

    test('Distributor connection flow works end-to-end', async ({ authedPage: page }) => {
        // Open Catalogue
        await page.getByTestId('distro-tab-catalogue').click();
        const content = page.getByTestId('distro-content-catalogue');
        await expect(content).toBeVisible({ timeout: 10_000 });

        // Connection grid
        const grid = page.getByTestId('distributors-grid');
        await expect(grid).toBeVisible({ timeout: 15_000 });

        // Authorize DistroKid
        const distBtn = page.getByTestId('connect-button-distrokid');
        await expect(distBtn).toBeVisible({ timeout: 10_000 });
        await distBtn.click();

        // Connect modal
        const modal = page.getByTestId('connect-distributor-modal');
        await expect(modal).toBeVisible({ timeout: 15_000 });

        // Fill credentials
        await modal.getByTestId('distro-auth-username').fill('e2e-test-user');
        await modal.getByTestId('distro-auth-password').fill('e2e-password');

        // Finalize
        const finalizeBtn = modal.getByTestId('distro-finalize-connection');
        await expect(finalizeBtn).toBeVisible();
        await finalizeBtn.click();

        // Expect modal to close
        await expect(modal).toHaveCount(0, { timeout: 20_000 });
    });

    test('Metadata QC validation triggers and completes', async ({ authedPage: page }) => {
        // Open Brain tab
        await page.getByTestId('distro-tab-brain').click();
        const qcContent = page.getByTestId('distro-content-brain');
        await expect(qcContent).toBeVisible({ timeout: 10_000 });

        // Fill QC metadata
        await qcContent.getByTestId('qc-input-title').fill('E2E Test Track');
        await qcContent.getByTestId('qc-input-artist').fill('E2E Test Artist');

        // Start QC analysis
        const runBtn = qcContent.getByTestId('qc-run-analysis');
        await expect(runBtn).toBeVisible({ timeout: 10_000 });
        await runBtn.click();

        // Wait for QC passed badge
        const passedBadge = qcContent.getByTestId('qc-passed-badge');
        await expect(passedBadge).toBeVisible({ timeout: 30_000 });
    });

    test('Create Release sequence opens release modal', async ({ authedPage: page }) => {
        // Open New Release tab
        await page.getByTestId('distro-tab-new').click();
        const content = page.getByTestId('distro-content-new');
        await expect(content).toBeVisible({ timeout: 10_000 });

        // Click Submit Release
        const createBtn = content.getByTestId('releases-submit-button');
        await expect(createBtn).toBeVisible({ timeout: 10_000 });
        await createBtn.click();

        // Verify modal opened
        const modal = page.getByTestId('metadata-modal');
        await expect(modal).toBeVisible({ timeout: 15_000 });
        await expect(modal.getByTestId('release-title-input')).toBeVisible({ timeout: 10_000 });

        // Close modal
        await modal.getByRole('button', { name: 'Close modal' }).click();
        await expect(modal).toHaveCount(0);
    });
});
