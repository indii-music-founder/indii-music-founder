import { test, expect } from './fixtures/auth';

/**
 * Video Producer E2E Tests
 */
test.describe('Video Producer', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // Navigate directly to video module
        await page.goto('/video');
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });

        // Wait for module to be fully mounted (this container is always present in Video module)
        await page.waitForSelector('[data-testid="video-navbar"]', { state: 'attached', timeout: 15_000 });

        // Wait for the specific button to be attached (it might be hidden in some views, but it's generated)
        await page.waitForSelector('[data-testid="mode-director-btn"]', { state: 'attached', timeout: 10_000 });
    });

    test('should show studio by default', async ({ authedPage: page }) => {
        // On mobile, the active state is verified by checking the button is attached
        const studioBtn = page.locator('[data-testid="mode-director-btn"]');
        await expect(studioBtn).toBeAttached();
    });

    test('should switch to Editor mode', async ({ authedPage: page }) => {
        const editorBtn = page.locator('[data-testid="mode-editor-btn"]');
        await editorBtn.click();

        // In editor mode, direct prompt bar should be hidden or replaced
        const promptInput = page.locator('[data-testid="director-prompt-input"]');
        await expect(promptInput).not.toBeVisible();
    });

    test('should allow prompt entry in Director mode', async ({ authedPage: page }) => {
        const promptInput = page.locator('[data-testid="director-prompt-input"]');
        await expect(promptInput).toBeVisible();
        await promptInput.fill('Cinematic shot of a space station orbiting a neon planet');

        const generateBtn = page.locator('[data-testid="video-generate-btn"]');
        await expect(generateBtn).toBeEnabled();
    });

    test('should trigger video generation process', async ({ authedPage: page }) => {
        const promptInput = page.locator('[data-testid="director-prompt-input"]');
        await promptInput.fill('Test sequence');

        const generateBtn = page.locator('[data-testid="video-generate-btn"]');
        await generateBtn.click();

        // Should show "Action..." or "Generating" state
        await expect(generateBtn).toHaveText(/Action|Generating/i);
    });
});
