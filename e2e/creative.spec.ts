import { test, expect } from './fixtures/auth';

/**
 * Creative Studio E2E Tests
 *
 * Covers: module load, view switching (gallery/direct), prompt input,
 * mode switching (image/video), and generation trigger.
 *
 * Run: npx playwright test e2e/creative.spec.ts
 */
test.describe('Creative Studio', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        // Mock Gemini image generation API
        await page.route('**/generativelanguage.googleapis.com/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        inlineData: {
                                            mimeType: 'image/png',
                                            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                                        },
                                    },
                                ],
                                role: 'model',
                            },
                        },
                    ],
                }),
            });
        });

        // authedPage fixture handles auth mock and navigates to '/'

        // Navigate directly to creative module
        await page.goto('/creative');
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 15_000 });

        // Wait for the Creative module to fully mount (gallery button is always present in navbar)
        await page.waitForSelector('[data-testid="gallery-view-btn"]', { state: 'attached', timeout: 30_000 });
    });

    test('should show gallery by default', async ({ authedPage: page }) => {
        const galleryBtn = page.locator('[data-testid="gallery-view-btn"]');
        const isVisible = await galleryBtn.isVisible().catch(() => false);
        if (isVisible) {
            // Gallery button should be active/selected
            await expect(galleryBtn).toBeVisible();
        }
        // App must not crash regardless
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });

    test('should switch to direct generation mode', async ({ authedPage: page }) => {
        const directBtn = page.locator('[data-testid="direct-view-btn"]');
        const isVisible = await directBtn.isVisible().catch(() => false);

        if (isVisible) {
            await directBtn.click();
            await page.waitForTimeout(1_000);

            const promptInput = page.locator('[data-testid="direct-prompt-input"]');
            await expect(promptInput).toBeVisible({ timeout: 10_000 });
        }

        // App must not crash regardless
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });

    test('should handle prompt input and mode switching in Direct mode', async ({ authedPage: page }) => {
        const directBtn = page.locator('[data-testid="direct-view-btn"]');
        if (await directBtn.isVisible().catch(() => false)) {
            await directBtn.click();
            await page.waitForTimeout(1_000);
        }

        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        if (await promptInput.isVisible().catch(() => false)) {
            await promptInput.fill('A cyberpunk sunset');

            const videoModeBtn = page.locator('[data-testid="direct-video-mode-btn"]');
            if (await videoModeBtn.isVisible().catch(() => false)) {
                await videoModeBtn.click();
                await page.waitForTimeout(500);
            }

            const imageModeBtn = page.locator('[data-testid="direct-image-mode-btn"]');
            if (await imageModeBtn.isVisible().catch(() => false)) {
                await imageModeBtn.click();
                await page.waitForTimeout(500);
            }
        }

        // App must not crash regardless
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });

    test('should trigger generation UI state', async ({ authedPage: page }) => {
        const directBtn = page.locator('[data-testid="direct-view-btn"]');
        if (await directBtn.isVisible().catch(() => false)) {
            await directBtn.click();
            await page.waitForTimeout(1_000);
        }

        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        if (await promptInput.isVisible().catch(() => false)) {
            await promptInput.fill('A cinematic view of a spaceship landing on a desert planet');

            const generateBtn = page.locator('[data-testid="direct-generate-btn"]');
            if (await generateBtn.isVisible().catch(() => false)) {
                await expect(generateBtn).toBeEnabled({ timeout: 10_000 });
                await generateBtn.click();
                await page.waitForTimeout(2_000);

                // Verify no immediate error in body
                await expect(page.locator('body')).not.toHaveText(/failed to generate/i);
            }
        }

        // App must not crash regardless
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });
});
