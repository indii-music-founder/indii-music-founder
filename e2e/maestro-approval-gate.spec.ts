
import { test, expect } from '@playwright/test';

test.describe('Maestro Campaign Workflow: The Approval Gate', () => {
  /**
   * 🎼 Maestro's Mission:
   * Verify the Multi-Step Workflow handoff between User and Agent.
   *
   * Steps:
   * 1. Mock User & Init State.
   * 2. Mock Agent "Proposes" (Create Campaign A).
   * 3. User "Disposes" -> REJECT (Go Back).
   * 4. Verify State Loop (Back to start).
   * 5. Mock Agent "Proposes Again" (Create Campaign B).
   * 6. User "Disposes" -> APPROVE (Execute).
   * 7. Verify Transition to Execution.
   */
  test('should verify User Gatekeeper Logic (Reject -> Approve loop)', async ({ page }) => {
    // -----------------------------------------------------------------------
    // 1. Setup & Auth Bypass
    // -----------------------------------------------------------------------
    await page.goto('/');

    // Wait for store to be available and mock the authenticated user
    await page.waitForFunction(() => !!(window as any).useStore);

    // Intercept Firestore interactions or mock internal state handling if possible.
    // Since we cannot easily intercept Firestore SDK calls via network tab (WebSockets),
    // and we faced issues with backend persistence in the previous run,
    // we will mock the `createCampaign` effect by ensuring the UI responds correctly
    // or by accepting that we are testing the Frontend State Machine primarily.

    // However, to avoid "False Positives", we will assert visibility strictly.

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
      // @ts-expect-error - Mocking partial store state for test
      window.useStore.setState({
        initializeAuthListener: () => () => { },
        user: mockUser,
        authLoading: false,
        currentModule: 'campaign'
      });
    });

    // -----------------------------------------------------------------------
    // 2. The Agent Proposes (Attempt 1 - Bad Plan)
    // -----------------------------------------------------------------------
    const createBtn = page.getByRole('button', { name: /New Campaign/i }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Fill in "Bad Plan"
    await page.getByTestId('campaign-title-input').fill('Bad Plan');
    await page.getByTestId('campaign-description-input').fill('This plan lacks vision.');

    // Agent Submits Proposal
    await page.getByTestId('create-campaign-submit-btn').click();

    // -----------------------------------------------------------------------
    // 3. The User Disposes (REJECT)
    // -----------------------------------------------------------------------
    // Verify we are in Review Mode (Detail View).
    // This confirms "Resource Handoff" (Plan created -> Plan Viewed).
    // We expect the heading to be visible. If it fails, the test fails (Correct behavior).
    await expect(page.getByRole('heading', { name: 'Bad Plan' })).toBeVisible({ timeout: 10000 });

    // User decides to REJECT. In this UI, "Reject" is "Go Back / Abandon".
    // We use a specific locator for the Back button, assuming it's the arrow-left button.
    // If we could modify source, we would add `aria-label="Back"`.
    // For now, we rely on the implementation detail or position.
    const backBtn = page.locator('button:has(svg.lucide-arrow-left)').first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // -----------------------------------------------------------------------
    // 4. Verify Loop Back
    // -----------------------------------------------------------------------
    await expect(createBtn).toBeVisible();

    // -----------------------------------------------------------------------
    // 5. The Agent Proposes Again (Attempt 2 - Good Plan)
    // -----------------------------------------------------------------------
    await createBtn.click();
    await page.getByTestId('campaign-title-input').fill('Dogs Having Fun');
    await page.getByTestId('campaign-description-input').fill('Viral launch strategy.');
    await page.getByTestId('create-campaign-submit-btn').click();

    // -----------------------------------------------------------------------
    // 6. The User Disposes (APPROVE)
    // -----------------------------------------------------------------------
    // Verify Review View
    await expect(page.getByRole('heading', { name: 'Dogs Having Fun' })).toBeVisible({ timeout: 10000 });

    // Verify Resource Handoff: Check that the description passed from step 5 is present in step 6.
    await expect(page.getByText('Viral launch strategy.')).toBeVisible();

    await expect(page.getByText('Pending', { exact: false })).toBeVisible();

    const executeBtn = page.getByRole('button', { name: 'Execute Campaign' });
    await expect(executeBtn).toBeEnabled();
    await executeBtn.click();

    // -----------------------------------------------------------------------
    // 7. Verify Transition to Execution
    // -----------------------------------------------------------------------
    await expect(page.getByText('Processing...')).toBeVisible();
  });
});
