
import { test, expect } from '@playwright/test';

test.describe('Maestro Campaign Workflow', () => {
  test('should execute Agent-User Handoff: Create -> Approve -> Execute', async ({ page }) => {
    // -----------------------------------------------------------------------
    // 1. Setup & Auth Bypass (Mock User)
    // -----------------------------------------------------------------------
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for store to be available and mock the authenticated user
    await page.waitForFunction(() => !!(window as any).useStore);
    await page.evaluate(() => {
      const mockUser = {
        uid: 'test-user-maestro',
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

      // Inject user and set module to 'campaign' (CampaignDashboard component)
      // This component handles post-creation selection better than the main MarketingDashboard
      // @ts-expect-error - Mocking partial store state for test
      window.useStore.setState({
        initializeAuthListener: () => () => { },
        user: mockUser,
        authLoading: false,
        currentModule: 'campaign'
      });
    });

    // -----------------------------------------------------------------------
    // 2. Initialize Project State (Mock Agent Creation)
    // -----------------------------------------------------------------------
    // NOTE: Instead of mocking complex Firestore WebSocket network traffic to "Inject" a plan,
    // we use the UI to simulate the Agent creating the campaign. This ensures the
    // internal state machine and validation logic are exercised correctly before the handoff.

    // Check we are on Campaign Manager
    const createBtn = page.getByRole('button', { name: 'Create Campaign' }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Expect Modal Title "New Campaign"
    await expect(page.getByText('New Campaign', { exact: true })).toBeVisible();

    // Fill in the "Agent's Plan"
    // Use specific song name as requested: "Dogs Having Fun"
    await page.getByTestId('campaign-title-input').fill('Dogs Having Fun');
    await page.getByTestId('campaign-description-input').fill('A viral campaign for the new hit song. Goal: Viral Awareness.');

    // Launch/Save (Simulate "Agent Proposes")
    await page.getByTestId('create-campaign-submit-btn').click();

    // -----------------------------------------------------------------------
    // 3. Verify State Transition: PLANNING -> GENERATING (Simulated)
    // -----------------------------------------------------------------------
    // In 'campaign' module, successful creation triggers `handleCreateSave` which:
    // 1. Closes Modal
    // 2. Fetches the new campaign by ID
    // 3. Sets it as `selectedCampaign`
    // This switches the view to CampaignDetail automatically.

    // So we verify that the Detail View for "Dogs Having Fun" appears.
    // This is the critical "Handoff" verification - the resource created in step 2 is available in step 3.
    await expect(page.getByRole('heading', { name: 'Dogs Having Fun' })).toBeVisible({ timeout: 10000 });

    // -----------------------------------------------------------------------
    // 4. User Review & Approval (The Handoff)
    // -----------------------------------------------------------------------
    // Assert initial status (Should be PENDING or NEW)
    await expect(page.getByText('Pending', { exact: false })).toBeVisible();

    // "The User Disposes" -> Click Execute (Approve)
    const executeBtn = page.getByRole('button', { name: 'Execute Campaign' });
    await expect(executeBtn).toBeVisible();

    // Ensure it is enabled
    await expect(executeBtn).toBeEnabled();

    // Click Approve
    await executeBtn.click();

    // -----------------------------------------------------------------------
    // 5. Verify Execution State
    // -----------------------------------------------------------------------
    // Assert state changes to PROCESSING or EXECUTING
    // The button text changes to "Processing..."
    await expect(page.getByText('Processing...')).toBeVisible();

    // NOTE: We stop verification here because completing the job requires a real backend
    // or complex long-polling mocks which are outside the scope of this UI-focused E2E test.
    // The "Processing..." state confirms the Handoff was successful and the system
    // accepted the user's approval.
  });
});
