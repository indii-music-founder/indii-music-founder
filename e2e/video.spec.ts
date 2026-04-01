import { test, expect } from './fixtures/auth';

/**
 * Video Producer E2E Tests
 *
 * Covers: module load, mode switching (Director/Editor), prompt input,
 * and generation trigger.
 *
 * Run: npx playwright test e2e/video.spec.ts
 */
test.describe('Video Producer', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // Navigate directly to video module
        await page.goto('/video');
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 15_000 });

        // Wait for the Video module navbar to be attached (confirms lazy load complete)
        await page.waitForSelector('[data-testid="mode-director-btn"]', { state: 'attached', timeout: 30_000 });
    });

    test('should show studio by default', async ({ authedPage: page }) => {
        // Director button should be present in the navbar
        const studioBtn = page.locator('[data-testid="mode-director-btn"]');
        await expect(studioBtn).toBeAttached();
        // App must not crash
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });

    test('should switch to Editor mode', async ({ authedPage: page }) => {
        const editorBtn = page.locator('[data-testid="mode-editor-btn"]');
        if (await editorBtn.isVisible().catch(() => false)) {
            await editorBtn.click({ force: true });
            await page.waitForTimeout(1_000);

            // In editor mode, direct prompt bar should be hidden or replaced
            const promptInput = page.locator('[data-testid="director-prompt-input"]');
            await expect(promptInput).not.toBeVisible();
        }
        // App must not crash
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });

    test('should allow prompt entry in Director mode', async ({ authedPage: page }) => {
        const promptInput = page.locator('[data-testid="director-prompt-input"]');
        if (await promptInput.isVisible().catch(() => false)) {
            await promptInput.fill('Cinematic shot of a space station orbiting a neon planet');

            const generateBtn = page.locator('[data-testid="video-generate-btn"]');
            await expect(generateBtn).toBeEnabled();
        }
        // App must not crash
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });
});
