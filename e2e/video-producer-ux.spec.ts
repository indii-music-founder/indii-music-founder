import { test, expect } from './fixtures/auth';

/**
 * Video Producer UX — Hardening E2E Tests
 *
 * Validates:
 *   1. Sidebar highlights on navigation (global module state sync).
 *   2. "Generate" button disable-state during job queueing.
 *   3. Prompt persistence across mode switches.
 *   4. Improve with AI integration.
 *
 * Run: npx playwright test e2e/video-producer-ux.spec.ts
 */
test.describe('Video Producer UX Hardening', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

        // Mock video generation API to stay in queue/processing for a moment, then complete
        await page.route('**/generativelanguage.googleapis.com/**', async (route, request) => {
            const url = request.url();
            if (url.includes('generateVideos') || url.includes('veo')) {
                // Return a mock operation
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        name: 'operations/mock-op',
                        done: false
                    })
                });
            } else {
                await route.fallback();
            }
        });

        // Navigate to creative module
        await page.goto('/creative');
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 15_000 });
        
        // Switch to Video Production Mode
        const videoTab = page.locator('[data-testid="director-view-btn"]');
        await expect(videoTab).toBeVisible({ timeout: 15_000 });
        await videoTab.click();
        await page.waitForTimeout(1_000);
    });

    // ─── TEST 1: Sidebar Highlight Sync ──────────────────────────────────
    test('should highlight Creative Studio in sidebar upon navigation', async ({ authedPage: page }) => {
        const sidebarCreativeItem = page.locator('[data-testid="nav-item-creative"]');
        await expect(sidebarCreativeItem).toBeVisible();
        const className = await sidebarCreativeItem.getAttribute('class');
        expect(className).toContain('text-dept-creative');
    });

    // ─── TEST 2: Generate Button Guarding ────────────────────────────────
    test('should disable generate button during active job generation', async ({ authedPage: page }) => {
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await promptInput.fill('A cinematic view of the ocean');
        
        const generateBtn = page.locator('[data-testid="video-generate-btn"]');
        await expect(generateBtn).toBeEnabled();

        // Delay the AI response to ensure the button stays disabled during assertion
        let releaseAi: () => void;
        const aiPromise = new Promise<void>(r => releaseAi = r);
        await page.route(
            /.*(firebasevertexai|generativelanguage).googleapis.com.*/,
            async (route) => {
                await aiPromise;
                route.fallback();
            }
        );

        // Click generate
        await generateBtn.click();
        
        // Button should become disabled immediately while generating
        await expect(generateBtn).toBeDisabled();
        
        // Release the AI response so the generation completes
        releaseAi!();

        // Wait a bit to ensure it doesn't crash
        await page.waitForTimeout(500);

        // App stable
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });

    // ─── TEST 3: Prompt Persistence ──────────────────────────────────────
    test('should persist prompt text when switching view modes', async ({ authedPage: page }) => {
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await promptInput.fill('A cyberpunk rooftop at golden hour');

        // Switch to direct image mode
        const imageTab = page.locator('[data-testid="direct-view-btn"]');
        await imageTab.click();
        await page.waitForTimeout(500);

        // Switch back to video mode
        const videoTab = page.locator('[data-testid="director-view-btn"]');
        await videoTab.click();
        await page.waitForTimeout(500);

        // Prompt should be preserved
        const value = await promptInput.inputValue();
        expect(value).toBe('A cyberpunk rooftop at golden hour');
    });

    // ─── TEST 4: Improve with AI Guarding ────────────────────────────────
    test('should disable improve button when prompt is empty', async ({ authedPage: page }) => {
        // Open the builder
        const toggleBtn = page.locator('[data-testid="toggle-prompt-builder"]');
        await toggleBtn.click();
        await page.waitForTimeout(500);

        // Improve button should be disabled since prompt is initially empty
        const improveBtn = page.locator('button[title="Improve with Intelligence"]');
        await expect(improveBtn).toBeDisabled();

        // Type into the prompt
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await promptInput.fill('neon city');
        await page.waitForTimeout(300);

        // Improve button should now be enabled
        await expect(improveBtn).toBeEnabled();
        
        // Clear prompt -> disabled again
        await promptInput.fill('');
        await page.waitForTimeout(300);
        await expect(improveBtn).toBeDisabled();
    });
});
