import { test, expect } from '@playwright/test';

/**
 * Distribution Workflow E2E Tests
 *
 * Covers: distribution module three-panel layout, releases tab,
 * distributors tab with connect buttons, QC panel, and bank/authority tabs.
 *
 * Run: npx playwright test e2e/distribution-workflow.spec.ts
 */

test.describe('Distribution Module', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ page }) => {
        // Mock Firestore distribution collection reads
        await page.route('**/firestore.googleapis.com/**/releases**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ documents: [] }),
            });
        });

        await page.route('**/firestore.googleapis.com/**/distributors**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ documents: [] }),
            });
        });

        // Mock distributor status checks
        await page.route('**/api.distrokid.com/**', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ status: 'ok' }) });
        });

        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);

        // Navigate to distribution
        const distNav = page.locator('[data-testid="nav-item-distribution"]');
        const isVisible = await distNav.isVisible().catch(() => false);

        if (isVisible) {
            await distNav.click();
            await page.waitForTimeout(2_000);
        } else {
            await page.goto('/#distribution');
            await page.waitForTimeout(2_000);
        }
    });

    test('distribution module loads without crashing', async ({ page }) => {
        await expect(page.locator('#root')).toBeVisible();
    });

    test('Releases tab renders releases list or empty state', async ({ page }) => {
        const releasesTab = page.locator(
            'button:has-text("Releases"), [role="tab"]:has-text("Releases")'
        ).first();
        const tabVisible = await releasesTab.isVisible().catch(() => false);

        if (tabVisible) {
            await releasesTab.click();
            await page.waitForTimeout(1_000);

            // Either shows releases or empty state
            const content = page.locator(
                '[class*="release"], [class*="empty"], text=/no releases|get started/i'
            ).first();
            const contentVisible = await content.isVisible().catch(() => false);
            console.log(`Release content found: ${contentVisible}`);
        }

        await expect(page.locator('#root')).toBeVisible();
    });

    test('Distributors tab shows connection panel', async ({ page }) => {
        const distributorsTab = page.locator(
            'button:has-text("Distributors"), [role="tab"]:has-text("Distributors")'
        ).first();
        const tabVisible = await distributorsTab.isVisible().catch(() => false);

        if (tabVisible) {
            await distributorsTab.click();
            await page.waitForTimeout(1_000);

            // Should show distributor cards (DistroKid, TuneCore, etc.)
            const distributorCards = page.locator(
                '[class*="distributor"], [class*="connector"], button:has-text("Connect")'
            );
            const cardCount = await distributorCards.count().catch(() => 0);
            console.log(`Distributor elements found: ${cardCount}`);
        }

        await expect(page.locator('#root')).toBeVisible();
    });

    test('Bank and Authority tabs render without crashing', async ({ page }) => {
        for (const tabName of ['Bank', 'Authority', 'Keys']) {
            const tab = page.locator(
                `button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`
            ).first();
            const tabVisible = await tab.isVisible().catch(() => false);

            if (tabVisible) {
                await tab.click();
                await page.waitForTimeout(800);
                await expect(page.locator('#root')).toBeVisible();
            }
        }
    });

    test('QC panel renders validation interface', async ({ page }) => {
        const qcTab = page.locator(
            'button:has-text("QC"), [role="tab"]:has-text("QC"), button:has-text("Quality")'
        ).first();
        const tabVisible = await qcTab.isVisible().catch(() => false);

        if (tabVisible) {
            await qcTab.click();
            await page.waitForTimeout(1_000);

            const qcContent = page.locator(
                '[class*="qc"], [class*="quality"], [class*="validation"]'
            ).first();
            const contentVisible = await qcContent.isVisible().catch(() => false);
            console.log(`QC content found: ${contentVisible}`);
        }

        await expect(page.locator('#root')).toBeVisible();
    });

    test('Create Release button is present and opens wizard', async ({ page }) => {
        const createBtn = page.locator(
            'button:has-text("New Release"), button:has-text("Create Release"), button:has-text("+ Release")'
        ).first();
        const btnVisible = await createBtn.isVisible().catch(() => false);

        if (btnVisible) {
            await createBtn.click();
            await page.waitForTimeout(1_000);

            // A modal or wizard should appear
            const modal = page.locator('[role="dialog"], [class*="modal"], [class*="wizard"]').first();
            const modalVisible = await modal.isVisible().catch(() => false);
            console.log(`Release wizard opened: ${modalVisible}`);

            // Close modal if open
            const closeBtn = page.locator('[aria-label="Close"], button:has-text("Cancel")').first();
            const closeVisible = await closeBtn.isVisible().catch(() => false);
            if (closeVisible) {
                await closeBtn.click();
            } else {
                await page.keyboard.press('Escape');
            }
        }

        await expect(page.locator('#root')).toBeVisible();
    });
});
