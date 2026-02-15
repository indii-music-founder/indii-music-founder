import { test, expect } from '@playwright/test';

/**
 * FLOW - Mobile Navigation
 * Mission: Verify the mobile navigation (FAB + Drawer) works correctly and matches the URL.
 */

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

test.describe('Flow: Mobile Navigation', () => {
    // Set mobile viewport (iPhone SE)
    test.use({ viewport: { width: 375, height: 667 } });
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        await test.step('Login', async () => {
            // Shared login logic
            await page.goto('/');

            // Check for Guest Login first (Dev mode)
            // We wait for either Guest Login or Sign In to be visible to avoid race conditions
            const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
            const loginButton = page.getByRole('button', { name: /sign in/i });

            try {
                // Wait for either button to appear
                await Promise.any([
                    guestLoginBtn.waitFor({ state: 'visible', timeout: 10000 }),
                    loginButton.waitFor({ state: 'visible', timeout: 10000 })
                ]);
            } catch (e) {
                console.log('Neither login button appeared in time, proceeding to verify if already logged in...');
            }

            if (await guestLoginBtn.isVisible()) {
                await guestLoginBtn.click();
            } else if (await loginButton.isVisible()) {
                if (!E2E_EMAIL || !E2E_PASSWORD) {
                    throw new Error('E2E_EMAIL and E2E_PASSWORD env vars are required for standard login');
                }
                await page.getByLabel(/email/i).fill(E2E_EMAIL);
                await page.getByLabel(/password/i).fill(E2E_PASSWORD);
                await loginButton.click();
            }

            // Wait for dashboard or any module to load
            await expect(page.getByText('Agent Workspace')).toBeVisible({ timeout: 30000 });
        });
    });

    test('Mobile Navigation: FAB opens menu and navigates correctly', async ({ page }) => {
        await test.step('Verify Desktop Chrome Hidden', async () => {
            // The desktop sidebar items should not be visible in the viewport
            await expect(page.getByTestId('nav-item-marketing')).not.toBeVisible();
        });

        await test.step('Verify FAB Visible', async () => {
            const fab = page.getByLabel('Open Navigation');
            await expect(fab).toBeVisible();
        });

        await test.step('Open Navigation Drawer', async () => {
            const fab = page.getByLabel('Open Navigation');
            await fab.click();
            const drawer = page.getByRole('dialog', { name: 'Navigation' });
            await expect(drawer).toBeVisible();
        });

        await test.step('Navigate to Marketing', async () => {
            const drawer = page.getByRole('dialog', { name: 'Navigation' });
            const marketingLink = drawer.getByRole('button', { name: 'Marketing Department' });
            await expect(marketingLink).toBeVisible();
            await marketingLink.click();
        });

        await test.step('Verify URL and UI', async () => {
            // Verify URL matches /marketing
            await expect(page).toHaveURL(/.*\/marketing/);

            // Verify UI shows Marketing Header
            // Note: Checking for "Campaigns" text which is in the MarketingSidebar (visible on mobile)
            // "Marketing Department" is only in the global sidebar (hidden) or drawer (closed).
            await expect(page.getByText('Campaigns', { exact: true })).toBeVisible();
        });

        await test.step('Verify Drawer Closed', async () => {
            const drawer = page.getByRole('dialog', { name: 'Navigation' });
            const fab = page.getByLabel('Open Navigation');
            await expect(drawer).not.toBeVisible();
            await expect(fab).toBeVisible();
        });
    });
});
