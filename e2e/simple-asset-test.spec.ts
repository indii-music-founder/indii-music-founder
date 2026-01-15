import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4242';

test.describe('Creative Director: Simple Asset Test', () => {

    test('Verify mock infrastructure works', async ({ page }) => {
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
        page.on('request', req => {
            if (req.url().includes('streamGenerateContent') || req.url().includes('generateImage')) {
                console.log(`[Network] ${req.method()} ${req.url()}`);
            }
        });

        // Mock AI responses
        await page.route(/streamGenerateContent/, async route => {
            console.log('[Mock] Intercepted streamGenerateContent');
            const toSSE = (data: any) => `data: ${JSON.stringify(data)}\r\n\r\n`;
            const response = toSSE({
                candidates: [{
                    content: {
                        role: 'model',
                        parts: [{ text: JSON.stringify({ final_response: "Test response" }) }]
                    }
                }]
            });
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: response
            });
        });

        // Navigate
        await page.goto(STUDIO_URL);

        // Wait for services
        await page.waitForFunction(() => {
            // @ts-expect-error - testing utility
            return window.useStore && window.subscriptionService;
        }, { timeout: 10000 });

        // Inject state
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
                viewMode: 'agent',
                organizations: [{ id: 'org-1', name: 'Test Org', plan: 'studio' }],
                currentOrganizationId: 'org-1',
                isAgentOpen: true
            });

            // @ts-expect-error - testing global
            if (window.subscriptionService) {
                // @ts-expect-error - testing override
                window.subscriptionService.canPerformAction = async () => ({ allowed: true });
            }

            // @ts-expect-error - testing global
            if (window.sessionService) {
                // @ts-expect-error - testing override
                window.sessionService.updateSession = async () => { };
            }
        });

        // Verify UI is ready
        const promptInput = page.getByPlaceholder(/Describe your task/i);
        await expect(promptInput).toBeVisible({ timeout: 10000 });

        // Send a simple message
        await promptInput.fill('Hello');
        const runButton = page.getByTestId('command-bar-run-btn');
        await expect(runButton).toBeEnabled();
        await runButton.click();

        // Wait for agent response
        await expect(page.locator('[data-testid="agent-message"]').last()).toBeVisible({ timeout: 10000 });

        console.log('[Test] Basic flow completed successfully');
    });
});
