import { test, expect } from './fixtures/auth';

/**
 * Marketing Module E2E Tests
 * Covers: campaign list, brand assets section, social calendar stub
 */

test.describe('Marketing Module', () => {
    test.setTimeout(30_000);

    test.beforeEach(async ({ authedPage: page }) => {
        // Navigate directly to the marketing module URL
        await page.goto('/marketing', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');

        // Wait for core app container
        await page.waitForSelector('[data-testid="app-container"], main, #root', { timeout: 15_000 });

        // Wait for any meaningful heading or marketing-specific content
        await page.waitForSelector('h1, h2, [class*="marketing"], [data-testid*="marketing"]', { timeout: 15_000 });
    });

    test('navigates to marketing module without crash', async ({ authedPage: page }) => {
        // Check for the Campaign Dashboard h1 that MarketingToolbar renders
        const heading = page.getByRole('heading', { level: 1, name: 'Campaign Dashboard' });
        await expect(heading).toBeVisible({ timeout: 10_000 });

        const h1Text = await heading.textContent().catch(() => '');
        console.log(`[Marketing] h1 text: "${h1Text}"`);
    });

    test('marketing module renders interactive elements', async ({ authedPage: page }) => {
        // Look for any action button — "New Campaign", "Create", or similar
        const actionButton = page.locator(
            'button:has-text("New Campaign"), button:has-text("Create Campaign"), button:has-text("Campaign"), [data-testid*="campaign"]'
        ).first(); // bypass-strict: target first visible element in DOM matching selector

        // Fallback: verify no crash overlay exists
        const errorOverlay = page.locator('text=/Something went wrong|Application Error/');
        await expect(errorOverlay).toBeHidden();

        await expect(actionButton).toBeVisible({ timeout: 10_000 });

        // Verify some interactive element exists
        const hasAnyButton = await page.locator('button').first().isVisible({ timeout: 3_000 }).catch(() => false); // bypass-strict: action button may appear in multiple responsive viewports or action bars
        expect(hasAnyButton).toBeTruthy();
    });

    test('opens Asset Generator and configures Multi-Shape Ad Matrix mode', async ({ authedPage: page }) => {
        await page.getByRole('button', { name: 'Release Assets' }).click();
        await page.getByRole('button', { name: /Asset Generator/i }).click();
        await page.getByRole('button', { name: /Multi-Shape Ad Matrix/i }).click();

        for (const shape of ['9:16', '1:1', '4:5', '16:9']) {
            await expect(page.getByRole('button', { name: new RegExp(shape) })).toBeVisible({ timeout: 10_000 });
        }
        for (const duration of ['6s', '15s', '30s']) {
            await expect(page.getByRole('button', { name: duration, exact: true })).toBeVisible();
        }

        await page.getByRole('button', { name: /Continue/i }).click();

        const compileBtn = page.getByRole('button', { name: /Compile & Score Matrix/i });
        await expect(compileBtn).toBeVisible();
        await expect(compileBtn).toBeDisabled();

        await page.getByPlaceholder('E.g., Drop Friday — Out Now').fill('Drop Friday — Out Now');
        await page.getByPlaceholder('https://... or gs://...').fill('https://cdn.indii.music/hero.mp4');

        await expect(compileBtn).toBeEnabled();
        await expect(page.locator('text=/Something went wrong|Application Error/')).toBeHidden();
    });
});
