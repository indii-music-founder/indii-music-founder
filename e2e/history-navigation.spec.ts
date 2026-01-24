import { test, expect } from '@playwright/test';

/**
 * HISTORY NAVIGATION
 * Mission: Verify the History module is accessible via Sidebar and Deep Link.
 */

const E2E_EMAIL = process.env.E2E_EMAIL || 'automator@indiios.com';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'AutomatorPass123!';

test.describe('History Navigation', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Shared login logic
        await page.goto('/');

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

    test('Sidebar: History link works', async ({ page }) => {
        // 1. Verify History link exists in Sidebar
        const historyBtn = page.getByTestId('nav-item-history');
        await expect(historyBtn).toBeVisible();

        // 2. Click History
        console.log('Navigating to History...');
        await historyBtn.click();

        // 3. Verify URL
        await expect(page).toHaveURL(/.*\/history/);

        // 4. Verify History UI (Check for "Archives" or "Temporal Stream" text from ConversationHistoryList)
        // Note: If history is empty, it shows "No temporal logs found."
        await expect(page.getByText('Archives', { exact: false })).toBeVisible();
    });

    test('Deep Link: /history loads correctly', async ({ page, context }) => {
        // Deep link test needs fresh context to bypass existing session state if any
        // But here we can just use page.goto since we are logged in (or will be redirected)
        // To be safe and test "landing", we use current page.

        console.log('Deep linking to: /history');
        await page.goto('/history');

        // Handle potential reload/login if needed (though session usually persists in dev mode)
        const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await guestLoginBtn.isVisible()) {
            await guestLoginBtn.click();
        }

        // Verify URL
        expect(page.url()).toContain('/history');

        // Verify UI
        await expect(page.getByText('Archives', { exact: false })).toBeVisible();
    });

    test('History: Back button returns to Dashboard', async ({ page }) => {
        // 1. Start at Dashboard
        await expect(page.getByText('Agent Workspace')).toBeVisible();

        // 2. Go to History
        await page.getByTestId('nav-item-history').click();
        await expect(page).toHaveURL(/.*\/history/);

        // 3. Go Back
        await page.goBack();

        // 4. Verify Dashboard
        await expect(page.getByText('Agent Workspace')).toBeVisible();
        await expect(page).toHaveURL(/.*\/$/); // Matches root path ending
    });
});
