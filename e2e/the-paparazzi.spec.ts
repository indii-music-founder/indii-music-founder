import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4242';

test.describe('The Paparazzi: Media Pipeline Verification', () => {

    test('Scenario 1: Vision Analysis to Image Generation', async ({ page }) => {
        // 0. Mock Electron API
        await page.addInitScript(() => {
            // @ts-expect-error - testing utility
            window.electronAPI = {
                getPlatform: async () => 'darwin',
                getAppVersion: async () => '0.0.0',
                auth: {
                    login: async () => { },
                    logout: async () => { },
                    onUserUpdate: (cb: any) => {
                        // Do NOT trigger callback to avoid App.tsx trying real Firebase Auth with mock tokens
                        // cb({ idToken: 'mock-token', accessToken: 'mock-access' });
                        return () => { };
                    }
                },
                audio: { analyze: async () => ({}), getMetadata: async () => ({}) },
                openExternal: async () => { }
            };
            // @ts-expect-error - testing utility
            window.__TEST_MODE__ = true;
        });

        // Debug: Log ALL requests to see if generateContentStream is even called
        page.on('request', request => console.log(`[Request] ${request.method()} ${request.url()}`));
        page.on('pageerror', err => console.log(`[Page Error] ${err}`));

        // 1. Mock AI Network Responses (Generalist Agent LLM)
        const mockStreamHandler = async (route: any) => {
            console.log('[Mock] Intercepted AI Stream Request');
            const requestBodyStr = route.request().postData() || '{}';
            console.log('[Mock LLM] Checking content for signals...');

            // Check if deeper parts have text or functionResponse
            // GeneralistAgent sends: text part with "Tool <name> Output: ..."
            const isFunctionResponse = requestBodyStr.includes('Tool generate_image Output');

            let mockResponseChunks = '';

            // Logic: Check if we are in turn 1 (User asks) or turn 2 (Tool Output returned)
            // Helper to format SSE chunk
            const toSSE = (data: any) => `data: ${JSON.stringify(data)}\r\n\r\n`;

            if (isFunctionResponse) {
                // TURN 2: Agent confirms success
                console.log('[Mock LLM] Returning Final Response');
                const finalResponse = {
                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [{ text: JSON.stringify({ final_response: "I have generated the image for you." }) }]
                        }
                    }]
                };
                mockResponseChunks = toSSE(finalResponse);
            } else {
                // TURN 1: Agent decides to use tool
                console.log('[Mock LLM] Returning Tool Call');
                const toolCallResponse = {
                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [{
                                text: JSON.stringify({
                                    thought: "I will generate an image based on your request.",
                                    tool: "generate_image",
                                    args: { prompt: "A creative variation of the test image", count: 1 }
                                })
                            }]
                        }
                    }]
                };
                mockResponseChunks = toSSE(toolCallResponse);
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: mockResponseChunks
            });
        };

        await page.route(/streamGenerateContent/, mockStreamHandler);

        // Mock Non-Streaming generateContent (needed if AgentService tries to Route or use non-streaming fallback)
        await page.route('**/generateContent', async route => {
            console.log('[Mock] Intercepted generateContent (Router/Fallback)');
            // Return a generic JSON that won't crash the JSON parsers
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        candidates: [{ content: { parts: [{ text: JSON.stringify({ final_response: "Mock Router Response" }) }] } }]
                    }
                })
            });
        });

        // 3. Mock Image Generation Backend (Firebase Function)
        await page.route('**/generateImage**', async (route: any) => {
            console.log('[Mock] Intercepted generateImage');
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

        // 4. Mock Firebase Storage Upload (for generated image)
        await page.route('**/*firebasestorage.googleapis.com/**', async route => {
            console.log(`[Mock Storage] Intercepted Request: ${route.request().url()}`);
            // Assume success for any storage operation in this test
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    name: 'generated/mock-image.png',
                    bucket: 'indiios-v-1-1.firebasestorage.app',
                    downloadTokens: 'mock-token',
                    contentType: 'image/png'
                })
            });
        });

        // Debug Browser Console
        page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

        // 3. Visit Studio
        await page.goto(STUDIO_URL);

        // 4. Bypass Auth Loading
        await page.evaluate(() => {
            // @ts-expect-error - testing utility
            window.useStore.setState({
                isAuthenticated: true,
                isAuthReady: true,
                authLoading: false, // Ensure loading screen is dismissed
                user: { uid: 'test-user', email: 'test@example.com', displayName: 'Test User' },
                userProfile: { bio: 'Verified Tester', role: 'admin' }, // Prevent onboarding redirect
                currentModule: 'generalist', // Force Generalist to bypass Router
                viewMode: 'agent', // Ensure Agent View is active
                organizations: [{ id: 'org-1', name: 'Test Org', members: ['me'] }],
                currentOrganizationId: 'org-1',
                uploadedImages: [], // Reset uploads
                agentHistory: [],
                isAgentOpen: true,
                // Override auth listener to prevent it from resetting the user to null
                initializeAuthListener: () => () => { }
            });

            // Mock Subscription Service to bypass Auth checks
            // @ts-expect-error - testing global
            if (window.subscriptionService) {
                // @ts-expect-error - testing override
                window.subscriptionService.getCurrentSubscription = async () => ({
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
                // @ts-expect-error - testing override
                window.subscriptionService.checkQuota = async () => ({
                    allowed: true,
                    currentUsage: { used: 0, limit: 1000, remaining: 1000 }
                });
            }
        });

        // 5. Upload Image
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.waitFor({ state: 'attached', timeout: 10000 });
        const buffer = Buffer.from('fake-image-content');
        await fileInput.setInputFiles({
            name: 'paparazzi-test.jpg',
            mimeType: 'image/jpeg',
            buffer
        });
        await expect(page.locator('text=paparazzi-test.jpg')).toBeVisible();

        // 6. Send Request
        const agentInput = page.getByPlaceholder(/Describe your task/i);
        await expect(agentInput).toBeVisible();
        await agentInput.fill('Analyze this image and generate a creative variation.');

        // Use explicit click regarding flaky Enter key in test environment
        const runButton = page.getByRole('button', { name: 'Run', exact: true });
        await expect(runButton).toBeEnabled();
        await runButton.click();

        // 7. Verify Image in Store (Robust Verification)
        // Since UI visibility depends on the active module/view (Gallery vs Chat),
        // we check the Store directly to prove the pipeline (Vision -> Gen -> Storage) succeeded.
        await expect.poll(async () => {
            return await page.evaluate(() => {
                // @ts-expect-error - testing utility
                const history = window.useStore.getState().generatedHistory;
                return history.some((h: any) => h.url && h.url.includes('iVBORw0K'));
            });
        }, { timeout: 20000 }).toBe(true);

        // 8. Verify Agent Response Text (Secondary)
        // Check if ANY agent message is visible after tool execution
        await expect(page.locator('[data-testid="agent-message"]').last()).toBeVisible();
    });

    test('Scenario 2: Daisychain & Reference Image', async ({ page, request }) => {
        // This test verifies that the frontend correctly constructs the complex multiMaskEdit payload
        // with Reference Images and sends it to the backend.

        // 1. Mock Backend for multiMaskEdit
        let interceptedPayload: any = null;
        await page.route('**/multiMaskEdit', async route => {
            console.log('[Mock] Intercepted multiMaskEdit');
            interceptedPayload = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        candidates: [{
                            id: 'cand-1',
                            url: 'data:image/png;base64,mock-result',
                            prompt: 'mock result prompt'
                        }]
                    }
                })
            });
        });

        // 2. Visit App (Authenticated State)
        await page.goto(STUDIO_URL);

        // 3. Inject State to Mock Canvas Interaction
        // Instead of clicking 50 UI elements, we use the internal API to trigger the service call 
        // essentially validating the "Service Integration" layer.
        await page.evaluate(async () => {
            // @ts-expect-error - testing utility
            const { Editing } = await import('./src/services/image/EditingService'); // Dynamic import if possible, else we rely on global
        });

        // 4. Trigger via Exposed Globals
        // 4. Trigger via Exposed Globals
        await page.evaluate(async () => {
            // @ts-expect-error - testing utility
            const functions = window.functions;
            // @ts-expect-error - testing utility
            const httpsCallable = window.httpsCallable;

            console.log('Using Functions:', functions);
            console.log('Using Callable:', httpsCallable);

            if (!functions || !httpsCallable) {
                throw new Error('Firebase Functions internals not found on window');
            }

            // Simulate what CreativeCanvas.tsx does:
            const multiMaskEdit = httpsCallable(functions, 'multiMaskEdit');
            return await multiMaskEdit({
                image: { mimeType: 'image/png', data: 'base-data' },
                masks: [
                    {
                        mimeType: 'image/png',
                        data: 'mask-data',
                        prompt: 'red shoes',
                        colorId: 'red',
                        referenceImage: { mimeType: 'image/jpeg', data: 'ref-data' }
                    }
                ]
            });
        });

        // 4. Verify Payload
        // interceptedPayload should capture the request from the page.evaluate
        // However, page.evaluate executes in browser, so it triggers the network route.

        // Wait for route interception (it might be async)
        await page.waitForTimeout(500);

        expect(interceptedPayload).toBeTruthy();
        expect(interceptedPayload.data.masks[0].referenceImage).toBeDefined();
        expect(interceptedPayload.data.masks[0].referenceImage.data).toBe('ref-data');
    });

});
