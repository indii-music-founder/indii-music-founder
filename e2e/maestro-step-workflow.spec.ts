
import { test, expect } from '@playwright/test';

/**
 * 🎼 MAESTRO WORKFLOW SPEC: EXECUTION HANDSHAKE
 *
 * 💡 What: Verifies the "Step 1: Approve" handoff in the Multi-Step Workflow.
 * 🎯 Why: "The Agent proposes; the User disposes." We must ensure the user
 *         explicitly gates the transition from Planning to Execution.
 *
 * SCENARIO:
 * 1. Initialize Project State: { song: "Dogs Having Fun", status: "PENDING" }
 * 2. Mock Agent's "Plan Generation" (Proposal A - Rejected).
 * 3. Mock Agent's "Plan Generation" (Proposal B - Approved).
 * 4. Simulate User Clicking "Approve" (Execute Campaign).
 * 5. Assert: State changes to `IN_PROGRESS` (Executing).
 * 6. Mock Step Completion.
 * 7. Assert: Notification sent to User.
 */
test.describe('Maestro: Execution Handshake', () => {

  test('should verify strict User Approval before Agent Execution', async ({ page }) => {
    // -----------------------------------------------------------------------
    // 1. Setup & Auth Bypass
    // -----------------------------------------------------------------------
    await page.goto('/');

    // Enable Console Logging for debugging
    page.on('console', msg => {
        if (msg.text().startsWith('[Maestro]')) {
            console.log(msg.text());
        }
    });

    // Mock the User and set specific testing flags
    await page.evaluate(() => {
        // Flag to force CampaignManager to use Client-Side Mock Execution
        (window as any).__MAESTRO_MOCK_EXECUTION__ = true;
        // Flag to enable the Event Listener in CampaignDashboard
        (window as any).__MAESTRO_TEST_MODE__ = true;
        // Flag to expose the Store (for verify)
        (window as any).__TEST_MODE__ = true;
        // Flag for useMarketing hook
        (window as any).TEST_MODE = true;

        const mockUser = {
            uid: 'maestro-conductor',
            email: 'conductor@orchestra.com',
            displayName: 'Maestro',
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
        // @ts-expect-error - Mocking partial store
        window.useStore.setState({
            user: mockUser,
            userProfile: { id: 'maestro-conductor', displayName: 'Maestro', email: 'conductor@orchestra.com' },
            authLoading: false,
            currentModule: 'campaign'
        });
    });

    // Wait for the Dashboard to be ready
    await expect(page.getByRole('button', { name: 'New Campaign' }).first()).toBeVisible({ timeout: 10000 });

    // -----------------------------------------------------------------------
    // 2. Initialize Project State & Mock Agent Plan A (The "Reject" Path)
    // -----------------------------------------------------------------------

    const agentPlanA = [
        {
            id: 'step-1-bad',
            day: 1,
            platform: 'Twitter',
            copy: 'Bad Plan: Boring tweet.',
            status: 'PENDING',
            imageAsset: { assetType: 'image', title: 'None', imageUrl: '', caption: '' }
        }
    ];

    console.log('[Maestro] Injecting Agent Proposal A (Bad Plan)...');

    // We trigger a custom event that the App (in test mode) listens to.
    await page.evaluate((posts) => {
        const event = new CustomEvent('TEST_INJECT_CAMPAIGN_UPDATE', {
            detail: {
                id: 'dogs-having-fun-123',
                title: 'Dogs Having Fun',
                description: 'Test Campaign',
                status: 'PENDING',
                posts: posts
            }
        });
        window.dispatchEvent(event);
    }, agentPlanA);

    // Verify Plan A is visible
    // First ensure we are not loading
    await expect(page.getByTestId('marketing-dashboard-loader')).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('heading', { name: 'Dogs Having Fun' })).toBeVisible();
    await expect(page.getByText('Bad Plan: Boring tweet.')).toBeVisible();

    // SCENARIO: User rejects this plan (conceptually).
    // In this UI, they might ask the agent to try again or click Back.
    // We simulate the "Try Again" loop by injecting a NEW plan.

    // -----------------------------------------------------------------------
    // 3. Mock Agent Plan B (The "Approve" Path)
    // -----------------------------------------------------------------------

    const agentPlanB = [
        {
            id: 'step-1',
            day: 1,
            platform: 'TikTok',
            copy: 'Step 1: Teaser - Look at these dogs go!',
            status: 'PENDING',
            imageAsset: { assetType: 'image', title: 'Teaser', imageUrl: 'https://example.com/dog1.jpg', caption: 'Dog 1' }
        },
        {
            id: 'step-2',
            day: 2,
            platform: 'Instagram',
            copy: 'Step 2: Launch - The song is out!',
            status: 'PENDING',
            imageAsset: { assetType: 'image', title: 'Cover', imageUrl: 'https://example.com/dog2.jpg', caption: 'Dog 2' }
        },
        {
            id: 'step-3',
            day: 3,
            platform: 'Twitter',
            copy: 'Step 3: Sustain - Keep dancing!',
            status: 'PENDING',
            imageAsset: { assetType: 'image', title: 'Meme', imageUrl: 'https://example.com/dog3.jpg', caption: 'Dog 3' }
        }
    ];

    console.log('[Maestro] Injecting Agent Proposal B (Good Plan)...');

    await page.evaluate((posts) => {
        const event = new CustomEvent('TEST_INJECT_CAMPAIGN_UPDATE', {
            detail: {
                // Keep same ID to simulate updating the SAME project
                id: 'dogs-having-fun-123',
                posts: posts
            }
        });
        window.dispatchEvent(event);
    }, agentPlanB);

    // Verify Plan B replaced Plan A
    await expect(page.getByText('Step 1: Teaser')).toBeVisible();
    await expect(page.getByText('Step 3: Sustain')).toBeVisible();

    // Verify Plan A is GONE
    await expect(page.getByText('Bad Plan: Boring tweet.')).not.toBeVisible();

    // -----------------------------------------------------------------------
    // 4. User Approval Gate ("Step 1: Approve")
    // -----------------------------------------------------------------------

    const approveBtn = page.getByRole('button', { name: 'Execute Campaign' });
    await expect(approveBtn).toBeEnabled();

    console.log('[Maestro] User is approving the plan...');
    // Force click in case Chat Input overlays
    await approveBtn.click({ force: true });

    // -----------------------------------------------------------------------
    // 5. Assert State Transition: PENDING -> IN_PROGRESS
    // -----------------------------------------------------------------------
    // Immediate feedback: Button enters "Processing" state
    await expect(page.getByText('Processing...')).toBeVisible();

    // Status Badge should reflect EXECUTING
    const statusBadge = page.getByTestId('campaign-status-badge');
    await expect(statusBadge).toHaveText(/Executing/i);

    // -----------------------------------------------------------------------
    // 6. Mock Step Completion & 7. Notification
    // -----------------------------------------------------------------------
    // The Mock Execution (inside CampaignManager) waits 1.5s then returns SUCCESS.

    // Verify Notification sent to User
    const toast = page.getByText('Campaign executed successfully!');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Verify Final State: DONE
    await expect(statusBadge).toHaveText(/Done/i);

    // Verify Execute button is disabled
    await expect(approveBtn).toBeDisabled();

    // Verify Individual Step Completion
    const doneBadges = page.getByText('Done');
    expect(await doneBadges.count()).toBeGreaterThanOrEqual(2);

    console.log('[Maestro] Workflow completed successfully. User approved, Agent executed.');
  });
});
