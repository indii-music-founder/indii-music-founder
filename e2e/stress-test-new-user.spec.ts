import { test, expect } from '@playwright/test';

// Configuration for "The Gauntlet"
const BASE_URL = 'http://localhost:4242';
const TEST_USER_ID = `gauntlet_user_${Date.now()}`;

test.describe('The Gauntlet: Live Production Stress Test', () => {

    test.beforeEach(async ({ page }) => {
        // Capture browser logs for debugging
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', err => console.error(`BROWSER ERROR: ${err.message}`));

        // 1. Visit the live site
        await page.goto(BASE_URL);

        // Wait for initial load
        await page.waitForLoadState('domcontentloaded');
    });

    test('Scenario 1: New User "Speedrun" (Onboarding -> Project -> Agent)', async ({ page }) => {
        // --- 1. LOGIN ---
        console.log(`[Gauntlet] Starting Speedrun for ${TEST_USER_ID}`);

        // A. Handle Login (Using Provided Test Credentials)
        console.log('[Gauntlet] Attempting Login with Test Credentials...');
        await page.getByLabel(/email/i).fill('the.walking.agency.det@gmail.com');
        await page.getByLabel(/password/i).fill('qwertyuiop');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Wait for login to complete (Sign In button should disappear)
        await expect(page.getByRole('button', { name: /sign in/i })).not.toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(1000); // Small buffer for state unification

        // Force app state to Onboarding (SPA state takes precedence over URL)
        console.log('[Gauntlet] Forcing module state to "onboarding"...');
        await page.evaluate(() => {
            (window as any).useStore.setState({ currentModule: 'onboarding' });
        });

        // Also update URL for consistency (though App might not sync it automatically)
        // await page.goto(`${BASE_URL}/onboarding`); // Optional, might reload and reset state

        // Check for Onboarding Chat
        console.log('[Gauntlet] State set to Onboarding. Checking for Chat Input...');

        // Re-inject TEST_MODE in case of navigation/reload
        await page.evaluate(() => (window as any).__TEST_MODE__ = true);

        // 1. Send a message to the AI
        const chatInput = page.getByPlaceholder(/Tell me about your music/i);

        try {
            await expect(chatInput).toBeVisible({ timeout: 5000 });
        } catch (e) {
            console.log('[Gauntlet] Chat Input NOT visible. Dumping page content...');
            const body = await page.content();
            console.log(`[Gauntlet] Page Content Snapshot: ${body.substring(0, 1000)}...`); // Truncate for sanity
            throw e;
        }

        await chatInput.fill('I am a hyperpop artist inspired by SOPHIE and Charli XCX.');
        await page.getByRole('button').filter({ has: page.locator('svg.lucide-send') }).click();

        // 2. Wait for AI response
        // Initial greeting (1) + User message (2) + Agent Response (3)
        // We must wait for the count to be 3.
        await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(3, { timeout: 45000 });

        const responseLocator = page.locator('.whitespace-pre-wrap').nth(2); // 0-indexed, so 2 is the 3rd message
        const responseText = await responseLocator.innerText();
        console.log(`[Gauntlet] Agent Response: "${responseText}"`);


        // Check for specific error keywords (adjusted to catch the user-reported "error")
        if (responseText.toLowerCase().includes('glitch') || responseText.toLowerCase().includes('error')) {
            throw new Error(`Agent reported error: ${responseText}`);
        }

        // Fail if we see "Error" or "Failed" in the response
        expect(responseText).not.toMatch(/error/i);
        expect(responseText).not.toMatch(/failed/i);
        expect(responseText).not.toMatch(/went wrong/i);

        // Try to finish if button is available
        const finishBtn = page.getByRole('button', { name: /Go to Studio/i });
        // Wait for it to potentially appear if the agent was successful
        try {
            await expect(page.getByRole('button', { name: "Go to Studio" })).toBeVisible({ timeout: 5000 });
            console.log('[Gauntlet] "Go to Studio" button visible. Clicking...');
            await finishBtn.click(); // Click the button after it's visible
        } catch (e) {
            console.log('[Gauntlet] "Go to Studio" button did not appear. We likely have an agent or state issue.');
            throw new Error(`Onboarding flow failed to complete: "Go to Studio" button missing. Last Agent Response: "${responseText}"`);
        }
        const skipBtn = page.getByRole('button', { name: /skip|continue|enter studio/i });
        if (await skipBtn.isVisible()) {
            await skipBtn.click();
        }

        // Now expect Dashboard
        await expect(page.getByRole('heading', { name: /Studio Headquarters/i })).toBeVisible({ timeout: 15000 });

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
        // 4. Send a generic message to trigger GenUI (Choice Tool)
        const agentInput = page.getByPlaceholder(/describe your creative task/i);
        await expect(agentInput).toBeVisible();
        await agentInput.fill("I want to update my genre. Please give me some options.");
        await page.keyboard.press('Enter');

        // 5. Wait for Agent Response AND GenUI Buttons
        // The agent should ask for Genre or similar with buttons
        console.log('[Gauntlet] Waiting for Agent response and Options...');
        const agentResponse = page.locator('.bg-\\[\\#1a1f2e\\]').last();
        await expect(agentResponse).toBeVisible({ timeout: 15000 });

        // Check if buttons rendered (GenUI validation)
        const genUIButtons = agentResponse.locator('button');
        if (await genUIButtons.count() > 0) {
            console.log('[Gauntlet] GenUI Buttons Detected! Clicking first option...');
            await genUIButtons.first().click();
            // Wait for follow-up response
            await page.waitForTimeout(3000);
        } else {
            console.log('[Gauntlet] No GenUI buttons detected, proceeding with text check only.');
        }

        // 6. Send more details to ensure we hit >50% profile completion
        // (Bio, Socials, Vibe)
        await agentInput.fill("My bio is: I am a Techno producer from Berlin. I love dark industrial sounds. My instagram is @techno_king.");
        await page.keyboard.press('Enter');

        // Wait for processing
        await page.waitForTimeout(5000);
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
