import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// TYPES (Mirrored from src/modules/marketing/types.ts for Data Integrity)
// ---------------------------------------------------------------------------

type CampaignStatus = 'PENDING' | 'EXECUTING' | 'DONE' | 'FAILED';

interface ImageAsset {
    assetType: 'image';
    title: string;
    imageUrl: string;
    caption: string;
}

interface ScheduledPost {
    id: string;
    platform: 'Twitter' | 'Instagram' | 'LinkedIn';
    copy: string;
    imageAsset: ImageAsset;
    day: number;
    status: CampaignStatus;
}

interface GeneratedPostContent {
    platform: 'Twitter' | 'Instagram' | 'LinkedIn';
    day: number;
    copy: string;
    imagePrompt: string;
    hashtags: string[];
    bestTimeToPost?: string;
}

interface GeneratedCampaignPlan {
    title: string;
    description: string;
    posts: GeneratedPostContent[];
}

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------

test.describe('Maestro: Campaign Handoff Workflow', () => {

    // Workflow can take time due to mocks and multiple steps
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // 1. Setup & Auth Bypass
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Wait for store to be available
        await page.waitForFunction(() => !!(window as any).useStore);

        // Mock User & State
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

            // Inject user and set module to 'campaign' (Marketing)
            // @ts-expect-error - Mocking partial store state
            window.useStore.setState({
                user: mockUser,
                userProfile: { id: 'maestro-user-id', displayName: 'Maestro' }, // needed for MarketingService
                authLoading: false,
                currentModule: 'campaign', // Force navigation to Marketing
            });

            // Mock MarketingService.createCampaign to avoid Firestore
            (window as any).__MOCK_MARKETING_SERVICE_CREATE__ = true;
        });

        // Abort Firestore requests to prevent hanging and force error handler (which stops loading)
        await page.route('**/firestore.googleapis.com/**', route => route.abort());
    });

    test('should execute "Dogs Having Fun" workflow: Plan -> Reject -> Approve -> Execute -> Verify', async ({ page }) => {

        // -----------------------------------------------------------------------
        // PHASE 1: Agent Proposes & User Rejects (The "No" Path)
        // -----------------------------------------------------------------------

        // Monitor console for debugging
        page.on('console', msg => {
            if (msg.type() === 'error') console.log(`[Browser Error]: ${msg.text()}`);
        });

        // Wait for loader to disappear (in case Firestore timeout takes a moment)
        await expect(page.getByTestId('marketing-dashboard-loader')).toBeHidden({ timeout: 15000 });

        // Wait for "Generate with AI" button (in CampaignList)
        // Use a more specific selector if possible to ensure we target the button
        await expect(page.getByText('Generate with AI').first()).toBeVisible({ timeout: 10000 });
        const generateBtn = page.getByText('Generate with AI').first();

        // Click Generate
        await generateBtn.click();
        await expect(page.getByText('AI Campaign Generator')).toBeVisible();

        // Hide chat overlay if present
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('.fixed.bottom-8.z-\\[500\\]');
            overlays.forEach((el) => { (el as HTMLElement).style.display = 'none'; });
        });

        // Mock Bad Plan
        const badPlan: GeneratedCampaignPlan = {
            title: 'Boring Campaign',
            description: 'A bad idea',
            posts: [{
                platform: 'Twitter',
                day: 1,
                copy: 'Boring tweet',
                imagePrompt: 'Grey wall',
                hashtags: ['#boring'],
            }]
        };

        // Inject Bad Plan
        await page.evaluate((plan) => {
            (window as any).__MOCK_AI_PLAN__ = plan;
        }, badPlan);

        // Fill form basics to enable button
        await page.getByPlaceholder(/e\.g\., New album/i).fill('Bad Idea');
        await page.getByRole('button', { name: 'Generate Campaign' }).click();

        // Verify Bad Plan displayed
        await expect(page.getByText('Boring Campaign')).toBeVisible();

        // Reject (Close/Cancel)
        await page.getByRole('button', { name: 'Regenerate' }).click();
        // Or close and reopen. Let's use "Regenerate" implies "Try Again".
        // The modal has "Regenerate" button which calls `setGeneratedPlan(null)`.
        await expect(page.getByText('Generate Campaign')).toBeVisible(); // Back to form

        // -----------------------------------------------------------------------
        // PHASE 2: Agent Proposes & User Approves (Step 1: Plan Approval)
        // -----------------------------------------------------------------------

        // Mock Good Plan (Dogs Having Fun)
        const goodPlan: GeneratedCampaignPlan = {
            title: 'Dogs Having Fun',
            description: 'Viral campaign for the new hit song.',
            posts: [
                {
                    platform: 'Instagram',
                    day: 1,
                    copy: 'Check out the new video! #DogsHavingFun',
                    imagePrompt: 'Dogs partying on a beach',
                    hashtags: ['#DogsHavingFun', '#Viral'],
                    bestTimeToPost: '12:00 PM'
                }
            ]
        };

        // Inject Good Plan
        await page.evaluate((plan) => {
            (window as any).__MOCK_AI_PLAN__ = plan;
        }, goodPlan);

        // Generate again
        await page.getByRole('button', { name: 'Generate Campaign' }).click();

        // Verify Good Plan
        await expect(page.getByText('Dogs Having Fun')).toBeVisible();
        await expect(page.getByText('Check out the new video! #DogsHavingFun')).toBeVisible();

        // Approve (Create Campaign)
        // We need to mock the `MarketingService.createCampaign` network call or handle the error if it fails.
        // Since we can't easily mock the internal service method, we'll spy on the Dashboard state update if possible.
        // Or better: The test injects the campaign directly into the dashboard state using the hook found in `CampaignDashboard.tsx`.
        // `window.addEventListener('TEST_INJECT_CAMPAIGN_UPDATE', ...)`
        // But `createCampaign` is called inside `handleAISave`.

        // Click Create (simulates User Approval)
        await page.getByRole('button', { name: 'Create Campaign' }).click();

        // Wait for Modal to close (it closes even if save fails in catch block, or if success)
        await expect(page.getByText('AI Campaign Generator')).toBeHidden();

        // INJECT CAMPAIGN to simulate successful creation and selection (since we aborted Firestore)
        const campaignAsset = {
            id: 'mock-campaign-id',
            assetType: 'campaign',
            title: goodPlan.title,
            description: goodPlan.description,
            durationDays: 7,
            startDate: new Date().toISOString(),
            status: 'PENDING',
            posts: goodPlan.posts.map((p, i) => ({
                id: `post-${i}`,
                platform: p.platform,
                copy: p.copy,
                day: p.day,
                imageAsset: {
                    assetType: 'image',
                    title: 'Generated Image',
                    imageUrl: '', // No image yet
                    caption: p.imagePrompt
                },
                status: 'PENDING'
            }))
        };

        await page.evaluate((campaign) => {
            window.dispatchEvent(new CustomEvent('TEST_INJECT_SET_CAMPAIGN', {
                detail: { campaign }
            }));
        }, campaignAsset);

        // Verify we are in Detail View
        // The `CampaignDashboard` selects the new campaign via the injection
        await expect(page.getByRole('heading', { name: 'Dogs Having Fun' })).toBeVisible({ timeout: 10000 });

        // ASSERT STATE: PLANNING/PENDING
        await expect(page.getByTestId('campaign-status-badge')).toHaveText(/PENDING/i);

        // -----------------------------------------------------------------------
        // PHASE 3: Execution Handoff (Step 2: Execution Approval)
        // -----------------------------------------------------------------------

        // Prepare Execution Mock
        // "Check Resource Handoff": We verify the `imageUrl` is passed correctly.
        const resourceUrl = 'https://example.com/generated-dog.jpg';

        await page.route('**/functions/executeCampaign', async route => {
             await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        success: true,
                        message: 'Campaign executed successfully!',
                        posts: goodPlan.posts.map((p, i) => ({
                            id: `post-${i}`,
                            platform: p.platform,
                            copy: p.copy,
                            day: p.day,
                            imageAsset: {
                                assetType: 'image',
                                title: 'Generated Image',
                                imageUrl: resourceUrl, // <-- THE HANDOFF
                                caption: p.imagePrompt
                            },
                            status: 'DONE'
                        }))
                    }
                })
            });
        });

        // Also mock the generic `**/executeCampaign` just in case the path varies
        await page.route('**/executeCampaign', async route => {
             // fallback if the above doesn't catch
             await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        success: true,
                        message: 'Campaign executed successfully!',
                        posts: goodPlan.posts.map((p, i) => ({
                            id: `post-${i}`,
                            platform: p.platform,
                            copy: p.copy,
                            day: p.day,
                            imageAsset: {
                                assetType: 'image',
                                title: 'Generated Image',
                                imageUrl: resourceUrl,
                                caption: p.imagePrompt
                            },
                            status: 'DONE'
                        }))
                    }
                })
            });
        });

        // Click Execute
        const executeBtn = page.getByRole('button', { name: 'Execute Campaign' });
        await expect(executeBtn).toBeVisible();
        await executeBtn.click();

        // Verify Processing
        await expect(page.getByText('Processing...')).toBeVisible();

        // -----------------------------------------------------------------------
        // PHASE 4: Completion & Resource Handoff Verification
        // -----------------------------------------------------------------------

        // Wait for success toast/message
        await expect(page.getByText('Campaign executed successfully!')).toBeVisible({ timeout: 15000 });

        // ASSERT STATE: PUBLISHED/DONE
        await expect(page.getByTestId('campaign-status-badge')).toHaveText(/DONE/i);

        // VERIFY RESOURCE HANDOFF (The Image URL)
        // Check that the image with the mock URL is rendered
        await expect(page.locator(`img[src="${resourceUrl}"]`)).toBeVisible();

        // Verify context/copy is preserved
        await expect(page.getByText('Check out the new video! #DogsHavingFun')).toBeVisible();

    });
});
