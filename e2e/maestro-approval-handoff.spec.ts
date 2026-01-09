
import { test, expect } from '@playwright/test';

/**
 * 🎼 MAESTRO WORKFLOW SPEC: CAMPAIGN LAUNCH
 *
 * 💡 What: Verifies the multi-agent handoff for a Campaign Launch.
 * 🎯 Why: Ensuring the user remains the gatekeeper before execution.
 * 📊 Steps: Planning -> Creation (Agent) -> Approval (User) -> Execution.
 *
 * SCENARIO:
 * 1. User initiates a campaign for "Dogs Having Fun".
 * 2. Agent (Mocked) generates a 3-step social media plan.
 * 3. User reviews the plan.
 * 4. User approves the plan (Click Execute).
 * 5. System acknowledges execution.
 */
test.describe('Maestro: Multi-Step Approval Workflow', () => {

  test('should facilitate User-Agent handoff: Planning -> Review -> Approval', async ({ page }) => {
    // -----------------------------------------------------------------------
    // 1. Setup & Auth Bypass (Mock User)
    // -----------------------------------------------------------------------
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for store to be available and mock the authenticated user
    await page.waitForFunction(() => !!(window as any).useStore);

    // Inject Mock User and set module to 'campaign'
    await page.evaluate(() => {
      const mockUser = {
        uid: 'maestro-user-id',
        email: 'maestro@example.com',
        displayName: 'Maestro Conductor',
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

      // @ts-expect-error - Mocking partial store state for test
      window.useStore.setState({
        initializeAuthListener: () => () => { },
        user: mockUser,
        authLoading: false,
        currentModule: 'campaign' // Directly load the Campaign module
      });
    });

    // -----------------------------------------------------------------------
    // 2. Initialize Project State: "Dogs Having Fun"
    // -----------------------------------------------------------------------
    const createBtn = page.getByRole('button', { name: 'New Campaign' }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Fill Campaign Details
    await page.getByTestId('campaign-title-input').fill('Dogs Having Fun');
    await page.getByTestId('campaign-description-input').fill('A viral campaign for the new hit song.');

    // Launch (Trigger Agent)
    await page.getByTestId('create-campaign-submit-btn').click();

    // Verify we are on the Detail Page (Project Status: PLANNING/NEW)
    // The default implementation creates an empty campaign.
    await expect(page.getByRole('heading', { name: 'Dogs Having Fun' })).toBeVisible();

    // Verify Plan is currently empty (Initial State)
    // "TimelineView" renders posts. If empty, it might be empty div.
    // Let's verify we don't see the specific posts yet.
    await expect(page.getByText('Day 1: Viral Video')).not.toBeVisible();

    // -----------------------------------------------------------------------
    // 3. Mock Agent "Plan Generation" (The Handoff)
    // -----------------------------------------------------------------------
    // The Agent "thinks" and returns a plan. We inject this via the backdoor event.

    const agentPlan = [
      {
        id: 'post-1',
        day: 1,
        platform: 'TikTok',
        copy: 'Look at these dogs go! #DogsHavingFun',
        status: 'PENDING',
        imageAsset: {
            assetType: 'image',
            title: 'Dog Jump',
            imageUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80',
            caption: 'A dog jumping'
        }
      },
      {
        id: 'post-2',
        day: 2,
        platform: 'Instagram',
        copy: 'Behind the scenes of the music video.',
        status: 'PENDING',
        imageAsset: {
            assetType: 'image',
            title: 'Studio',
            imageUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&q=80',
            caption: 'Studio shot'
        }
      },
      {
        id: 'post-3',
        day: 5,
        platform: 'Twitter',
        copy: 'Stream "Dogs Having Fun" now on Spotify!',
        status: 'PENDING',
        imageAsset: {
            assetType: 'image',
            title: 'Cover Art',
            imageUrl: '',
            caption: 'Album cover'
        }
      }
    ];

    console.log('Maestro: Injecting Agent Plan...');
    await page.evaluate((plan) => {
        const event = new CustomEvent('TEST_INJECT_CAMPAIGN_UPDATE', {
            detail: { posts: plan }
        });
        window.dispatchEvent(event);
    }, agentPlan);

    // -----------------------------------------------------------------------
    // 4. Verify Resource Handoff (Review Phase)
    // -----------------------------------------------------------------------
    // The user should now see the plan generated by the Agent.

    // Verify all 3 steps are visible
    await expect(page.getByText('Look at these dogs go!')).toBeVisible();
    await expect(page.getByText('Behind the scenes')).toBeVisible();
    await expect(page.getByText('Stream "Dogs Having Fun"')).toBeVisible();

    // Verify Platform Context (Indicates correct data structure handoff)
    await expect(page.getByText('TikTok')).toBeVisible();
    await expect(page.getByText('Instagram')).toBeVisible();

    // -----------------------------------------------------------------------
    // 5. User Approval Gate (The Decision)
    // -----------------------------------------------------------------------
    // The "Execute Campaign" button represents the user signing off.

    const executeBtn = page.getByRole('button', { name: 'Execute Campaign' });
    await expect(executeBtn).toBeEnabled();

    // Click Approve
    await executeBtn.click();

    // -----------------------------------------------------------------------
    // 6. Verify State Transition: REVIEW -> EXECUTING
    // -----------------------------------------------------------------------
    // Assert the system acknowledges the command.
    await expect(page.getByText('Processing...')).toBeVisible();

    // Optional: Check if status badge updated (if UI updates immediately)
    // The UI sets 'isExecuting' state which shows "Processing...".
    // The actual "EXECUTING" badge update depends on backend return, which is mocked via UI state in this test scope.

    console.log('Maestro: Workflow Handshake Complete. 🎼');
  });

});
