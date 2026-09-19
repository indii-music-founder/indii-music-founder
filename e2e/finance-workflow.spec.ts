import { test, expect } from './fixtures/auth';

/**
 * Finance Workflow E2E Tests
 */
test.describe('Finance Module', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ authedPage: page }) => {
        // Mock Firestore finance collection reads
        await page.route('**/firestore.googleapis.com/**/earnings_reports**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ documents: [] }),
            });
        });

        await page.route('**/firestore.googleapis.com/**/expenses**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ documents: [] }),
            });
        });

        console.log('[FINANCE TEST] Navigating to Finance module...');
        await page.goto('/finance', { waitUntil: 'domcontentloaded' });

        console.log('[FINANCE TEST] Waiting for finance header...');
        await page.locator('[data-testid="finance-header"]').waitFor({ state: 'visible', timeout: 30_000 });
    });

    test('finance module loads without crashing', async ({ authedPage: page }) => {
        await expect(page.locator('[data-testid="finance-header"] h1')).toContainText(/Finance/i);
    });

    test('should switch between Finance tabs', async ({ authedPage: page }) => {
        // Test Expenses tab
        const expenseTab = page.locator('[data-testid="finance-tab-expenses"]');
        await expenseTab.click();
        await expect(expenseTab).toHaveAttribute('data-state', 'active');

        // Test Royalties tab
        const royaltiesTab = page.locator('[data-testid="finance-tab-royalties"]');
        await royaltiesTab.click();
        await expect(royaltiesTab).toHaveAttribute('data-state', 'active');

        // Test Recoupment tab
        const recoupTab = page.locator('[data-testid="finance-tab-recoupment"]');
        await recoupTab.click();
        await expect(recoupTab).toHaveAttribute('data-state', 'active');
    });

    test('EarningsDashboard summary is visible on selecting Earnings tab', async ({ authedPage: page }) => {
        await page.locator('[data-testid="finance-tab-earnings"]').click();

        const chartOrEmpty = page.locator('[data-testid="earnings-chart"], [data-testid="earnings-empty-state"]');
        await expect(chartOrEmpty).toBeVisible({ timeout: 20_000 });
    });
});
