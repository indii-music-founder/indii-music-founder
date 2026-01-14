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

        // Check for Guest Login first (Dev mode)
        const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await guestLoginBtn.isVisible()) {
            await guestLoginBtn.click();
        } else {
            // Fallback to standard login
            const loginButton = page.getByRole('button', { name: /sign in/i });
            if (await loginButton.isVisible()) {
                await page.getByLabel(/email/i).fill(E2E_EMAIL);
                await page.getByLabel(/password/i).fill(E2E_PASSWORD);
                await loginButton.click();
            }
        }

        // Wait for dashboard or any module to load
        // "Agent Workspace" is the default dashboard view
        await expect(page.getByText('Agent Workspace')).toBeVisible({ timeout: 30000 });
    });

    test('URL Sync: Sidebar navigation updates URL', async ({ page }) => {
        // 1. Navigate to Brand Manager
        console.log('Navigating to Brand Manager...');
        await page.getByTestId('nav-item-brand').click();

        // UI Check - Updated to match actual UI (BRAND HQ)
        await expect(page.getByText('BRAND HQ')).toBeVisible();

        // URL Check
        expect(page.url()).toContain('/brand');

        // 2. Navigate to Creative Director
        console.log('Navigating to Creative Director...');
        await page.getByTestId('nav-item-creative').click();

        // UI Check - Creative Director uses "Creative Director" header in the screenshot and "CreativeNavbar"
        // The navbar has "Creative Director" text.
        await expect(page.getByText('Creative Director', { exact: false }).first()).toBeVisible();

        // URL Check
        expect(page.url()).toContain('/creative');
    });

    test('History: Back button restores state', async ({ page }) => {
        // 1. Go to Marketing
        await page.getByTestId('nav-item-marketing').click();
        await expect(page.getByText('Marketing Department', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/marketing');

        // 2. Go to Social Media
        await page.getByTestId('nav-item-social').click();
        await expect(page.getByText('Social Media', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/social');

        // 3. Click Browser Back
        console.log('Clicking Browser Back...');
        await page.goBack();

        // 4. Verify we are back at Marketing
        await expect(page.getByText('Marketing Department', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/marketing');
    });

    test('Deep Link: Direct access loads correct module', async ({ page, context }) => {
        // Create a new context to simulate a fresh user session (not logged in)
        // We do this to verify the "Redirect to Login -> Login -> Redirect to Target" flow
        await context.clearCookies();
        const newPage = await context.newPage();

        console.log('Deep linking to: /legal');
        await newPage.goto('/legal');

        // Expect Login Page
        const guestLoginBtn = newPage.getByRole('button', { name: /Guest Login/i });
        await expect(guestLoginBtn).toBeVisible();

        // Login
        await guestLoginBtn.click();

        // Should redirect BACK to /legal
        // Check for Legal Dashboard
        await expect(newPage.getByText('Legal Dashboard', { exact: false })).toBeVisible({ timeout: 20000 });
        expect(newPage.url()).toContain('/legal');
    });

    test('Deep Link: Sub-path preservation', async ({ page, context }) => {
        // Similar strategy for sub-path
        await context.clearCookies();
        const newPage = await context.newPage();

        console.log('Deep linking to sub-path: /creative/project-123');
        await newPage.goto('/creative/project-123');

        // Expect Login Page
        const guestLoginBtn = newPage.getByRole('button', { name: /Guest Login/i });
        await expect(guestLoginBtn).toBeVisible();

        // Login
        await guestLoginBtn.click();

        // Should load Creative Studio (checking for "Creative Director" text in navbar)
        await expect(newPage.getByText('Creative Director', { exact: false }).first()).toBeVisible({ timeout: 20000 });

        // URL should NOT revert to /creative or /
        expect(newPage.url()).toContain('/creative/project-123');
    });

    test('Integrity: Invalid Route redirects to Dashboard', async ({ page }) => {
        // For this test, we use the already logged-in session from beforeEach

        const invalidUrl = '/non-existent-module-xyz';
        console.log(`Navigating to invalid route: ${invalidUrl}`);

        // We use page.goto here, which might trigger a reload.
        // IF reload loses auth, we end up at login.
        // IF we end up at login, we log in, and THEN where do we go?
        // Ideally Dashboard (because route invalid).

        // Let's use client-side navigation if possible to test the ROUTER config first.
        // But page.goto is the real test of "entering an invalid URL".

        // Since we know reload wipes auth in this env:
        // 1. Goto Invalid URL
        // 2. See Login
        // 3. Login
        // 4. See Dashboard (Redirect from Invalid URL -> Login -> Dashboard/Home)

        await page.goto(invalidUrl);

        const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await guestLoginBtn.isVisible()) {
             await guestLoginBtn.click();
        }

        // Should redirect to Dashboard (/)
        await expect(page.getByText('Agent Workspace')).toBeVisible();

        // URL should be cleaned up
        const url = new URL(page.url());
        expect(url.pathname).toBe('/');
    });

    test('Active State: Sidebar highlights current module', async ({ page }) => {
        // Navigate to Marketing
        await page.getByTestId('nav-item-marketing').click();

        // Check if marketing button is active using robust accessibility attribute
        const marketingBtn = page.getByTestId('nav-item-marketing');
        await expect(marketingBtn).toHaveAttribute('aria-current', 'page');

        // Check that another item is NOT active
        const socialBtn = page.getByTestId('nav-item-social');
        await expect(socialBtn).not.toHaveAttribute('aria-current', 'page');
    });
});
