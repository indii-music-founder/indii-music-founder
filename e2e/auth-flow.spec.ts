
import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4242';

test.describe('The Gatekeeper: Authentication Protocol', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(STUDIO_URL);
    });

    test('Block Invalid Credentials', async ({ page }) => {
        // Ensure we are on the login page
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

        // Attempt login with garbage
        await page.getByLabel(/email/i).fill('intruder@gatekeeper.test');
        await page.getByLabel(/password/i).fill('WrongPassword123!');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Check for error message (based on LoginForm.tsx rendering)
        // LoginForm shows: {authError && <p className="text-red-400...">}
        // We'll look for text that likely appears in an error.
        // Firebase auth errors usually contain "user-not-found" or "invalid-credential"
        // The error text might be customized but usually is visible.

        // Wait for potential error message
        await expect(page.locator('text=Firebase: Error')).toBeVisible({ timeout: 5000 }).catch(() => {
            // Or generic "invalid" text if the app sanitizes it
            return expect(page.getByText(/invalid|error|failed/i)).toBeVisible();
        });
    });

    test('Allow Valid Credentials (The Automator)', async ({ page }) => {
        // Use known test credentials
        await page.getByLabel(/email/i).fill('automator@indiios.com');
        await page.getByLabel(/password/i).fill('AutomatorPass123!');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Verify Access Granted
        await expect(page.getByRole('heading', { name: /STUDIO HQ/i })).toBeVisible({ timeout: 15000 });
    });
});
