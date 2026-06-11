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

    test('navigates to brand manager without crash', async ({ authedPage: page }) => {
        const nav = page.locator('[data-testid="nav-item-brand"]');
        await nav.waitFor({ state: 'visible', timeout: 15_000 });

        await nav.click();
        await page.waitForTimeout(1_500);
        await expect(page.locator('#root')).toBeVisible();
    });

    test('brand manager renders brand kit content', async ({ authedPage: page }) => {
        const nav = page.locator('[data-testid="nav-item-brand"]');
        await nav.waitFor({ state: 'visible', timeout: 15_000 });

        await nav.click();
        await page.waitForTimeout(2_000);

        const headings = page.locator('h1, h2, h3');
        expect(await headings.count()).toBeGreaterThan(0);
    });
});

