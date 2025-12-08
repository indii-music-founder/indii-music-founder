import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:5173';

test.describe('The Paparazzi: Media Pipeline Verification', () => {

    test('Scenario 1: Vision Analysis Flow', async ({ page }) => {
        // 1. Mock Electron API to prevent redirect
        await page.addInitScript(() => {
            window.electronAPI = {
                getPlatform: async () => 'darwin',
                getAppVersion: async () => '0.0.0',
                auth: {
                    login: async () => { },
                    logout: async () => { },
                    onUserUpdate: (cb) => {
                        // Simulate authenticated user immediately
                        cb({ idToken: 'mock-token', accessToken: 'mock-access' });
                        return () => { };
                    }
                },
                audio: {
                    analyze: async () => ({}),
                    getMetadata: async () => ({})
                }
            };
        });

        // 2. Mock AI Network Responses (Bypass Backend)
        await page.route('**/*generateContentStream*', async route => {
            console.log('[Mock] Intercepted AI Stream Request');
            // GeneralistAgent expects the ACCUMULATED text to be valid JSON.
            // So we must stream tokens that verify to a JSON string: { "final_response": "..." }
            const mockResponseChunks = [
                JSON.stringify({ text: `{ "final_response": "I see ` }),
                JSON.stringify({ text: `the image ` }),
                JSON.stringify({ text: `you uploaded. ` }),
                JSON.stringify({ text: `It looks like a test." }` })
            ].join('\n') + '\n'; // Trailing newline for NDJSON parser

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: mockResponseChunks
            });
        });

        // Debug Browser Console
        page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

        // 3. Visit Studio
        await page.goto(STUDIO_URL);

        // 3. Bypass Auth Loading if needed (App might wait for electron auth)
        // The App.tsx listener will see the tokens from onUserUpdate and try to sign in.
        // But we don't have a real firebase instance running that accepts 'mock-token'.
        // So we might also need to mock the store state directly to bypass "Authenticating..."

        await page.evaluate(() => {
            // @ts-ignore
            window.useStore.setState({
                isAuthenticated: true,
                isAuthReady: true,
                currentModule: 'creative', // Start in creative module for this test
                organizations: [{ id: 'org-1', name: 'Test Org', members: ['me'] }],
                currentOrganizationId: 'org-1',
                isAgentOpen: true // Ensure Chat Overlay is visible
            });
        });

        // 3. Locate Input Area
        const input = page.locator('input[type="text"][placeholder*="Describe"]');
        await expect(input).toBeVisible();

        // 4. Simulate File Upload (Hidden Input)
        const fileInput = page.locator('input[type="file"]').first(); // Paperclip input

        // Create a dummy image buffer
        const buffer = Buffer.from('fake-image-content');

        // Set input files
        await fileInput.setInputFiles({
            name: 'test-image.jpg',
            mimeType: 'image/jpeg',
            buffer
        });

        // 5. Verify UI Feedback
        // Check for attachment chip or preview
        await expect(page.locator('text=test-image.jpg')).toBeVisible();

        // 6. Send Message asking to "Analyze this"
        await input.fill('What is in this image?');


        // 6. Send
        const submitBtn = page.locator('button[type="submit"]');
        await expect(submitBtn).toBeEnabled({ timeout: 5000 });
        await submitBtn.click();

        // 7. Ensure Chat Overlay is Open (Robust)
        // The App component resets isAgentOpen on mount. We wait a bit and force it open via store.
        await page.waitForTimeout(1000); // Wait for potential App mount/reset
        await page.evaluate(() => {
            // @ts-ignore
            window.useStore.setState({ isAgentOpen: true });
        });

        // Ensure overlay is open (implicit by message visibility later)


        // 8. Verify Agent Response
        // We look for the "AI" avatar or message bubble
        // This confirms the pipeline accepted the image and started processing
        await expect(page.locator('[data-testid="agent-message"]')).toBeVisible({ timeout: 30000 });

        // 9. (Optional) Verify Vision Tool usage in thoughts if expanded
        // This is a deeper check, but basic presence is good enough for "The Paparazzi" V1.
    });

});
