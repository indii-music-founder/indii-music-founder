import { test, expect } from '@playwright/test';

test.describe('Pulse: Video Generation Loading State', () => {

    test.beforeEach(async ({ page }) => {
        // 1. Setup User & Store Injection
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Wait for store to be available
        await page.waitForFunction(() => !!(window as any).useStore);

        // Inject Mock User (Pulse Test User) to bypass Auth Login
        await page.evaluate(() => {
            (window as any).__TEST_MODE__ = true;

            const mockUser = {
                uid: 'pulse-test-user',
                email: 'pulse@example.com',
                displayName: 'Pulse Tester',
                emailVerified: true,
                isAnonymous: false,
                metadata: {},
                providerData: [],
                refreshToken: '',
                tenantId: null,
                delete: async () => { },
                getIdToken: async () => 'mock-token',
                getIdTokenResult: async () => ({ token: 'mock-token' } as any),
                reload: async () => { },
                toJSON: () => ({}),
                phoneNumber: null,
                photoURL: null
            };

            // Inject into Zustand Store
            // @ts-expect-error - Mocking partial store state
            window.useStore.setState({
                user: mockUser,
                authLoading: false,
                // We will navigate manually to ensure routing sync, but setting here helps initial state
                currentModule: 'video',
                userProfile: {
                    id: 'pulse-test-user',
                    tier: 'studio', // Ensure quota checks pass
                    preferences: { theme: 'dark' }
                }
            });

            // Mock Subscription Service to ensure quota checks pass without backend
            // We need to wait a tick for the service to be exposed if it relies on __TEST_MODE__
            setTimeout(() => {
                if ((window as any).subscriptionService) {
                    (window as any).subscriptionService.canPerformAction = async () => ({ allowed: true });
                    console.log('Pulse: Mocked subscriptionService.canPerformAction');
                } else {
                    console.warn('Pulse: subscriptionService not found on window even with TEST_MODE');
                }
            }, 100);
        });
    });

    test('should show "Imaginating Scene..." overlay during video generation request', async ({ page }) => {
        // 1. Navigate to Video Studio
        // Since we injected currentModule: 'video', the app should already be rendering Video Studio.
        // We assert this by checking the URL and content.
        await expect(page).toHaveURL(/.*\/video/);

        // Verify we are in Video Studio (check for Director's Chair empty state)
        await expect(page.getByText("Director's Chair")).toBeVisible();
        await expect(page.getByTestId('director-prompt-input')).toBeVisible();

        // 2. Setup Network Interception
        // We want to simulate a network delay when the app calls the Firebase Function `triggerVideoJob`.
        // The exact URL pattern depends on the environment, but it usually ends with the function name.
        let completeRequest: (value: unknown) => void;
        const requestPromise = new Promise((resolve) => {
            completeRequest = resolve;
        });

        // Use a broader pattern and handle potential OPTIONS requests
        await page.route('**/*triggerVideoJob*', async (route) => {
            console.log('💓 Pulse: Intercepted triggerVideoJob - Holding request to verify loader...');

            if (route.request().method() === 'OPTIONS') {
                await route.continue();
                return;
            }

            // Wait until we signal to complete
            await requestPromise;
            // Complete with a success response (mocking the return of { jobId })
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ result: { jobId: 'mock-job-id-123' } })
            });
            console.log('💓 Pulse: Released triggerVideoJob');
        });

        // 3. Enter Prompt
        await page.getByTestId('director-prompt-input').fill('A futuristic city with flying cars, cyberpunk style, neon rain');

        // 4. Click Generate
        const generateBtn = page.getByTestId('video-generate-btn');
        await expect(generateBtn).toBeEnabled();
        await generateBtn.click();

        // 5. ASSERT: Loading Overlay is Visible (IMMEDIATELY)
        // This is the "Pulse" check: Ensure the UI reacts instantly to the click.
        // The component text is "Imaginating Scene..."
        try {
            await expect(page.getByText('Imaginating Scene...')).toBeVisible({ timeout: 5000 });
            await expect(page.getByText('AI Director is rendering your vision')).toBeVisible();
        } catch (e) {
            // Debugging: Check for any error toasts that might have appeared instead
            const errorToasts = page.locator('div[role="status"], .toast-error, .text-destructive, [data-component="toast"]');
            const count = await errorToasts.count();
            if (count > 0) {
                const errors = await errorToasts.allTextContents();
                console.error('Pulse: Found error toasts instead of loader:', errors);
                throw new Error(`Expected loader but found error toasts: ${errors.join(', ')}`);
            }
            throw e;
        }

        // Also check button state if visible (it might be covered by overlay, but let's check accessibility)
        // The button changes text to "Action..." when generating.
        // Since overlay covers it, we might not be able to click it, but checking DOM presence is good.
        // await expect(page.getByText('Action...')).toBeVisible();

        // 6. Release the Network Request
        // This allows the app to proceed from 'queued' to 'processing' (or whatever the response triggers).
        if (completeRequest!) completeRequest(null);

        // 7. ASSERT: Overlay Persists
        // Because `generateVideo` returns an async job ID, the UI should remain in "Processing" state.
        // We verify it doesn't just disappear into a void.
        await page.waitForTimeout(500); // Allow React state update
        await expect(page.getByText('Imaginating Scene...')).toBeVisible();

        // Success! We verified the feedback loop from Idle -> Loading -> Processing.
    });

});
