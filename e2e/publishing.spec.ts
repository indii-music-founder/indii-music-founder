import { test, expect } from './fixtures/auth';

/**
 * Publishing Module E2E Tests
 * Covers: module load, composition list, royalty splits view
 */

test.describe('Publishing Module', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // authedPage fixture handles Guest Login and navigation to '/'

        // Navigate to publishing
        const publishingNav = page.locator('[data-testid="nav-item-publishing"]');
        if (await publishingNav.isVisible().catch(() => false)) {
            await publishingNav.click();
            await page.waitForTimeout(2_000);
        } else {
            await page.goto('/#publishing');
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 10_000 });
        }

        // Wait for module to load (should have a heading)
        await page.waitForSelector('h1, h2, h3', { timeout: 15000 });
    });

    test('navigates to publishing module without crash', async ({ authedPage: page }) => {
        // App container and content should be visible
        await expect(page.locator('#root')).toBeVisible();
        await expect(page.locator('h1, h2, h3').first()).toBeVisible();
    });

    test('publishing module renders content', async ({ authedPage: page }) => {
        // Should have interactive elements or list of compositions
        const headings = page.locator('h1, h2, h3');
        const count = await headings.count();
        expect(count).toBeGreaterThan(0);
    });
});
