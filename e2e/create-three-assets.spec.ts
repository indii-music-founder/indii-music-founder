import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4242';

test.describe('Creative Director: Asset Creation Loop', () => {

    test('User creates three assets via Creative Director', async ({ page }) => {
        // -----------------------------------------------------------------
        // 0. Environment Setup & Mocks
        // -----------------------------------------------------------------

        // Mock Electron & Auth state to bypass login screen
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

        // -----------------------------------------------------------------
        // 1. Mock AI Network Responses
        // -----------------------------------------------------------------

        // Mock the LLM stream response
        // We configure it to ALWAYS respond with a tool call to 'generate_image' when prompted
        await page.route(/streamGenerateContent/, async route => {
            console.log('[Mock] Intercepted AI Stream Request');
            const requestBody = JSON.parse(route.request().postData() || '{}');

            // Check if this is a "Function Response" (Turn 2) or "User Prompt" (Turn 1)
            // If the body contains "functionResponse", the agent has already called the tool and is summarizing.
            // If it doesn't, the agent needs to call the tool.

            const isFunctionResponse = JSON.stringify(requestBody).includes('functionResponse');

            const toSSE = (data: any) => `data: ${JSON.stringify(data)}\r\n\r\n`;
            let responseBody = '';

            if (isFunctionResponse) {
                // Turn 2: Summarize success
                responseBody = toSSE({
                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [{ text: JSON.stringify({ final_response: "I've created that asset for you." }) }]
                        }
                    }]
                });
            } else {
                // Turn 1: Call generate_image tool
                responseBody = toSSE({
                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [{
                                text: JSON.stringify({
                                    thought: "The user wants an asset. I will generate it.",
                                    tool: "generate_image",
                                    args: { prompt: "A test asset based on user request", count: 1 }
                                })
                            }]
                        }
                    }]
                });
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: responseBody
            });
        });

        // Mock the fallback non-streaming route just in case
        await page.route('**/generateContent', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        candidates: [{ content: { parts: [{ text: JSON.stringify({ final_response: "Mock Fallback" }) }] } }]
                    }
                })
            });
        });

        // -----------------------------------------------------------------
        // 2. Mock Image Generation Backend
        // -----------------------------------------------------------------

        let generationCount = 0;

        await page.route('**/generateImage**', async (route) => {
            generationCount++;
            console.log(`[Mock] Generating Image #${generationCount}`);

            // Return a simple 1x1 pixel image
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        images: [
                            {
                                bytesBase64Encoded: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                                mimeType: 'image/png'
                            }
                        ]
                    }
                })
            });
        });

        // Mock Storage Upload (The app uploads the generated image to storage)
        await page.route('**/*firebasestorage.googleapis.com/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    name: `generated/asset-${Date.now()}.png`,
                    bucket: 'test-bucket',
                    downloadTokens: 'mock-token',
                    contentType: 'image/png'
                })
            });
        });

        // -----------------------------------------------------------------
        // 3. Navigate & Bypass Auth
        // -----------------------------------------------------------------

        await page.goto(STUDIO_URL);

        // Wait for app to initialize and services to be exposed
        await page.waitForFunction(() => {
            // @ts-expect-error - testing utility
            return window.useStore && window.subscriptionService;
        }, { timeout: 10000 });

        // Inject verified user state and mock services
        await page.evaluate(() => {
            console.log('[Test] Injecting mock state and services...');

            // @ts-expect-error - testing utility
            window.useStore.setState({
                isAuthenticated: true,
                isAuthReady: true,
                authLoading: false,
                user: { uid: 'test-user', email: 'test@example.com', displayName: 'Test User' },
                userProfile: {
                    id: 'test-user',
                    bio: 'Verified Tester',
                    role: 'admin',
                    brandKit: {
                        referenceImages: [],
                        brandAssets: []
                    }
                },
                currentModule: 'creative',
                viewMode: 'agent',
                organizations: [{ id: 'org-1', name: 'Test Org', members: ['me'], plan: 'studio' }],
                currentOrganizationId: 'org-1',
                generatedHistory: [],
                isAgentOpen: true
            });

            // Mock Subscription Service
            // @ts-expect-error - testing global
            if (window.subscriptionService) {
                console.log('[Test] Mocking subscriptionService...');
                // @ts-expect-error - testing override
                window.subscriptionService.getCurrentSubscription = async () => ({
                    id: 'test-sub',
                    userId: 'test-user',
                    tier: 'studio',
                    status: 'active',
                    currentPeriodStart: Date.now(),
                    currentPeriodEnd: Date.now() + 10000000,
                    cancelAtPeriodEnd: false,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
                // @ts-expect-error - testing override
                window.subscriptionService.canPerformAction = async () => ({ allowed: true });
            }

            // Mock Session Service
            // @ts-expect-error - testing global
            if (window.sessionService) {
                console.log('[Test] Mocking sessionService...');
                // @ts-expect-error - testing override
                window.sessionService.updateSession = async () => { console.log('[Test] Mock updateSession'); };
                // @ts-expect-error - testing override
                window.sessionService.createSession = async () => 'mock-session-id';
                // @ts-expect-error - testing override
                window.sessionService.getSessionsForUser = async () => [];
            }

            console.log('[Test] Mock injection complete.');
        });

        // -----------------------------------------------------------------
        // 4. Verification Loop
        // -----------------------------------------------------------------

        // Locate input elements
        const promptInput = page.getByPlaceholder(/Describe your task/i);
        const runButton = page.getByTestId('command-bar-run-btn');

        // Loop to create 3 assets
        for (let i = 1; i <= 3; i++) {
            await test.step(`Create Asset #${i}`, async () => {
                const promptText = `Generate asset number ${i}`;
                console.log(`[Test] Entering prompt: ${promptText}`);

                // Ensure input is visible and fill
                await expect(promptInput).toBeVisible({ timeout: 10000 });
                await promptInput.fill(promptText);

                // Click Run
                await expect(runButton).toBeEnabled();
                await runButton.click();

                // Wait for the generation cycle to complete
                // We verify that the "generationCount" in our mock (tracked via page.evaluate or by effect)
                // However, since we can't easily read 'generationCount' from node context to browser context synced perfectly,
                // we'll check the UI state (Generated History).

                // Wait for the asset to appear in the history/store
                await expect.poll(async () => {
                    return await page.evaluate(() => {
                        // @ts-expect-error - testing utility
                        const history = window.useStore.getState().generatedHistory;
                        return history.length;
                    });
                }, { timeout: 15000 }).toBeGreaterThanOrEqual(i);

                console.log(`[Test] Asset #${i} verified in store.`);

                // Optional: Wait a beat to ensure UI reflects state before next iteration
                await page.waitForTimeout(500);
            });
        }

        console.log('[Test] Successfully created 3 assets.');
    });
});
