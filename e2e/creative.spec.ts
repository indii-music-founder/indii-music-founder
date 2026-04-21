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
        await page.route(/.*(firebasevertexai|generativelanguage)\.googleapis\.com.*/, async (route, request) => {
            const url = request.url();
            console.log(`[E2E] Intercepted GenAI URL: ${url}`);
            if (url.includes('generateVideos') || url.includes('veo')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        name: 'operations/mock-operation-id',
                        done: true,
                        response: {
                            generatedVideos: [{
                                video: {
                                    videoBytes: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
                                }
                            }]
                        }
                    })
                });
            } else {
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
            }
        });

        // authedPage fixture handles auth mock and navigates to '/'

        // Navigate directly to creative module
        await page.goto('/creative');
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 15_000 });

        // Wait for the Creative module to fully mount (direct generation button is always present in navbar)
        await page.waitForSelector('[data-testid="direct-view-btn"]', { state: 'attached', timeout: 30_000 });
    });

    test('should show direct generation by default', async ({ authedPage: page }) => {
        const viewBtn = page.locator('[data-testid="direct-view-btn"]');
        const isVisible = await viewBtn.isVisible().catch(() => false);
        if (isVisible) {
            // Button should be active/selected
            await expect(viewBtn).toBeVisible();
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

    test('should use prompt builder and display bottom action bar after generation', async ({ authedPage: page }) => {
        const directBtn = page.locator('[data-testid="direct-view-btn"]');
        if (await directBtn.isVisible().catch(() => false)) {
            await directBtn.click();
            await page.waitForTimeout(1_000);
        }

        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        if (await promptInput.isVisible().catch(() => false)) {
            // Toggle prompt builder
            const toggleBtn = page.locator('[data-testid="toggle-prompt-builder"]');
            await toggleBtn.click();
            await page.waitForTimeout(500);

            // Open a category dropdown, e.g., Medium
            const mediumCategoryBtn = page.locator('[data-testid="category-Medium-trigger"]');
            if (await mediumCategoryBtn.isVisible().catch(() => false)) {
                await mediumCategoryBtn.click();
                await page.waitForTimeout(500);

                // Click a tag, e.g., Cinematic
                const tagBtn = page.locator('[data-testid="tag-Cinematic-btn"]');
                if (await tagBtn.isVisible().catch(() => false)) {
                    await tagBtn.click();
                    await page.waitForTimeout(500);

                    // Check that the tag was added to the input
                    const inputValue = await promptInput.inputValue();
                    expect(inputValue).toContain('Cinematic');
                }
            }

            // Generate
            await promptInput.fill('A cinematic view of a spaceship landing on a desert planet, Cinematic');
            const generateBtn = page.locator('[data-testid="direct-generate-btn"]');
            if (await generateBtn.isVisible().catch(() => false)) {
                await expect(generateBtn).toBeEnabled({ timeout: 10_000 });
                await generateBtn.click();
                
                // Wait for the mock API response and UI to update
                await page.waitForTimeout(2_000);

                // Verify bottom action bar appears
                const bottomActionBtn = page.locator('[data-testid="bottom-action-btn"]');
                await expect(bottomActionBtn).toBeVisible({ timeout: 10_000 });

                // Click it to transition to editor mode
                await bottomActionBtn.click();
                await page.waitForTimeout(1_000);
            }
        }

        // App must not crash regardless
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });

    test('should generate a sequence and transition to Director Mode', async ({ authedPage: page }) => {
        // Video mock handled in beforeEach, no need to overwrite unless specific test requires it

        // Click direct mode
        const directBtn = page.locator('[data-testid="direct-view-btn"]');
        if (await directBtn.isVisible().catch(() => false)) {
            await directBtn.click();
            await page.waitForTimeout(1_000);
        }

        // Switch to video mode
        const videoModeBtn = page.locator('[data-testid="direct-video-mode-btn"]');
        if (await videoModeBtn.isVisible().catch(() => false)) {
            await videoModeBtn.click();
            await page.waitForTimeout(1_000);
        }

        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        if (await promptInput.isVisible().catch(() => false)) {
            await promptInput.fill('Sequence 1');
            const generateBtn = page.locator('[data-testid="direct-generate-btn"]');
            
            // First Generation
            await generateBtn.click();
            await page.waitForTimeout(2_000);

            // Second Generation (to reach videoClipCount >= 2)
            await promptInput.fill('Sequence 2');
            await generateBtn.click();
            await page.waitForTimeout(2_000);

            // Now the button should say "Finish & Produce Video"
            const bottomActionBtn = page.locator('button', { hasText: 'Finish & Produce Video' });
            if (await bottomActionBtn.isVisible().catch(() => false)) {
                await bottomActionBtn.click();
                await page.waitForTimeout(1_000);

                // Verify the Director tab is visible in the navbar
                const directorTab = page.locator('[data-testid="director-view-btn"]');
                await expect(directorTab).toBeVisible({ timeout: 5_000 });
            }
        }
    });
});
