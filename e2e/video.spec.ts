import { test, expect } from './fixtures/auth';

/**
 * Video Producer E2E Tests
 *
 * Covers: module load, switching to Video Production view via CreativeNavbar,
 * prompt input, and generation trigger.
 *
 * Run: npx playwright test e2e/video.spec.ts
 */
test.describe('Video Producer', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // Navigate to creative module
        await page.goto('/creative', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 15_000 });

        // Wait for the Creative module to mount and click Video tab
        const videoTab = page.locator('[data-testid="director-view-btn"]');
        await expect(videoTab).toBeVisible({ timeout: 15_000 });
        await videoTab.click();
        await page.waitForTimeout(1_000);
    });

    test('should show video view and components', async ({ authedPage: page }) => {
        // Video Tab should be active/selected
        const videoTab = page.locator('[data-testid="director-view-btn"]');
        await expect(videoTab).toBeVisible();

        // The prompt input bar for video should be present
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await expect(promptInput).toBeVisible();

        // App must not crash
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });

    test('should switch views inside creative and check prompt persistence', async ({ authedPage: page }) => {
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await promptInput.fill('Cinematic shot of space');

        // Switch to direct image mode
        const imageTab = page.locator('[data-testid="direct-view-btn"]');
        await imageTab.click();
        await page.waitForTimeout(500);

        // Switch back to video mode
        const videoTab = page.locator('[data-testid="director-view-btn"]');
        await videoTab.click();
        await page.waitForTimeout(500);

        // Input should still have value
        const value = await promptInput.inputValue();
        expect(value).toBe('Cinematic shot of space');
    });

    test('should allow prompt entry and have generate button enabled', async ({ authedPage: page }) => {
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await promptInput.fill('Cinematic shot of a space station orbiting a neon planet');

        const generateBtn = page.locator('[data-testid="video-generate-btn"]');
        await expect(generateBtn).toBeEnabled();

        // App must not crash
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });
});
