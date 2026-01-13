import { test, expect } from '@playwright/test';

test.describe('Maestro Multi-Step Workflow: The "Campaign Launch" Flow', () => {

    /**
     * MAESTRO'S PHILOSOPHY VERIFICATION:
     * 1. "The Agent proposes; the User disposes." -> User rejects first plan, approves second.
     * 2. "A workflow without an approval gate is a runaway train." -> Explicit "Execute" click required.
     * 3. "Context is the baton." -> Data (Song Name) persists across steps.
     */

    test.beforeEach(async ({ page }) => {
        // -----------------------------------------------------------------------
        // 1. Setup & Auth Bypass (Mock User)
        // -----------------------------------------------------------------------
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Enable Mock Execution
        await page.evaluate(() => {
            (window as any).__MAESTRO_MOCK_EXECUTION__ = true;
        });

        // Wait for store to be available and mock the authenticated user
        await page.waitForFunction(() => !!(window as any).useStore);
        await page.evaluate(() => {
            const mockUser = {
                uid: 'maestro-user-id',
                email: 'maestro@example.com',
                displayName: 'Maestro Test User',
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

            // Inject user and force "campaign" module for direct access
            // @ts-expect-error - Mocking partial store state for test
            window.useStore.setState({
                initializeAuthListener: () => () => { },
                user: mockUser,
                authLoading: false,
                currentModule: 'campaign'
            });
        });
    });

    test('verifies the Agent-User Handoff with Rejection Loop and Resource Modification', async ({ page }) => {

        // ===========================================================================
        // STEP 1: PLANNING
        // "Maestro initializes the project context."
        // ===========================================================================

        const aiGenerateBtn = page.getByRole('button', { name: 'Generate with AI' }).first();
        await expect(aiGenerateBtn).toBeVisible();
        await aiGenerateBtn.click();

        // Verify Modal Open
        await expect(page.getByText('AI Campaign Generator')).toBeVisible();

        // Fill Context
        await page.getByPlaceholder(/e\.g\., New album/i).fill('Dogs Having Fun (Pop Genre)');

        // ===========================================================================
        // STEP 2: GENERATION (ROUND 1 - "BAD PLAN")
        // "The Agent proposes a plan that the user will reject."
        // ===========================================================================

        const badPlan = {
            title: 'Boring Campaign',
            description: 'A very dull campaign.',
            posts: [
                {
                    platform: 'Twitter',
                    day: 1,
                    copy: 'Buy my song.', // Too generic
                    imagePrompt: 'Grey box',
                    hashtags: ['#ad'],
                    bestTimeToPost: '9:00 AM'
                }
            ]
        };

        // Inject Bad Plan
        await page.evaluate((plan) => {
            // @ts-expect-error - injected by Playwright
            window.__MOCK_AI_PLAN__ = plan;
        }, badPlan);

        // Trigger Generation
        await page.getByRole('button', { name: 'Generate Campaign' }).click();

        // Verify "Bad Plan" is presented
        await expect(page.getByText('Boring Campaign')).toBeVisible();
        await expect(page.getByText('Buy my song.')).toBeVisible();

        // ===========================================================================
        // STEP 3: REJECTION (LOOP BACK)
        // "The User says 'No, try again'."
        // ===========================================================================

        // In this UI, "Try Again" is effectively clicking "Generate" again without clicking "Create".
        // The user stays in the modal and requests a new generation.

        const goodPlan = {
            title: 'Dogs Having Fun - Viral Launch',
            description: 'High energy campaign for the new pop hit.',
            posts: [
                {
                    platform: 'Instagram',
                    day: 1,
                    copy: 'Look at these puppers go! 🐶 #DogsHavingFun',
                    imagePrompt: 'Golden Retriever dancing in disco',
                    hashtags: ['#DogsHavingFun', '#PopMusic'],
                    bestTimeToPost: '12:00 PM'
                }
            ]
        };

        // Inject Good Plan
        await page.evaluate((plan) => {
            // @ts-expect-error - injected by Playwright
            window.__MOCK_AI_PLAN__ = plan;
        }, goodPlan);

        // Trigger Generation (Retry)
        // Note: The UI changes the button to "Regenerate" (with RefreshCw icon) and it sends the user back to the form
        // But in AIGenerateCampaignModal.tsx:
        // <button onClick={() => setGeneratedPlan(null)} ...>Regenerate</button>
        // This clears the plan and shows the form again.
        await page.getByRole('button', { name: 'Regenerate' }).click();

        // Now we are back at the form, we click "Generate Campaign" again
        await page.getByRole('button', { name: 'Generate Campaign' }).click();

        // Verify "Good Plan" is presented
        await expect(page.getByText('Dogs Having Fun - Viral Launch')).toBeVisible();
        await expect(page.getByText('Look at these puppers go!')).toBeVisible();

        // ===========================================================================
        // STEP 4: REVIEW (HANDOFF TO USER SPACE)
        // "The User accepts the proposal into their workspace."
        // ===========================================================================

        await page.getByRole('button', { name: 'Create Campaign' }).click();

        // Verify State Transition: PLANNING -> PENDING (In Detail View)
        // Wait for detail view
        await expect(page.getByRole('heading', { name: 'Dogs Having Fun - Viral Launch' })).toBeVisible({ timeout: 10000 });
        // Use a more specific selector to avoid strict mode violation (multiple "Pending" texts)
        await expect(page.getByText('Pending').first()).toBeVisible();

        // ===========================================================================
        // STEP 5: MODIFICATION (HUMAN-IN-THE-LOOP)
        // "The User tweaks the resource before execution."
        // ===========================================================================

        // Locate the edit button for the post
        // We added aria-label="Edit post" to CampaignDetail.tsx
        const editBtn = page.getByRole('button', { name: 'Edit post' }).first();
        await expect(editBtn).toBeVisible();
        await editBtn.click();

        // Verify Edit Modal
        const editModal = page.getByRole('dialog'); // Or container
        await expect(page.getByText('Edit Post for Day')).toBeVisible();

        // Change the copy
        const copyInput = page.getByPlaceholder('Write your post copy here...');
        await copyInput.fill('Look at these puppers go! 🐶 #DogsHavingFun #VerifiedByMaestro');

        // Save
        await page.getByRole('button', { name: 'Save Changes' }).click();

        // Verify Resource Handoff: The UI should now show the UPDATED copy
        await expect(page.getByText('#VerifiedByMaestro')).toBeVisible();

        // ===========================================================================
        // STEP 6: EXECUTION (APPROVAL GATE)
        // "The User gives the final Go signal."
        // ===========================================================================

        const executeBtn = page.getByRole('button', { name: 'Execute Campaign' });

        // Assert: Gate is closed (disabled) while processing? No, it should be enabled now.
        await expect(executeBtn).toBeEnabled();

        // Action: Open the Gate
        await executeBtn.click();

        // ===========================================================================
        // STEP 7: PUBLISHED (STATE TRANSITION)
        // "The Agent executes and reports back."
        // ===========================================================================

        // Verify State: EXECUTING -> DONE
        // The mock backend in CampaignManager simulates a delay then success.
        await expect(page.getByText('Processing...')).toBeVisible();

        // Wait for completion (toast or badge change)
        // Note: We check for the persistent badge "Done" first as toasts can be transient or flaky in CI
        await expect(page.getByText('Done', { exact: true })).toBeVisible({ timeout: 15000 });

        // Verify toast appeared (optional, but good for confirmation if visible)
        // await expect(page.getByText('All posts successfully executed!')).toBeVisible();

        // Verify Execute button is now disabled or changed
        // (Implementation detail: disabled if done)
        await expect(executeBtn).toBeDisabled();
    });
});
