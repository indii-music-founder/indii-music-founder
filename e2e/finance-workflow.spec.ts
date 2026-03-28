import { test, expect } from './fixtures/auth';

/**
 * Finance Workflow E2E Tests
 */
test.describe('Finance Module', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ authedPage: page }) => {
        // authedPage fixture handles Guest Login and navigation to '/'

        // Navigate to finance
        const financeNav = page.locator('[data-testid="nav-item-finance"]');
        if (await financeNav.isVisible().catch(() => false)) {
            await financeNav.click();
            await page.waitForTimeout(2_000);
        } else {
            await page.goto('/#finance');
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 10_000 });
        }

        // Wait for module-specific content
        await page.waitForSelector('h1, h2, [data-testid="finance-header"]', { timeout: 15_000 });
    });

    test('finance module loads without crashing', async ({ authedPage: page }) => {
        await expect(page.locator('h1')).toContainText(/Finance/i);
    });

    test('should switch between Finance tabs', async ({ authedPage: page }) => {
        // Test Expenses tab
        const expenseTab = page.locator('[data-testid="finance-tab-expenses"]');
        await expenseTab.click();
        await expect(expenseTab).toHaveAttribute('data-state', 'active');

        // Test Royalties tab (replaces non-existent ledger)
        const royaltiesTab = page.locator('[data-testid="finance-tab-royalties"]');
        await royaltiesTab.click();
        await expect(royaltiesTab).toHaveAttribute('data-state', 'active');

        // Test Recoupment tab
        const recoupTab = page.locator('[data-testid="finance-tab-recoupment"]');
        await recoupTab.click();
        await expect(recoupTab).toHaveAttribute('data-state', 'active');
    });

    test('EarningsDashboard summary is visible on initial load', async ({ authedPage: page }) => {
        // Navigate to Earnings specifically if needed, but it's usually default
        const earningsTab = page.locator('button:has-text("Earnings"), [role="tab"]:has-text("Earnings")').first();
        if (await earningsTab.isVisible().catch(() => false)) {
            await earningsTab.click();
        }
        // Either the chart (if data present) or the "No Reports" empty state should be visible
        const chart = page.locator('.recharts-wrapper, svg[class*="recharts"]').first();
        const emptyState = page.locator('h3:has-text("No Reports Found")');

        await expect(chart.or(emptyState)).toBeVisible({ timeout: 10000 });
    });
});
