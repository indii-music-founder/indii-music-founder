import { test, expect } from '@playwright/test';

/**
 * Video Producer E2E Tests
 */
test.describe('Video Producer', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:4242');
        await page.waitForLoadState('networkidle');

        // Login as guest if on login page
        const guestBtn = page.locator('[data-testid="guest-login-btn"]');
        if (await guestBtn.isVisible()) {
            await guestBtn.click();
        }

        // Navigate to video
        const videoNav = page.locator('[data-testid="nav-item-video"]');
        await expect(videoNav).toBeVisible({ timeout: 10000 });
        await videoNav.click();

        // Wait for module header
        await page.waitForSelector('[data-testid="module-header"], h1:has-text("Video Producer")', { timeout: 15000 });
    });

    test('should show studio by default', async ({ page }) => {
        // Look for the "Studio" active state in navbar (Studio contains the prompt bar in Director mode)
        const studioBtn = page.locator('[data-testid="mode-director-btn"]');
        await expect(studioBtn).toBeVisible();
    });

    test('should switch to Editor mode', async ({ page }) => {
        const editorBtn = page.locator('[data-testid="mode-editor-btn"]');
        await editorBtn.click();

        // In editor mode, direct prompt bar should be hidden or replaced
        const promptInput = page.locator('[data-testid="director-prompt-input"]');
        await expect(promptInput).not.toBeVisible();
    });

    test('should allow prompt entry in Director mode', async ({ page }) => {
        const promptInput = page.locator('[data-testid="director-prompt-input"]');
        await expect(promptInput).toBeVisible();
        await promptInput.fill('Cinematic shot of a space station orbiting a neon planet');

        const generateBtn = page.locator('[data-testid="video-generate-btn"]');
        await expect(generateBtn).toBeEnabled();
    });

    test('should trigger video generation process', async ({ page }) => {
        const promptInput = page.locator('[data-testid="director-prompt-input"]');
        await promptInput.fill('Test sequence');

        const generateBtn = page.locator('[data-testid="video-generate-btn"]');
        await generateBtn.click();

        // Should show "Action..." or "Generating" state
        await expect(generateBtn).toHaveText(/Action|Generating/i);
    });
});
