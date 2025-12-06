import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:5173';

test.describe('The Time Traveler: Data Persistence Verification', () => {

    test('Scenario 1: Project Persistence', async ({ page }) => {
        // 1. Visit Studio
        await page.goto(STUDIO_URL);

        // 2. Open Project Creator (via Command Bar or Navigation)
        // We'll use the Command Bar tool for speed as checking UI buttons can be flaky if ID changed.
        const input = page.locator('input[type="text"][placeholder*="Describe"]');

        const timestamp = Date.now();
        const projectName = `TimeTraveler_${timestamp}`;

        // 3. Command: Create Project
        await input.fill(`Create a new marketing project called "${projectName}"`);
        await page.locator('button[type="submit"]').click();

        // 4. Wait for confirmation (Project Name should appear in UI/Header)
        await expect(page.locator(`text=${projectName}`)).toBeVisible({ timeout: 15000 });

        // 5. Reload Page (The Time Travel event)
        await page.reload();

        // 6. Verify Project Exists in List
        // We can ask the agent to list projects or check the UI if we know the selector.
        // Let's ask the agent to "list projects" and check the text response.
        await input.fill('List my projects');
        await page.locator('button[type="submit"]').click();

        // 7. Assert Persistence
        await expect(page.locator(`text=${projectName}`)).toBeVisible({ timeout: 10000 });
    });

});
