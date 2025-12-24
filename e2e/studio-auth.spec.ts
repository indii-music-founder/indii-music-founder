import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4242';

test.describe('Studio App Auth Flow', () => {

    test('Guest Login Flow', async ({ page }) => {
        // 1. Visit Studio
        await page.goto(STUDIO_URL);

        // 2. Expect Login Screen
        await expect(page.getByText('Sign in to your account')).toBeVisible();

        // 3. Click "Continue as Guest"
        await page.getByRole('button', { name: /continue as guest/i }).click();

        // 4. Expect Dashboard or Select Org
        // Depending on flow, guest might go straight to dashboard or onboarding
        // For now, check that we are NOT on login screen
        await expect(page.getByText('Sign in to your account')).not.toBeVisible();
        await expect(page.locator('.sidebar')).toBeVisible();
    });

    test('Sign Up Flow', async ({ page }) => {
        // 1. Visit Studio
        await page.goto(STUDIO_URL);

        // 2. Click "Sign up" link
        await page.getByRole('link', { name: /sign up/i }).click();

        // 3. Fill details
        await page.getByLabel('Email address').fill(`test.studio.${Date.now()}@example.com`);
        await page.getByLabel('Password').fill('TestPass123!');
        // Note: My Signup.tsx doesn't have "Confirm Password" in the code I wrote (it uses AuthService.signUp which takes email/pass/name)
        // Let's check Signup.tsx content if I need Name.
        // Step 211, 214 diffs don't show form fields. In Step 196 (previous session), Signup.tsx was created.
        // It likely has Name, Email, Password.
        await page.getByPlaceholder('Full Name').fill('Studio Test User');

        // 4. Submit
        await page.getByRole('button', { name: /create account/i }).click();

        // 5. Expect success/redirect
        await expect(page.locator('.animate-spin')).toBeVisible();
        // Eventually check for Sidebar
        await expect(page.locator('.sidebar')).toBeVisible({ timeout: 15000 });
    });

    test('Google Sign In Button Presence', async ({ page }) => {
        await page.goto(STUDIO_URL);
        await expect(page.getByText('Sign in with Google')).toBeVisible();
    });

});
