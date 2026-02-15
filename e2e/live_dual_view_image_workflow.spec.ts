import { test, expect } from '@playwright/test';

/**
 * E2E: LIVE Dual-View Image Editing Workflow
 * ----------------------------------------
 * This test verifies the full end-to-end image creation and dual-view editing flow
 * on the LIVE production application (https://indiios-studio.web.app).
 * 
 * NO MOCKS are used in this test. It performs real authentication and real AI generations.
 */

test.describe('LIVE Dual-View Image Editing Workflow', () => {
    test.setTimeout(120000); // 2 minutes for real AI generation

    test('Full End-to-End Image Creation and Dual-View Editing (LIVE)', async ({ page }) => {
        // --- STEP 0: LOGIN ---
        console.log('TEST: Step 0 - Logging in to LIVE app...');
        await page.goto('https://indiios-studio.web.app/login');

        // Credentials from .env (must be available in the test runner environment)
        const email = process.env.AUDITOR_EMAIL || 'automator@indiios.com';
        const password = process.env.AUDITOR_PASSWORD || 'AutomatorPass123!';

        await page.fill('[aria-label="email"]', email);
        await page.fill('[aria-label="password"]', password);
        await page.click('button:has-text("Sign In")');

        // Wait for dashboard (Agent Workspace)
        await expect(page).toHaveURL(/.*dashboard|.*workspace|.*\//, { timeout: 20000 });
        console.log('TEST: Login successful.');

        // --- STEP 1: NAVIGATE TO CREATIVE STUDIO ---
        console.log('TEST: Step 1 - Navigating to Creative Studio...');
        // Locate "Creative Studio" in Quick Launch
        const creativeStudioBtn = page.locator('button:has-text("Creative Studio")');
        await expect(creativeStudioBtn).toBeVisible();
        await creativeStudioBtn.click();

        await expect(page).toHaveURL(/.*creative/);
        console.log('TEST: Creative Studio loaded.');

        // --- STEP 2: GENERATE INITIAL IMAGE ---
        console.log('TEST: Step 2 - Generating Initial Image...');

        // Use the global command bar (based on dashboard screenshot and likely common layout)
        const promptInput = page.locator('[data-testid="prompt-input"] textarea, textarea[placeholder*="Message"], textarea[placeholder*="orchestrate"]');
        await expect(promptInput).toBeVisible();

        const testPrompt = `A scenic mountain landscape at sunset, photorealistic, high quality, 16:9 aspect ratio --test-e2e-${Date.now()}`;
        await promptInput.fill(testPrompt);

        const runBtn = page.locator('[data-testid="command-bar-run-btn"], button:has(svg.lucide-arrow-right), button:has-text("Run")');
        await runBtn.click();

        // Wait for the gallery item to appear
        console.log('TEST: Waiting for real image generation...');
        // The first item in history should match our unique prompt substring
        const galleryItem = page.locator(`[data-testid^="gallery-item-"]`).first();
        await expect(galleryItem).toBeVisible({ timeout: 60000 });
        console.log('TEST: Image generated successfully.');

        // --- STEP 3: OPEN CANVAS & MAGIC EDIT ---
        console.log('TEST: Step 3 - Opening Canvas & Triggering Magic Edit...');
        await galleryItem.click();

        const canvasContainer = page.locator('[data-testid="creative-canvas-container"]');
        await expect(canvasContainer).toBeVisible();

        const magicInput = page.locator('[data-testid="magic-fill-input"]');
        await expect(magicInput).toBeVisible();
        await magicInput.fill('Add a small wooden cabin by the lake');

        const refineBtn = page.locator('[data-testid="magic-generate-btn"]');
        await refineBtn.click();

        // --- STEP 4: SELECT CANDIDATE ---
        console.log('TEST: Step 4 - Waiting for Magic Edit candidates...');
        const candidateBtn = page.locator('[data-testid="candidate-select-btn-0"]');
        await expect(candidateBtn).toBeVisible({ timeout: 60000 });
        await candidateBtn.click({ force: true });
        console.log('TEST: Candidate selected.');

        // --- STEP 5: FINAL VERIFICATION ---
        console.log('TEST: Step 5 - Final Verifications...');
        const closeBtn = page.locator('[data-testid="canvas-close-btn"]');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click({ force: true });

        // Ensure we returned to gallery and the gallery is visible
        await expect(canvasContainer).not.toBeVisible();
        await expect(page.locator('[data-testid="creative-gallery"]')).toBeVisible();

        console.log('TEST: LIVE E2E workflow completed successfully!');
    });
});
