import { test, expect } from './fixtures/auth';

/**
 * Creative Studio Persistence E2E Tests
 *
 * Covers: creative module loading, canvas state within session,
 * navigation away and back (state preservation via creativeSlice),
 * and workspace mode transitions via CanvasModePicker.
 *
 * Run: npx playwright test e2e/creative-persistence.spec.ts
 */

test.describe('Creative Studio Persistence', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ authedPage: page }) => {
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
                                            // 1x1 transparent PNG base64
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

        await page.waitForSelector('[data-testid="app-container"]', { timeout: 30_000 });
    });

    test('creative module loads with full studio workspace and mode controls', async ({ authedPage: page }) => {
        const creativeNav = page.locator('[data-testid="nav-item-creative"]');
        if (await creativeNav.isVisible().catch(() => false)) {
            await creativeNav.click();
        } else {
            await page.evaluate(() => {
                const store = (window as any).useStore;
                if (store) store.getState().setModule('creative');
            });
        }

        const studioContainer = page.getByTestId('creative-studio-container');
        await expect(studioContainer).toBeVisible({ timeout: 30_000 });

        // Verify active mode picker and unified infinite canvas base layer
        await expect(page.getByTestId('canvas-mode-picker')).toBeVisible();
        await expect(page.getByTestId('canvas-mode-canvas')).toBeVisible();
        await expect(page.getByTestId('canvas-mode-video_production')).toBeVisible();
        await expect(page.getByTestId('infinite-canvas-surface')).toBeVisible();
    });

    test('navigating away from creative and back preserves studio state', async ({ authedPage: page }) => {
        // 1. Navigate to creative
        await page.evaluate(() => {
            const store = (window as any).useStore;
            if (store) store.getState().setModule('creative');
        });
        await expect(page.getByTestId('creative-studio-container')).toBeVisible({ timeout: 30_000 });

        // 2. Set distinct prompt state
        const testPrompt = 'Cyberpunk synthwave sunset album artwork';
        await page.evaluate((prompt) => {
            const store = (window as any).useStore;
            if (store) store.getState().setCreativePrompt(prompt);
        }, testPrompt);

        // 3. Navigate away to finance
        const financeNav = page.locator('[data-testid="nav-item-finance"]');
        if (await financeNav.isVisible().catch(() => false)) {
            await financeNav.click();
        } else {
            await page.evaluate(() => {
                const store = (window as any).useStore;
                if (store) store.getState().setModule('finance');
            });
        }
        await expect(page.getByTestId('creative-studio-container')).toHaveCount(0);

        // 4. Return to creative
        const creativeNav = page.locator('[data-testid="nav-item-creative"]');
        if (await creativeNav.isVisible().catch(() => false)) {
            await creativeNav.click();
        } else {
            await page.evaluate(() => {
                const store = (window as any).useStore;
                if (store) store.getState().setModule('creative');
            });
        }

        // 5. Assert studio re-mounted and preserved prompt state
        await expect(page.getByTestId('creative-studio-container')).toBeVisible({ timeout: 30_000 });
        const restoredPrompt = await page.evaluate(() => {
            return (window as any).useStore?.getState().creativePrompt;
        });
        expect(restoredPrompt).toBe(testPrompt);
    });

    test('canvas mode switcher transitions between image and video workspaces', async ({ authedPage: page }) => {
        await page.evaluate(() => {
            const store = (window as any).useStore;
            if (store) store.getState().setModule('creative');
        });
        await expect(page.getByTestId('creative-studio-container')).toBeVisible({ timeout: 30_000 });

        // 1. Switch to Video Studio
        const videoModeBtn = page.getByTestId('canvas-mode-video_production');
        await expect(videoModeBtn).toBeVisible();
        await videoModeBtn.click();

        // Verify Video Studio workspace overlay mounted and store updated
        await expect(page.getByTestId('video-workflow-workspace')).toBeVisible({ timeout: 15_000 });
        const videoState = await page.evaluate(() => {
            const s = (window as any).useStore?.getState();
            return { viewMode: s?.viewMode, generationMode: s?.generationMode };
        });
        expect(videoState.viewMode).toBe('video_production');
        expect(videoState.generationMode).toBe('video');

        // 2. Switch back to Image Studio
        const imageModeBtn = page.getByTestId('canvas-mode-canvas');
        await expect(imageModeBtn).toBeVisible();
        await imageModeBtn.click();

        // Verify Video overlay unmounted and Infinite Canvas is active
        await expect(page.getByTestId('video-workflow-workspace')).toHaveCount(0);
        await expect(page.getByTestId('infinite-canvas-surface')).toBeVisible();
        const imageState = await page.evaluate(() => {
            const s = (window as any).useStore?.getState();
            return { viewMode: s?.viewMode, generationMode: s?.generationMode };
        });
        expect(imageState.viewMode).toBe('canvas');
        expect(imageState.generationMode).toBe('image');
    });

    test('multiple module switches maintain DOM stability and store integrity', async ({ authedPage: page }) => {
        const modules = ['creative', 'finance', 'distribution', 'creative'] as const;

        for (const mod of modules) {
            await page.evaluate((target) => {
                const store = (window as any).useStore;
                if (store) store.getState().setModule(target);
            }, mod);

            if (mod === 'creative') {
                await expect(page.getByTestId('creative-studio-container')).toBeVisible({ timeout: 30_000 });
                await expect(page.getByTestId('canvas-mode-picker')).toBeVisible();
            } else {
                await expect(page.getByTestId('creative-studio-container')).toHaveCount(0);
            }
        }

        // Final verification on Creative module
        await expect(page.getByTestId('creative-studio-container')).toBeVisible();
        await expect(page.getByTestId('infinite-canvas-surface')).toBeVisible();
    });
});
