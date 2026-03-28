import { test, expect } from '@playwright/test';

/**
 * Finance Workflow E2E Tests
 */
test.describe('Finance Module', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4242');
        await page.waitForLoadState('networkidle');

        // Login as guest if on login page
        const guestBtn = page.locator('[data-testid="guest-login-btn"]');
        if (await guestBtn.isVisible()) {
            await guestBtn.click();
        }

        // Navigate to finance
        const financeNav = page.locator('[data-testid="nav-item-finance"]');
        await expect(financeNav).toBeVisible({ timeout: 10000 });
        await financeNav.click();

        // Wait for module header
        await page.waitForSelector('[data-testid="module-header"], h1:has-text("Finance")', { timeout: 15000 });
    });

    test('finance module loads without crashing', async ({ page }) => {
        await expect(page.locator('h1')).toContainText(/Finance/i);
    });

    test('should switch between Finance tabs', async ({ page }) => {
        // Test Expenses tab
        const expenseTab = page.locator('[data-testid="finance-tab-expenses"]');
        await expenseTab.click();
        await expect(expenseTab).toHaveAttribute('data-state', 'active');

        // Test Ledger tab
        const ledgerTab = page.locator('[data-testid="finance-tab-ledger"]');
        await ledgerTab.click();
        await expect(ledgerTab).toHaveAttribute('data-state', 'active');

        // Test Recoupment tab
        const recoupTab = page.locator('[data-testid="finance-tab-recoupment"]');
        await recoupTab.click();
        await expect(recoupTab).toHaveAttribute('data-state', 'active');
    });

    test('EarningsDashboard summary is visible on initial load', async ({ page }) => {
        // RevenueChart (Recharts SVG) should be present
        const chart = page.locator('.recharts-wrapper, svg[class*="recharts"]').first();
        await expect(chart).toBeVisible({ timeout: 5000 });
    });
});
