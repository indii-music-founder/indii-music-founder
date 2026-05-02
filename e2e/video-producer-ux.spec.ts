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

        // Navigate to video producer module
        await page.goto('/video');
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 15_000 });
        
        // Wait for Video Producer to mount
        const header = page.locator('[data-testid="module-header"]');
        await expect(header).toHaveText('Video Producer', { timeout: 10_000 });
    });

    // ─── TEST 1: Sidebar Highlight Sync ──────────────────────────────────
    test('should highlight Video Producer in sidebar upon navigation', async ({ authedPage: page }) => {
        // Verify sidebar module indicator for video is active
        const sidebarVideoItem = page.locator('[data-testid="sidebar-item-video"]');
        
        // The active item usually has specific styling or classes indicating selection
        // In indiiOS, it typically uses text-white or bg-white/10
        await expect(sidebarVideoItem).toBeVisible();
        const className = await sidebarVideoItem.getAttribute('class');
        
        // Ensure it contains active state markers (e.g. text-white)
        expect(className).toContain('text-white');
    });

    // ─── TEST 2: Generate Button Guarding ────────────────────────────────
    test('should disable generate button during active job generation', async ({ authedPage: page }) => {
        // Find the prompt input and type
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await promptInput.fill('A cinematic view of the ocean');
        
        // The generate button
        const generateBtn = page.locator('[data-testid="video-generate-btn"]');
        await expect(generateBtn).toBeEnabled();

        // Click generate
        await generateBtn.click();
        
        // Button should become disabled immediately while generating
        await expect(generateBtn).toBeDisabled();
        
        // App stable
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });

    // ─── TEST 3: Prompt Persistence ──────────────────────────────────────
    test('should persist prompt text when switching view modes', async ({ authedPage: page }) => {
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await promptInput.fill('A cyberpunk rooftop at golden hour');

        // Switch to editor mode
        const editorBtn = page.locator('[data-testid="mode-editor-btn"]');
        if (await editorBtn.isVisible().catch(() => false)) {
            await editorBtn.click();
            await page.waitForTimeout(500);
        }

        // Switch back to director mode
        const directorBtn = page.locator('[data-testid="mode-director-btn"]');
        if (await directorBtn.isVisible().catch(() => false)) {
            await directorBtn.click();
            await page.waitForTimeout(500);
        }

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
        const improveBtn = page.locator('button[title="Improve with AI"]');
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
