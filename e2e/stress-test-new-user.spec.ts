import { test, expect } from '@playwright/test';

// Configuration for "The Gauntlet"
const BASE_URL = 'https://architexture-ai-studio.web.app';
const TEST_USER_ID = `gauntlet_user_${Date.now()}`;

test.describe('The Gauntlet: Live Production Stress Test', () => {

    test.beforeEach(async ({ page }) => {
        // 1. Visit the live site
        await page.goto(BASE_URL);

        // Wait for initial load
        page.on('console', msg => console.log('BROWSER:', msg.text()));
        await page.waitForLoadState('domcontentloaded');
    });

    test('Scenario 1: New User "Speedrun" (Onboarding -> Project -> Agent)', async ({ page }) => {
        console.log(`[Gauntlet] Starting Speedrun for ${TEST_USER_ID}`);

        // A. Check for Login/Auth Landing
        // Assuming anonymous auth auto-logs in, we might land on Dashboard or Onboarding
        // Check for common landing elements
        const getStartedBtn = page.getByRole('button', { name: /get started|launch|sign in/i });
        if (await getStartedBtn.isVisible()) {
            await getStartedBtn.click();
        }

        // B. Verify Dashboard Load
        // Use a more specific selector to avoid strict mode violations (multiple "Projects" texts)
        await expect(page.getByRole('heading', { name: /Recent Projects/i })).toBeVisible({ timeout: 15000 });

        // C. Create New Project (Creative Domain)
        await page.getByRole('button', { name: /new project/i }).first().click();
        await page.getByPlaceholder(/project name/i).fill(`Gauntlet Project ${Date.now()}`);
        // await page.getByRole('combobox').selectOption({ label: 'Creative Studio' });
        // Assuming default is Creative Studio or valid. skipping explicit selection to avoid UI complexity in test.
        // If native select is hidden or custom, use specific selectors. 
        // Fallback: Just click "Create" if it defaults.
        await page.getByRole('button', { name: /create/i }).click();

        // D. Verify Redirection to Creative Module
        await expect(page.url()).toContain('/creative');
        await expect(page.getByText('Creative Studio')).toBeVisible();

        // E. Stress Test: Agent Delegation (The fix we just made)
        // Open Command Bar or Assistant
        // Assuming a way to chat:
        const agentInput = page.getByPlaceholder(/describe your creative task/i);
        await expect(agentInput).toBeVisible();

        await agentInput.fill('Test agent connection status.');
        await page.keyboard.press('Enter');

        // F. Verify Response (Not "Failed to fetch")
        // Wait for ANY response bubble
        const response = page.getByTestId('agent-message').last();
        await expect(response).toBeVisible({ timeout: 20000 }); // Give cloud function time to warm up
        await expect(response).not.toContainText('Failed to fetch');
        await expect(response).not.toContainText('error');

        console.log('[Gauntlet] Agent responded successfully.');
    });

    test('Scenario 2: The "Chaos" Check (Rapid Navigation)', async ({ page }) => {
        // A. Quick navigation between modules to check for memory leaks or unmount crashes
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForTimeout(1000); // Wait for auth

        const modules = ['creative', 'music', 'visualization', 'dashboard'];

        for (const mod of modules) {
            console.log(`[Gauntlet] Jumping to ${mod}...`);
            await page.goto(`${BASE_URL}/${mod}`);
            await page.waitForLoadState('domcontentloaded');
            // Check for error boundary
            await expect(page.getByText('Something went wrong')).not.toBeVisible();
            await page.waitForTimeout(500); // Inhumanly fast but plausible for "stress"
        }
    });

});
