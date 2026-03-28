import { test, expect } from '@playwright/test';

/**
 * Marketing Module E2E Tests
 * Covers: campaign list, brand assets section, social calendar stub
 */

test.describe('Marketing Module', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4242');
        await page.waitForLoadState('networkidle');

        // Login as guest if on login page
        const guestBtn = page.locator('[data-testid="guest-login-btn"]');
        if (await guestBtn.isVisible()) {
            await guestBtn.click();
        }

        // Navigate to marketing
        const marketingNav = page.locator('[data-testid="nav-item-marketing"]');
        await expect(marketingNav).toBeVisible({ timeout: 15000 });
        await marketingNav.click();

        // Wait for module to load (Campaign Dashboard is the default entry)
        await page.waitForSelector('h1:has-text("Campaign Dashboard"), h2:has-text("Active Campaigns")', { timeout: 15000 });
    });

    test('navigates to marketing module without crash', async ({ page }) => {
        // Module-specific header should be present
        await expect(page.locator('h1')).toContainText(/Campaign Dashboard/i);
    });

    test('marketing module renders interactive elements', async ({ page }) => {
        // Should have action buttons like "New Campaign"
        const newCampaignBtn = page.locator('button:has-text("New Campaign")');
        await expect(newCampaignBtn.first()).toBeVisible();
    });
});
