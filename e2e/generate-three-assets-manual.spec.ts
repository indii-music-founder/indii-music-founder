import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4242';

test.describe('Creative Director: Manual Asset Generation', () => {

    test('Generate 3 assets by directly calling generation function', async ({ page }) => {
        // Setup
        await page.addInitScript(() => {
            // @ts-expect-error - testing utility
            window.electronAPI = {
                getPlatform: async () => 'darwin',
                getAppVersion: async () => '0.0.0',
                auth: {
                    login: async () => { },
                    logout: async () => { },
                    onUserUpdate: () => () => { }
                },
                audio: { analyze: async () => ({}), getMetadata: async () => ({}) },
                openExternal: async () => { }
            };
            // @ts-expect-error - testing utility
            window.__TEST_MODE__ = true;
        });

        // Debug logging
        page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

        // Mock Image Generation Backend
        let generationCount = 0;
        await page.route('**/generateImageV3', async (route) => {
            generationCount++;
            console.log(`[Mock] Generating Image #${generationCount}`);

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        images: [{
                            bytesBase64Encoded: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                            mimeType: 'image/png'
                        }]
                    }
                })
            });
        });

        // Mock Firebase Storage
        await page.route('**/*firebasestorage.googleapis.com/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    name: `generated/asset-${Date.now()}.png`,
                    bucket: 'test-bucket'
                })
            });
        });

        // Navigate
        await page.goto(STUDIO_URL);

        // Wait for services to load
        await page.waitForFunction(() => {
            // @ts-expect-error - testing utility
            return window.useStore && window.subscriptionService;
        }, { timeout: 10000 });

        // Setup mock state
        await page.evaluate(() => {
            console.log('[Test] Setting up mock state...');

            // @ts-expect-error - testing utility
            window.useStore.setState({
                isAuthenticated: true,
                isAuthReady: true,
                authLoading: false,
                user: { uid: 'test-user', email: 'test@example.com' },
                userProfile: {
                    id: 'test-user',
                    brandKit: { referenceImages: [], brandAssets: [] }
                },
                currentModule: 'creative',
                viewMode: 'gallery',
                generationMode: 'image',
                organizations: [{ id: 'org-1', name: 'Test Org', plan: 'studio' }],
                currentOrganizationId: 'org-1',
                generatedHistory: [],
                isAgentOpen: false // We're not using the agent
            });

            // Mock subscription service
            // @ts-expect-error - testing global
            if (window.subscriptionService) {
                // @ts-expect-error - testing override
                window.subscriptionService.canPerformAction = async () => ({ allowed: true });
            }

            // Mock session service
            // @ts-expect-error - testing global
            if (window.sessionService) {
                // @ts-expect-error - testing override
                window.sessionService.updateSession = async () => { };
            }

            console.log('[Test] Mock state ready.');
        });

        // Debug: Take a screenshot to see what's on the page
        await page.screenshot({ path: 'test-results/debug-initial-state.png' });

        // Debug: Log the current module
        const currentModule = await page.evaluate(() => {
            // @ts-expect-error - testing utility
            return window.useStore?.getState().currentModule;
        });
        console.log(`[Test] Current module: ${currentModule}`);

        // Since we set currentModule to 'creative', it should already be there
        // Just wait for any content to be visible
        await page.waitForTimeout(3000);

        // Generate 3 assets by directly calling the generation function
        for (let i = 1; i <= 3; i++) {
            await test.step(`Generate Asset #${i}`, async () => {
                console.log(`[Test] Generating asset ${i}...`);

                // Directly trigger generation by setting pendingPrompt
                await page.evaluate((assetNum) => {
                    // @ts-expect-error - testing utility
                    const { setPendingPrompt } = window.useStore.getState();
                    setPendingPrompt(`Test asset number ${assetNum}`);
                }, i);

                // Wait for generation to complete by polling generatedHistory
                await expect.poll(async () => {
                    return await page.evaluate(() => {
                        // @ts-expect-error - testing utility
                        return window.useStore.getState().generatedHistory.length;
                    });
                }, {
                    timeout: 15000,
                    message: `Asset ${i} was not added to history`
                }).toBeGreaterThanOrEqual(i);

                console.log(`[Test] Asset #${i} generated successfully.`);

                // Small delay between generations
                await page.waitForTimeout(500);
            });
        }

        // Final verification
        const finalCount = await page.evaluate(() => {
            // @ts-expect-error - testing utility
            return window.useStore.getState().generatedHistory.length;
        });

        expect(finalCount).toBe(3);
        console.log(`[Test] ✅ Successfully generated ${finalCount} assets!`);

        // Take a screenshot showing the 3 assets
        await page.screenshot({
            path: 'test-results/three-assets-generated.png',
            fullPage: true
        });
    });
});
