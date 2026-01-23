import { test, expect } from '@playwright/test';

test.describe('Pulse: Merch AI Error Handling', () => {

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
        });
    });

    test('should show error toast and enable retry when AI generation fails', async ({ page }) => {
        // 1. Navigate to Merch Designer
        await expect(page).toHaveURL(/.*\/merch/);

        // Click "New Design" if we are on dashboard
        const newDesignBtn = page.getByTestId('new-design-btn');
        // Wait for dashboard to load explicitly
        await expect(newDesignBtn).toBeVisible({ timeout: 20000 });
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

        // Mock Subscription Quota Checks (Pass)
        await page.route('**/*getSubscription*', async (route) => {
             if (route.request().method() === 'OPTIONS') { await route.continue(); return; }
             await route.fulfill({
                 status: 200,
                 contentType: 'application/json',
                 body: JSON.stringify({
                     data: {
                        id: 'sub-123',
                        userId: 'pulse-merch-user',
                        tier: 'studio',
                        status: 'active',
                        currentPeriodStart: Date.now(),
                        currentPeriodEnd: Date.now() + 86400000,
                        cancelAtPeriodEnd: false,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                     }
                 })
             });
        });

        await page.route('**/*getUsageStats*', async (route) => {
             if (route.request().method() === 'OPTIONS') { await route.continue(); return; }
             await route.fulfill({
                 status: 200,
                 contentType: 'application/json',
                 body: JSON.stringify({
                     data: {
                        tier: 'studio',
                        resetDate: Date.now() + 86400000,
                        imagesGenerated: 0,
                        imagesRemaining: 9999,
                        imagesPerMonth: 9999,
                        videoDurationSeconds: 0,
                        videoDurationMinutes: 0,
                        videoRemainingMinutes: 9999,
                        videoTotalMinutes: 9999,
                        aiChatTokensUsed: 0,
                        aiChatTokensRemaining: 9999,
                        aiChatTokensPerMonth: 9999,
                        storageUsedGB: 0,
                        storageRemainingGB: 9999,
                        storageTotalGB: 9999,
                        projectsCreated: 0,
                        projectsRemaining: 9999,
                        maxProjects: 9999,
                        teamMembersUsed: 0,
                        teamMembersRemaining: 9999,
                        maxTeamMembers: 9999
                     }
                 })
             });
        });

        // Mock Generation Failure
        let failRequest: (value: unknown) => void;
        const requestPromise = new Promise((resolve) => {
            failRequest = resolve;
        });

        await page.route('**/*generateImageV3*', async (route) => {
            console.log('💓 Pulse: Intercepted generateImageV3 - Holding request for error test...');

            if (route.request().method() === 'OPTIONS') {
                await route.continue();
                return;
            }

            // Wait until we signal to complete (so we can see the loading state)
            await requestPromise;

            // Return 500 Error
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: {
                        message: "Simulated AI Overload",
                        status: "INTERNAL"
                    }
                })
            });
            console.log('💓 Pulse: Released generateImageV3 with 500 Error');
        });

        // 4. Enter Prompt
        const promptInput = page.locator('#prompt-input');
        await promptInput.fill('A glitchy chaos symbol');

        // 5. Click Generate
        const generateBtn = page.getByRole('button', { name: 'Generate', exact: true });
        await expect(generateBtn).toBeEnabled();
        await generateBtn.click();

        // 6. ASSERT: Loading State (IMMEDIATELY)
        // Button should show "Generating..."
        // Use regex for robustness in case of whitespace
        await expect(page.getByRole('button', { name: /Generating/i })).toBeVisible({ timeout: 5000 });
        await expect(page.getByRole('button', { name: /Generating/i })).toBeDisabled();

        // Toast should show "Generating image with AI..."
        await expect(page.getByText('Generating image with AI...')).toBeVisible();

        // 7. Release the Network Request (Trigger Failure)
        if (failRequest!) failRequest(null);

        // 8. ASSERT: Error Feedback
        // Look for the error message in a toast
        await expect(page.getByText('Generation failed')).toBeVisible();

        // 9. ASSERT: Recovery
        // The "Generate" button should be back to normal (not "Generating...")
        await expect(page.getByRole('button', { name: 'Generate', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Generate', exact: true })).toBeEnabled();

        // The dialog should still be open (user can retry)
        await expect(page.getByText('AI Image Generation')).toBeVisible();
    });

});
