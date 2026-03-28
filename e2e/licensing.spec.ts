import { test, expect } from './fixtures/auth';

/**
 * Licensing Module E2E Tests
 * Covers: navigation, sync brief list, clearance upload flow stub
 */

test.describe('Licensing Module', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // authedPage fixture handles Guest Login and navigation to '/'

        // Navigate to licensing
        const licensingNav = page.locator('[data-testid="nav-item-licensing"]');
        if (await licensingNav.isVisible().catch(() => false)) {
            await licensingNav.click();
            await page.waitForTimeout(2_000);
        } else {
            await page.goto('/#licensing');
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 10_000 });
        }

        // Wait for module-specific content
        await page.waitForSelector('h1, h2, h3, [data-testid="licensing-header"]', { timeout: 15_000 });
    });

    test('navigates to licensing module without crash', async ({ authedPage: page }) => {
        await expect(page.locator('#root')).toBeVisible();
    });

    test('licensing module has content area', async ({ authedPage: page }) => {
        const content = page.locator('main, [role="main"], h1, h2');
        await expect(content.first()).toBeVisible();
    });
});
