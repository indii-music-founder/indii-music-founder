import { test, expect } from './fixtures/auth';

/**
 * Creative Studio Character Library E2E Tests
 *
 * Covers: Adding a character reference via the generated gallery selector.
 *
 * Run: npx playwright test e2e/creative-character.spec.ts
 */
test.describe('Creative Studio - Character Library', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

        // Mock Gemini API calls
        await page.route(/.*(firebasevertexai|generativelanguage)\.googleapis\.com.*/, async (route, request) => {
            const url = request.url();
            if (url.includes('generateVideos') || url.includes('veo')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        name: 'operations/mock-op',
                        done: true,
                        response: {
                            generatedVideos: [{
                                video: {
                                    uri: 'https://mock-video.com/v.mp4',
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
                        candidates: [{
                            content: {
                                parts: [{
                                    inlineData: {
                                        mimeType: 'image/png',
                                        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
                                    }
                                }],
                                role: 'model'
                            }
                        }]
                    })
                });
            }
        });

        // Navigate to creative module
        await page.goto('/creative');
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 15_000 });

        // Ensure Direct mode is active
        const directBtn = page.locator('[data-testid="direct-view-btn"]');
        await directBtn.waitFor({ state: 'attached', timeout: 30_000 });
        if (await directBtn.isVisible().catch(() => false)) {
            await directBtn.click();
            await page.waitForTimeout(1_000);
        }
    });

    test('should allow selecting a generated image from Character Library gallery', async ({ authedPage: page }) => {
        // First, generate an image so it appears in the generated history
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await promptInput.fill('A cyberpunk character portrait');
        
        const generateBtn = page.locator('[data-testid="direct-generate-btn"]');
        await expect(generateBtn).toBeEnabled({ timeout: 10_000 });
        await generateBtn.click();
        
        // Wait for generation to complete (mock takes ~2s)
        await page.waitForTimeout(3000);

        // Click Add Person in CharacterLibrary
        const addPersonBtn = page.locator('button:has-text("Add Person")');
        await expect(addPersonBtn).toBeVisible({ timeout: 10_000 });
        await addPersonBtn.click();

        // Wait for the modal to open
        const modalTitle = page.getByText('ADD CHARACTER REFERENCE');
        await expect(modalTitle).toBeVisible({ timeout: 5000 });

        // Find a generated image in the modal and select it
        // The images don't have explicit test IDs, but we can look for the Select button text overlay
        const selectOverlay = page.getByText('Select').first();
        await expect(selectOverlay).toBeVisible({ timeout: 5000 });
        
        // Click the first generated image in the gallery
        await selectOverlay.click({ force: true });

        // Wait for the modal to close and the toast to appear
        await expect(modalTitle).not.toBeVisible();
        
        // Check if the reference was added to the Character Library UI
        // It renders with the name "Character 1"
        const characterLabel = page.getByText('Character 1');
        await expect(characterLabel).toBeVisible({ timeout: 5000 });

        // The default reference type should be 'subject' (Face)
        const faceToggle = page.locator('[data-testid="ref-type-face-0"]');
        await expect(faceToggle).toBeVisible();
        await expect(faceToggle).toHaveClass(/bg-blue-500/);

        // App stable
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    });
});
