import { test, expect } from '@playwright/test';

/**
 * FLOW - Navigation & Routing Integrity
 * Mission: Verify the URL is the single source of truth and navigation history works.
 */

// We default to the relative path as required by boundaries ("Never do: Hardcode full domains").
// The baseURL is configured in playwright.config.ts (http://localhost:4242).
const E2E_EMAIL = process.env.E2E_EMAIL || 'automator@indiios.com';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'AutomatorPass123!';

test.describe('Flow: Routing & Navigation', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Shared login logic
        await page.goto('/');
        const loginButton = page.getByRole('button', { name: /sign in/i });
        if (await loginButton.isVisible()) {
            await page.getByLabel(/email/i).fill(E2E_EMAIL);
            await page.getByLabel(/password/i).fill(E2E_PASSWORD);
            await loginButton.click();
        }
        await expect(page.getByRole('heading', { name: /STUDIO HQ/i })).toBeVisible({ timeout: 30000 });
    });

    test('URL Sync: Sidebar navigation updates URL', async ({ page }) => {
        // 1. Navigate to Brand Manager
        console.log('Navigating to Brand Manager...');
        await page.getByTestId('nav-item-brand').click();

        // UI Check
        await expect(page.getByText('Brand Guidelines')).toBeVisible();

        // URL Check
        expect(page.url()).toContain('/brand');

        // 2. Navigate to Creative Director
        console.log('Navigating to Creative Director...');
        await page.getByTestId('nav-item-creative').click();

        // UI Check
        await expect(page.getByText('Creative Studio')).toBeVisible();

        // URL Check
        expect(page.url()).toContain('/creative');
    });

    test('History: Back button restores state', async ({ page }) => {
        // 1. Go to Marketing
        await page.getByTestId('nav-item-marketing').click();
        await expect(page.getByText('Marketing Dashboard')).toBeVisible();
        expect(page.url()).toContain('/marketing');

        // 2. Go to Music
        await page.getByTestId('nav-item-music').click();
        await expect(page.getByText('Music Studio')).toBeVisible();
        expect(page.url()).toContain('/music');

        // 3. Click Browser Back
        console.log('Clicking Browser Back...');
        await page.goBack();

        // 4. Verify we are back at Marketing
        await expect(page.getByText('Marketing Dashboard')).toBeVisible();
        expect(page.url()).toContain('/marketing');
    });

    test('Deep Link: Direct access loads correct module', async ({ page }) => {
        console.log('Deep linking to: /legal');
        await page.goto('/legal');
        await expect(page.getByText('Legal Dashboard')).toBeVisible({ timeout: 20000 });
    });

    test('Deep Link: Sub-path preservation', async ({ page }) => {
        // Navigate to a sub-path (e.g., /creative/project-123)
        // Even if the module doesn't handle the ID, it should load the module
        console.log('Deep linking to sub-path: /creative/project-123');
        await page.goto('/creative/project-123');

        // Should load Creative Studio
        await expect(page.getByText('Creative Studio')).toBeVisible({ timeout: 20000 });

        // URL should NOT revert to /creative or /
        // It should stay as is (unless Creative Studio explicitly redirects, which it shouldn't for arbitrary IDs usually)
        expect(page.url()).toContain('/creative/project-123');
    });

    test('Integrity: Invalid Route redirects to Dashboard', async ({ page }) => {
        const invalidUrl = '/non-existent-module-xyz';
        console.log(`Navigating to invalid route: ${invalidUrl}`);
        await page.goto(invalidUrl);

        // Should redirect to Dashboard (/)
        await expect(page.getByRole('heading', { name: /STUDIO HQ/i })).toBeVisible();

        // URL should be cleaned up
        const url = new URL(page.url());
        expect(url.pathname).toBe('/');

        // Note: Ideally, this should show a 404 page, but currently the app implements
        // a "Safety Redirect" to prevent getting lost.
    });

    test('Active State: Sidebar highlights current module', async ({ page }) => {
        // Navigate to Marketing
        await page.getByTestId('nav-item-marketing').click();

        // Check if marketing button is active using robust accessibility attribute
        const marketingBtn = page.getByTestId('nav-item-marketing');
        await expect(marketingBtn).toHaveAttribute('aria-current', 'page');

        // Check that another item is NOT active
        const musicBtn = page.getByTestId('nav-item-music');
        await expect(musicBtn).not.toHaveAttribute('aria-current', 'page');
    });
});
