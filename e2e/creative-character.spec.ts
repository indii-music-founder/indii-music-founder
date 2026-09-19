import { test, expect } from './fixtures/auth';

/**
 * Creative Studio Character Library E2E Tests
 *
 * Covers: Adding a character reference via the generated gallery selector with strict locators.
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

        // Wait for the app container from the initial page load in the authedPage fixture
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 30_000 });

        // Navigate client-side to creative module via Zustand store
        await page.evaluate(() => {
            const store = (window as any).useStore;
            if (store) {
                store.getState().setModule('creative');
                store.getState().setViewMode('direct');
            }
        });
        await expect(page.getByTestId('creative-studio-container')).toBeVisible({ timeout: 30_000 });
    });

    test('should allow selecting a generated image from Character Library gallery', async ({ authedPage: page }) => {
        // 1. Generate an image so it appears in the generated history
        const promptInput = page.getByTestId('direct-prompt-input');
        await expect(promptInput).toBeVisible({ timeout: 10_000 });
        await promptInput.fill('A cyberpunk character portrait');
        
        const generateBtn = page.getByTestId('direct-generate-btn');
        await expect(generateBtn).toBeEnabled({ timeout: 10_000 });
        await generateBtn.click();
        
        // Wait for generation to complete (mock takes ~2s)
        await page.waitForTimeout(3000);

        // 2. Open context controls in right panel
        await page.waitForFunction(() => (window as any).useStore !== undefined, { timeout: 15_000 });
        await page.evaluate(() => {
            (window as any).useStore.getState().setRightPanelTab('context');
        });
        await page.waitForTimeout(1000);

        const rightPanel = page.locator('[aria-label="Context panel"]');
        await expect(rightPanel).toBeVisible({ timeout: 10_000 });

        // 3. Select Video target media to reveal the Character Library panel
        const videoTargetBtn = rightPanel.getByTestId('target-media-video');
        await expect(videoTargetBtn).toBeVisible();
        await videoTargetBtn.click();

        // 4. Click Add Person in CharacterLibrary
        const addPersonBtn = rightPanel.getByRole('button', { name: 'Add Person' });
        await expect(addPersonBtn).toBeVisible({ timeout: 10_000 });
        await addPersonBtn.click();

        // 5. Wait for modal to open
        const modalTitle = page.getByText('ADD CHARACTER REFERENCE');
        await expect(modalTitle).toBeVisible({ timeout: 5000 });

        // 6. Select generated reference image directly via deterministic testid
        const generatedRef = page.getByTestId('generated-reference-0');
        await expect(generatedRef).toBeVisible({ timeout: 5000 });
        await generatedRef.click();

        // 7. Verify modal closes
        await expect(modalTitle).toHaveCount(0);
        
        // 8. Assert reference was added to the Character Library UI with default Subject/Face tag
        const characterLabel = rightPanel.getByText('Character 1');
        await expect(characterLabel).toBeVisible({ timeout: 5000 });

        const faceToggle = rightPanel.getByTestId('ref-type-face-0');
        await expect(faceToggle).toBeVisible();
        await expect(faceToggle).toHaveClass(/bg-blue-500/);

        // App remains stable
        await expect(page.getByTestId('app-container')).toBeVisible();
    });
});
