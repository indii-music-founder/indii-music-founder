import { test, expect } from '@playwright/test';

const BASE_URL = 'https://architexture-ai-studio.web.app';

test.describe('The Nomad Workflow: Cross-Device Continuity', () => {

    test('Electron -> Mobile -> Desktop Data Sync', async ({ browser }) => {
        // --- CONTEXT A: "Electron" (Desktop Viewport) ---
        const electronContext = await browser.newContext({
            viewport: { width: 1280, height: 800 },
        });
        const pageA = await electronContext.newPage();

        // Listen for console logs to debug errors
        pageA.on('console', msg => console.log(`[Browser A] ${msg.text()}`));

        console.log('[Nomad] Step 1: Starting on Electron (Simulated)...');
        await pageA.goto(BASE_URL);
        await pageA.waitForLoadState('domcontentloaded');

        // Initial Auth/Landing Handling (Crucial step from stress-test-new-user)
        const getStartedBtn = pageA.getByRole('button', { name: /get started|launch|sign in/i });
        if (await getStartedBtn.isVisible()) {
            console.log('[Nomad] Clicking Get Started...');
            await getStartedBtn.click();
        }

        // Create a Project
        const projectName = `Nomad Project ${Date.now()}`;
        console.log(`[Nomad] Attempting to create project: ${projectName}`);

        await pageA.getByRole('button', { name: /new project/i }).first().click();
        await pageA.getByPlaceholder(/project name/i).fill(projectName);
        await pageA.getByRole('button', { name: /create/i }).click();

        console.log('[Nomad] Clicked Create. Waiting for modal to close...');
        // Check if modal closes (Success) or Error appears
        // Check for Agent Hello or Response
        try {
            await expect(pageA.getByTestId('agent-message').last()).toBeVisible({ timeout: 10000 });
            console.log('[Nomad] Modal closed. Waiting for navigation...');
        } catch (e) {
            console.log('[Nomad] Modal stalled. Checking for errors...');
            const errorMsg = await pageA.getByRole('alert').textContent().catch(() => 'No alert found');
            console.log(`[Nomad] Visible Error: ${errorMsg}`);
        }

        // Wait for project to be created and page to update
        // We know from stress-test-new-user that looking for specific module text can be flaky
        // reliably, the Project Name should appear in the header or sidebar.
        await expect(pageA.getByText(projectName, { exact: false })).toBeVisible({ timeout: 20000 });

        // Ensure we are somewhat "inside" the project context (URL change)
        await expect(pageA).not.toHaveURL(BASE_URL + '/dashboard');

        // **KEY STEP**: Capture Auth State to simulate "Logging In" on next device
        // In a real scenario, the user types user/pass. Here, we transfer the token.
        const storageState = await electronContext.storageState();
        await electronContext.close();


        // --- CONTEXT B: "Mobile" (iPhone Viewport) ---
        console.log('[Nomad] Step 2: Switching to iPhone...');
        const mobileContext = await browser.newContext({
            // Simulating iPhone 14 Pro
            viewport: { width: 390, height: 844 },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            storageState: storageState // <--- "Logged In" as same user
        });
        const pageB = await mobileContext.newPage();
        await pageB.goto(BASE_URL);

        // Verify Project Exists on Mobile
        // Mobile layout is different; might need to open menu or check list
        // Assuming dashboard redirects to last project or shows list
        // If we land on Dashboard:
        if (await pageB.getByRole('heading', { name: /Recent Projects/i }).isVisible()) {
            await pageB.getByText(projectName).click();
        }

        await expect(pageB.getByText(projectName)).toBeVisible();

        // Make an Edit on Mobile
        // e.g. Add a note or chat message
        const mobileNote = 'Mobile was here';
        const agentInput = pageB.getByPlaceholder(/describe your creative task/i);
        if (await agentInput.isVisible()) {
            await agentInput.fill(mobileNote);
            await pageB.keyboard.press('Enter');
            // Wait for it to appear in chat
            await expect(pageB.getByText(mobileNote)).toBeVisible();
        }

        await mobileContext.close();


        // --- CONTEXT C: "Desktop Cloud" (Standard Browser) ---
        console.log('[Nomad] Step 3: Back to Desktop Web...');
        const cloudContext = await browser.newContext({
            storageState: storageState // <--- "Logged In"
        });
        const pageC = await cloudContext.newPage();
        await pageC.goto(BASE_URL);

        // Verify Mobile Edit is visible on Desktop
        // If query param /chat isn't persisted, we might need to navigate to project
        // Assuming we need to select project again
        const projectCard = pageC.locator('div', { hasText: projectName }).first();
        if (await projectCard.isVisible()) {
            await projectCard.click();
        }

        // Check for the chat message "Mobile was here"
        // This proves ROUND TRIP sync: Desktop -> Cloud -> Mobile -> Cloud -> Desktop
        await expect(pageC.getByText(mobileNote)).toBeVisible();

        console.log('[Nomad] SUCCESS: Workflow completed across 3 simulated devices.');
        await cloudContext.close();
    });

});
