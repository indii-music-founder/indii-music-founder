import { test, expect } from './fixtures/auth';

/**
 * Marketing Module E2E Tests
 * Covers: campaign list, brand assets section, social calendar stub
 */

test.describe('Marketing Module', () => {
    test.setTimeout(30_000);

    test.beforeEach(async ({ authedPage: page }) => {
        // Navigate directly to the marketing module URL
        await page.goto('/marketing');
        await page.waitForLoadState('domcontentloaded');

        // Wait for core app container
        await page.waitForSelector('[data-testid="app-container"], main, #root', { timeout: 15_000 });

        // Wait for any meaningful heading or marketing-specific content
        await page.waitForSelector('h1, h2, [class*="marketing"], [data-testid*="marketing"]', { timeout: 15_000 });
    });

    test('navigates to marketing module without crash', async ({ authedPage: page }) => {
        // Check for the Campaign Dashboard h1 that MarketingToolbar renders
        const heading = page.getByRole('heading', { level: 1 });
        await expect(heading).toBeVisible({ timeout: 10_000 });

        const h1Text = await heading.textContent().catch(() => '');
        console.log(`[Marketing] h1 text: "${h1Text}"`);
    });

    test('marketing module renders interactive elements', async ({ authedPage: page }) => {
        // Look for any action button — "New Campaign", "Create", or similar
        const actionButton = page.locator(
            'button:has-text("New Campaign"), button:has-text("Create Campaign"), button:has-text("Campaign"), [data-testid*="campaign"]'
        ).first();

        // Fallback: verify no crash overlay exists
        const errorOverlay = page.locator('text=/Something went wrong|Application Error/');
        await expect(errorOverlay).toBeHidden();

        await expect(actionButton).toBeVisible({ timeout: 10_000 });

        // Verify some interactive element exists
        const hasAnyButton = await page.locator('button').first().isVisible({ timeout: 3_000 }).catch(() => false);
        expect(hasAnyButton).toBeTruthy();
    });
});
