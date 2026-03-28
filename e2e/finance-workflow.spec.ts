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

        // Navigate to finance (fixture already handles login and base URL)
        const financeNav = page.locator('[data-testid="nav-item-finance"]');
        if (await financeNav.isVisible().catch(() => false)) {
            await financeNav.click();
            await page.waitForTimeout(1_000);
        } else {
            await page.goto('/#finance');
        }

        // Wait for finance-specific content
        await page.locator('h1, h2, [data-testid="finance-header"]').first().waitFor({ state: 'visible', timeout: 15_000 });
    });

    test('finance module loads without crashing', async ({ authedPage: page }) => {
        await expect(page.getByRole('heading', { name: /Finance/i }).first()).toBeVisible({ timeout: 15_000 });
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

    test('EarningsDashboard summary is visible on initial load', async ({ authedPage: page }) => {
        const chart = page.locator('[data-testid="earnings-chart"]');
        // Match the heading in the tabpanel (No Reports Found) or the actual chart
        const emptyState = page.getByRole('heading', { name: /No Reports Found/i });

        await expect(chart.or(emptyState)).toBeVisible({ timeout: 20_000 });
    });
});
