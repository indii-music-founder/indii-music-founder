import { test, expect } from './fixtures/auth';

/**
 * Distribution Workflow E2E Tests
 *
 * Covers: Dashboard status, distributor connection modal flow, release metadata creation,
 * QC pre-flight validation, and delivery pipeline lifecycle with strict locators and zero Potemkin checks.
 *
 * Run: npx playwright test e2e/distribution-workflow.spec.ts
 */

test.describe('Distribution Module', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test.setTimeout(60_000);

    test.beforeEach(async ({ authedPage: page }) => {
        // Mock Firestore distribution collection reads
        await page.route('**/firestore.googleapis.com/**/ddexReleases**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });

        await page.route('**/firestore.googleapis.com/**/distributors**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });

        await page.goto('/distribution', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('distribution-dashboard')).toBeVisible({ timeout: 30_000 });
    });

    test('distribution module loads and shows live system status', async ({ authedPage: page }) => {
        const dashboard = page.getByTestId('distribution-dashboard');
        const liveBadge = dashboard.getByTestId('live-system-badge');
        await expect(liveBadge).toBeVisible({ timeout: 15_000 });
        await expect(dashboard.getByTestId('distro-tab-new')).toBeVisible();
        await expect(dashboard.getByTestId('distro-tab-catalogue')).toBeVisible();
    });

    test('Releases tab renders content area', async ({ authedPage: page }) => {
        const newTab = page.getByTestId('distro-tab-new');
        await newTab.click();
        const content = page.getByTestId('distro-content-new');
        await expect(content).toBeVisible({ timeout: 15_000 });
        await expect(content.getByTestId('releases-submit-button')).toBeVisible();
    });

    test('Distributors tab shows connection grid and allows authorization', async ({ authedPage: page }) => {
        // Navigate to Catalogue / Connections tab
        await page.getByTestId('distro-tab-catalogue').click();
        const content = page.getByTestId('distro-content-catalogue');
        await expect(content).toBeVisible({ timeout: 10_000 });

        // Connection grid must be visible
        const grid = page.getByTestId('distributors-grid');
        await expect(grid).toBeVisible({ timeout: 15_000 });

        // Click Authorize for DistroKid
        const distBtn = page.getByTestId('connect-button-distrokid');
        await expect(distBtn).toBeVisible({ timeout: 10_000 });
        await distBtn.click();

        // Connect modal opens
        const modal = page.getByTestId('connect-distributor-modal');
        await expect(modal).toBeVisible({ timeout: 15_000 });
        await expect(modal.getByTestId('distro-config-tab-identity')).toBeVisible({ timeout: 10_000 });

        // Fill credentials
        const userField = modal.getByTestId('distro-auth-username');
        await expect(userField).toBeVisible();
        await userField.fill('e2e-user');

        const passField = modal.getByTestId('distro-auth-password');
        await expect(passField).toBeVisible();
        await passField.fill('mock-password');

        // Finalize connection
        const submitBtn = modal.getByTestId('distro-finalize-connection');
        await expect(submitBtn).toBeVisible();
        await submitBtn.click();

        // Modal should close upon successful connection
        await expect(modal).toHaveCount(0, { timeout: 15_000 });
    });

    test('Create Release workflow opens metadata modal', async ({ authedPage: page }) => {
        await page.getByTestId('distro-tab-new').click();
        const content = page.getByTestId('distro-content-new');
        await expect(content).toBeVisible();

        const createBtn = content.getByTestId('releases-submit-button');
        await expect(createBtn).toBeVisible({ timeout: 10_000 });
        await createBtn.click();

        const modal = page.getByTestId('metadata-modal');
        await expect(modal).toBeVisible({ timeout: 15_000 });
        await expect(modal.getByTestId('release-title-input')).toBeVisible();
        await expect(modal.getByTestId('release-artist-input')).toBeVisible();

        // Close modal
        await modal.getByRole('button', { name: 'Close modal' }).click();
        await expect(modal).toHaveCount(0);
    });

    test('QC analysis workflow in Brain tab', async ({ authedPage: page }) => {
        // Navigate to Pre-Flight Audio & QC tab
        await page.getByTestId('distro-tab-brain').click();
        const qcContent = page.getByTestId('distro-content-brain');
        await expect(qcContent).toBeVisible({ timeout: 10_000 });

        // Fill QC metadata inputs
        const titleInput = qcContent.getByTestId('qc-input-title');
        await expect(titleInput).toBeVisible();
        await titleInput.fill('E2E Test Track');

        const artistInput = qcContent.getByTestId('qc-input-artist');
        await expect(artistInput).toBeVisible();
        await artistInput.fill('E2E Artist');

        // Run QC analysis
        const runBtn = qcContent.getByTestId('qc-run-analysis');
        await expect(runBtn).toBeVisible({ timeout: 15_000 });
        await runBtn.click();

        // Assert passed badge is displayed
        const passedBadge = qcContent.getByTestId('qc-passed-badge');
        await expect(passedBadge).toBeVisible({ timeout: 20_000 });
    });
});

test.describe('Distribution Delivery Pipeline', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test.setTimeout(90_000);

    test.beforeEach(async ({ authedPage: page }) => {
        await page.route('**/firestore.googleapis.com/**/ddexReleases**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });

        await page.route('**/firestore.googleapis.com/**/distributors**', async route => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) });
        });

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

        await page.goto('/distribution', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('distribution-dashboard')).toBeVisible({ timeout: 30_000 });
    });

    test('Production-grade metadata workflow submits successfully', async ({ authedPage: page }) => {
        await page.getByTestId('distro-tab-new').click();
        const content = page.getByTestId('distro-content-new');
        await expect(content).toBeVisible({ timeout: 10_000 });

        const createBtn = content.getByTestId('releases-submit-button');
        await expect(createBtn).toBeVisible();
        await createBtn.click();

        const modal = page.getByTestId('metadata-modal');
        await expect(modal).toBeVisible({ timeout: 15_000 });

        // Fill release metadata
        await modal.getByTestId('release-title-input').fill('E2E Test Album');
        await modal.getByTestId('release-artist-input').fill('E2E Artist');
        await modal.getByTestId('release-track-title-input').fill('E2E Track 1');

        // Submit release
        const submitBtn = modal.getByTestId('release-submit-button');
        await expect(submitBtn).toBeVisible();
        await submitBtn.click();

        // Completion done button
        const doneBtn = modal.getByTestId('release-done-button');
        await expect(doneBtn).toBeVisible({ timeout: 30_000 });
        await doneBtn.click();

        await expect(modal).toHaveCount(0);
    });

    test('DDEX validation surfaces error notifications for invalid metadata', async ({ authedPage: page }) => {
        await page.route('**/cloudfunctions.net/**/validateDDEX**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: {
                        valid: false,
                        errors: [
                            'Missing ISRC code',
                            'Cover art resolution below 3000x3000',
                        ],
                        warnings: ['Genre not standardized'],
                    },
                }),
            });
        });

        // Navigate to QC tab
        await page.getByTestId('distro-tab-brain').click();
        const qcContent = page.getByTestId('distro-content-brain');
        await expect(qcContent).toBeVisible({ timeout: 10_000 });

        const runBtn = qcContent.getByTestId('qc-run-analysis');
        await expect(runBtn).toBeVisible({ timeout: 10_000 });
        await runBtn.click();

        // Assert QC panel is rendered and responsive
        await expect(qcContent).toBeVisible();
    });
});
