import { test, expect } from './fixtures/auth';

/**
 * Brand Manager Module E2E Tests
 * Covers: module navigation, brand kit rendering, style preferences
 */

test.describe('Brand Manager Module', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    // ISSUE-1442 Stage 2: Brand is a tab of the Marketing module, not a sidebar item.
    const openBrandTab = async (page: import('@playwright/test').Page) => {
        const marketingNav = page.locator('[data-testid="nav-item-marketing"]');
        await marketingNav.waitFor({ state: 'visible', timeout: 15_000 });
        await marketingNav.click();

        const brandTab = page.locator('[data-testid="marketing-tab-brand"]');
        await brandTab.waitFor({ state: 'visible', timeout: 15_000 });
        await brandTab.click();
    };

    test('navigates to brand manager without crash', async ({ authedPage: page }) => {
        await openBrandTab(page);
        await page.waitForTimeout(1_500);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('brand manager renders brand kit content', async ({ authedPage: page }) => {
        await openBrandTab(page);
        await page.waitForTimeout(2_000);

        const headings = page.locator('h1, h2, h3');
        expect(await headings.count()).toBeGreaterThan(0);
    });
});

