import { test, expect } from '@playwright/test';

/**
 * Creative Studio E2E Tests
 */
test.describe('Creative Studio', () => {
    test.beforeEach(async ({ page }) => {
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

        await page.goto('http://localhost:4242');
        await page.waitForLoadState('networkidle');

        // Login as guest if on login page
        const guestBtn = page.locator('[data-testid="guest-login-btn"]');
        if (await guestBtn.isVisible()) {
            await guestBtn.click();
        }

        // Navigate to creative
        const creativeNav = page.locator('[data-testid="nav-item-creative"]');
        await expect(creativeNav).toBeVisible({ timeout: 15000 });
        await creativeNav.click();

        // Wait for module header
        await page.waitForSelector('h1:has-text("Creative Director")', { timeout: 15000 });
    });

    test('should show gallery by default', async ({ page }) => {
        const galleryBtn = page.locator('[data-testid="gallery-view-btn"]');
        await expect(galleryBtn).toHaveClass(/bg-purple-500/);
    });

    test('should switch to direct generation mode', async ({ page }) => {
        const directBtn = page.locator('[data-testid="direct-view-btn"]');
        await directBtn.click();

        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await expect(promptInput).toBeVisible();
    });

    test('should handle prompt input and mode switching in Direct mode', async ({ page }) => {
        await page.locator('[data-testid="direct-view-btn"]').click();

        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await promptInput.fill('A cyberpunk sunset');

        const videoModeBtn = page.locator('[data-testid="direct-video-mode-btn"]');
        await videoModeBtn.click();
        await expect(promptInput).toHaveAttribute('placeholder', /video/i);

        const imageModeBtn = page.locator('[data-testid="direct-image-mode-btn"]');
        await imageModeBtn.click();
        await expect(promptInput).toHaveAttribute('placeholder', /image/i);
    });

    test('should trigger generation UI state', async ({ page }) => {
        await page.locator('[data-testid="direct-view-btn"]').click();

        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await promptInput.fill('A cinematic view of a spaceship landing on a desert planet');

        const generateBtn = page.locator('[data-testid="direct-generate-btn"]');

        // Wait for button to be enabled (it might be disabled if loading)
        await expect(generateBtn).toBeEnabled({ timeout: 10000 });

        await generateBtn.click();

        // Verify generating state
        await expect(generateBtn).toHaveText(/generating/i);

        // Verify no immediate error in body
        await expect(page.locator('body')).not.toHaveText(/failed to generate/i);
    });
});
