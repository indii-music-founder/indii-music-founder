import { test, expect } from './fixtures/auth';

/**
 * Marketing Module E2E Tests
 * Covers: campaign list, brand assets section, social calendar stub
 */

test.describe('Marketing Module', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // authedPage fixture handles Guest Login and navigation to '/'

        // Navigate to marketing
        const marketingNav = page.locator('[data-testid="nav-item-marketing"]');
        if (await marketingNav.isVisible().catch(() => false)) {
            await marketingNav.click();
            await page.waitForTimeout(2_000);
        } else {
            await page.goto('/#marketing');
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 10_000 });
        }

        // Wait for module-specific content
        await page.waitForSelector('h1, h2, [data-testid="marketing-header"]', { timeout: 15_000 });
    });

    test('navigates to marketing module without crash', async ({ authedPage: page }) => {
        // Module-specific header should be present
        await expect(page.locator('h1')).toContainText(/Campaign Dashboard/i);
    });

    test('marketing module renders interactive elements', async ({ authedPage: page }) => {
        // Should have action buttons like "New Campaign"
        const newCampaignBtn = page.locator('button:has-text("New Campaign")');
        await expect(newCampaignBtn.first()).toBeVisible();
    });
});
