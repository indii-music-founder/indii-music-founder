import { test, expect } from '@playwright/test';

/**
 * FLOW - Navigation Regression Test
 * Verifies the fix for Back Button and Invalid Route behavior.
 */

const E2E_EMAIL = process.env.E2E_EMAIL || 'automator@indiios.com';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'AutomatorPass123!';

test.describe('Flow: Navigation Fix Verification', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/');

        // Login if needed
        const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await guestLoginBtn.isVisible()) {
            await guestLoginBtn.click();
        } else {
            const loginButton = page.getByRole('button', { name: /sign in/i });
            if (await loginButton.isVisible()) {
                await page.getByLabel(/email/i).fill(E2E_EMAIL);
                await page.getByLabel(/password/i).fill(E2E_PASSWORD);
                await loginButton.click();
            }
        }
        await expect(page.getByText('Agent Workspace')).toBeVisible({ timeout: 30000 });
    });

    test('History: Back button MUST restore correct state (No Loops)', async ({ page }) => {
        // 1. Start at Dashboard (/)
        expect(page.url()).not.toContain('/marketing');
        expect(page.url()).not.toContain('/social');

        // 2. Go to Marketing
        console.log('Navigating to Marketing...');
        await page.getByTestId('nav-item-marketing').click();
        await expect(page.getByText('Marketing Department', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/marketing');

        // 3. Go to Social Media
        console.log('Navigating to Social...');
        await page.getByTestId('nav-item-social').click();
        await expect(page.getByText('Social Media', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/social');

        // 4. Click Browser Back -> Should be Marketing
        console.log('Clicking Browser Back (Social -> Marketing)...');
        await page.goBack();

        // Wait for UI update
        await expect(page.getByText('Marketing Department', { exact: false })).toBeVisible();
        // Crucial Check: URL must be /marketing, NOT /social (revert)
        expect(page.url()).toContain('/marketing');
        expect(page.url()).not.toContain('/social');

        // 5. Click Browser Back -> Should be Dashboard
        console.log('Clicking Browser Back (Marketing -> Dashboard)...');
        await page.goBack();
        await expect(page.getByText('Agent Workspace')).toBeVisible();
        // URL should be root or dashboard (depending on implementation, but visually dashboard)
        // Dashboard module maps to '/' usually
    });

    test('Integrity: Invalid Route redirects to Valid Module (Self-Healing)', async ({ page }) => {
        const invalidUrl = '/non-existent-module-xyz';
        console.log(`Navigating to invalid route: ${invalidUrl}`);

        await page.goto(invalidUrl);

        // Handle login redirect if it happens on reload
        const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await guestLoginBtn.isVisible()) {
             await guestLoginBtn.click();
        }

        // Should NOT stay on invalid URL or crash
        // Should redirect to Dashboard
        await expect(page.getByText('Agent Workspace')).toBeVisible();

        const url = new URL(page.url());
        expect(url.pathname).toBe('/');
    });
});
