import { test, expect } from '@playwright/test';

test.describe('Pulse: Merch AI Loading State', () => {

    test.beforeEach(async ({ page }) => {
        // 1. Setup User & Store Injection
        // We use the same pattern as merch-unified.spec.ts to bypass auth and load Merch Studio
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Wait for store to be available
        await page.waitForFunction(() => !!(window as any).useStore);

        // Inject Mock User (Pulse Test User) to bypass Auth Login
        await page.evaluate(() => {
            (window as any).__TEST_MODE__ = true;

            const mockUser = {
                uid: 'pulse-merch-user',
                email: 'pulse-merch@example.com',
                displayName: 'Pulse Merch Tester',
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

            const mockProfile = {
                id: 'pulse-merch-user',
                displayName: 'Pulse Merch Tester',
                roles: ['owner'],
                orgId: 'test-org-merch',
                tier: 'studio', // Ensure quota checks pass
                preferences: { theme: 'dark' }
            };

            // Inject into Zustand Store
            // @ts-expect-error - Mocking partial store state
            window.useStore.setState({
                user: mockUser,
                userProfile: mockProfile,
                authLoading: false,
                currentModule: 'merch' // Direct navigation to Merch
            });

            // Mock Subscription Service to ensure quota checks pass without backend
            setTimeout(() => {
                if ((window as any).subscriptionService) {
                    (window as any).subscriptionService.canPerformAction = async () => ({ allowed: true });
                }
            }, 100);
        });
    });

    test('should show "Generating..." spinner and toast during AI image generation', async ({ page }) => {
        // 1. Navigate to Merch Designer
        // Since we set currentModule: 'merch', we should be at dashboard.
        // We need to click "New Design" or navigate to /merch/design

        // Wait for dashboard or redirect
        await expect(page).toHaveURL(/.*\/merch/);

        // Click "New Design" if we are on dashboard
        const newDesignBtn = page.getByTestId('new-design-btn');
        await expect(newDesignBtn).toBeVisible({ timeout: 10000 });
        await newDesignBtn.click();

        // Verify we are in Designer
        await expect(page.getByTestId('mode-design-btn')).toBeVisible({ timeout: 10000 });

        // 2. Open AI Generation Dialog
        const aiGenBtn = page.getByRole('button', { name: 'AI Gen' });
        await expect(aiGenBtn).toBeVisible();
        await aiGenBtn.click();

        // Verify Dialog is open
        await expect(page.getByText('AI Image Generation')).toBeVisible();

        // 3. Setup Network Interception
        // We want to simulate a network delay when the app calls the Firebase Function `generateImageV3`
        let completeRequest: (value: unknown) => void;
        const requestPromise = new Promise((resolve) => {
            completeRequest = resolve;
        });

        await page.route('**/*generateImageV3*', async (route) => {
            console.log('💓 Pulse: Intercepted generateImageV3 - Holding request...');

            if (route.request().method() === 'OPTIONS') {
                await route.continue();
                return;
            }

            // Wait until we signal to complete
            await requestPromise;

            // Return success response structure (matches ImageGenerationService expectation)
            // { data: { images: [{ bytesBase64Encoded: "...", mimeType: "image/png" }] } }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        images: [{
                            bytesBase64Encoded: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', // 1x1 red pixel
                            mimeType: 'image/png'
                        }]
                    }
                })
            });
            console.log('💓 Pulse: Released generateImageV3');
        });

        // 4. Enter Prompt
        const promptInput = page.locator('#prompt-input');
        await promptInput.fill('A cyberpunk neon logo');

        // 5. Click Generate
        const generateBtn = page.getByRole('button', { name: 'Generate', exact: true });
        await expect(generateBtn).toBeEnabled();
        await generateBtn.click();

        // 6. ASSERT: Loading State (IMMEDIATELY)
        // Verify Button State
        await expect(page.getByRole('button', { name: 'Generating...' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Generating...' })).toBeDisabled();

        // Verify Toast (if possible - toasts can be tricky if they animate in/out fast, but loading toasts usually persist)
        // We look for text that contains "Generating image with AI..."
        await expect(page.getByText('Generating image with AI...')).toBeVisible();

        // 7. Release the Network Request
        if (completeRequest!) completeRequest(null);

        // 8. ASSERT: Success State
        // Button should go back to "Generate" (or dialog closes)
        // The code says: "toast.success('Image generated successfully!'); onClose();"
        // So the dialog should disappear.

        await expect(page.getByText('Image generated successfully!')).toBeVisible();

        // Dialog should close
        await expect(page.getByText('AI Image Generation')).not.toBeVisible();

        // Verify image was added to canvas (optional, but good for completeness)
        // This relies on canvas implementation, but checking for toast is the main pulse check.
    });

});
