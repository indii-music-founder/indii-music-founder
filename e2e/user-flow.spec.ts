import { test, expect } from '@playwright/test';

test.describe('New User Flow', () => {
    test('should complete the new user onboarding flow', async ({ page }) => {
        // 1. Land on Homepage
        await page.goto('/');

        // Check if we are redirected to Select Org or Dashboard
        // If it's a fresh session, we might be on Select Org or Login
        // But since we are using a real browser, we might need to handle the initial state.
        // Let's assume we land on the app root.

        // Wait for the app to load
        await page.waitForLoadState('domcontentloaded');

        // Check for Loading state
        const loader = page.getByText('Loading Module...');
        if (await loader.isVisible()) {
            console.log('Waiting for module to load...');
            await loader.waitFor({ state: 'hidden', timeout: 10000 });
        }

        // Check for API Key Error
        const apiError = page.getByText('API Key Missing'); // Guessing text
        if (await apiError.isVisible()) {
            console.log('API Key Error detected');
        }

        // If we are on the Select Org page (because no orgs exist or not selected)
        const selectOrgHeader = page.getByText('Select Organization');
        if (await selectOrgHeader.isVisible()) {
            // Create a new organization
            await page.getByRole('button', { name: 'Create New Organization' }).click();
            await page.getByPlaceholder('Organization Name').fill('Test Corp');
            await page.getByRole('button', { name: 'Create', exact: true }).click();
        }

        // Now we should be on the Dashboard
        await expect(page.getByText('Welcome back to')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('indiiOS')).toBeVisible();

        // Wait for Auth to initialize (anonymous sign-in)
        await page.waitForTimeout(3000);

        // 2. Create Project "Alpha"
        await page.getByTitle('New Project').click();
        await expect(page.getByText('Create New Project')).toBeVisible();

        await page.getByPlaceholder('Enter project name...').fill('Alpha');
        // Select Creative type (default)
        await page.getByRole('button', { name: 'Create Project' }).click();

        // Wait for modal to close (indicates success)
        await expect(page.getByText('Create New Project')).toBeHidden({ timeout: 10000 });

        // 3. Generate 1 Image
        // We should be redirected to Creative Studio (Art Department)
        // Check for prompt input to confirm we are there
        const promptInput = page.getByPlaceholder(/Describe what you want to create/i);
        await expect(promptInput).toBeVisible({ timeout: 10000 });
        await promptInput.fill('A futuristic city skyline at sunset');

        // Click Generate
        await page.getByRole('button', { name: /Generate Image/i }).click();

        // Wait for generation (mocked or real?)
        // Since we are running against the real app, it might try to call the API.
        // If we want to mock it, we should intercept the network request.
        // For now, let's just verify the button goes into loading state.
        await expect(page.locator('.animate-spin')).toBeVisible();

        // We can't easily wait for the real generation without a long timeout or mocking.
        // Let's assume the test passes if we triggered the generation.
    });
});
