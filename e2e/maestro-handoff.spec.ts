
import { test, expect } from '@playwright/test';

test.describe('Maestro Campaign Workflow: User-Agent Handoff & Rejection Loop', () => {
  /**
   * 🎼 Maestro's Mission:
   * Verify the "Agent proposes; User disposes" philosophy.
   * Specifically test the "Reject/Regenerate" loop which is critical for Human-in-the-Loop.
   *
   * Scenario:
   * 1. User requests AI Campaign.
   * 2. Agent proposes "Plan A" (Bad).
   * 3. User REJECTS (Regenerates).
   * 4. Agent proposes "Plan B" (Good).
   * 5. User APPROVES (Create).
   * 6. User EXECUTES (Final Gate).
   */
  test('should allow user to Reject (Regenerate) agent proposal before Approval', async ({ page }) => {
    // -----------------------------------------------------------------------
    // 1. Setup & Auth Bypass
    // -----------------------------------------------------------------------
    await page.goto('/');

    // Wait for store to be available
    await page.waitForFunction(() => !!(window as any).useStore);

    // Mock User & State
    await page.evaluate(() => {
      const mockUser = {
        uid: 'maestro-handoff-user',
        email: 'maestro@example.com',
        displayName: 'Maestro Test User',
        emailVerified: true,
        isAnonymous: false,
        getIdToken: async () => 'mock-token',
        getIdTokenResult: async () => ({ token: 'mock-token' } as any),
        toJSON: () => ({}),
      };

      // @ts-expect-error - Mocking partial store state for test
      window.useStore.setState({
        initializeAuthListener: () => () => { },
        user: mockUser,
        authLoading: false,
        currentModule: 'campaign' // Force Campaign Dashboard
      });

      // Enable Maestro Test Mode for Event Injection
      (window as any).__MAESTRO_TEST_MODE__ = true;
    });

    // -----------------------------------------------------------------------
    // 2. Open AI Generator
    // -----------------------------------------------------------------------
    const aiBtn = page.getByRole('button', { name: 'Generate with AI' }).first();
    await expect(aiBtn).toBeVisible();
    await aiBtn.click();
    await expect(page.getByText('AI Campaign Generator')).toBeVisible();

    // -----------------------------------------------------------------------
    // 3. Agent Proposes "Plan A" (The "Bad" Plan)
    // -----------------------------------------------------------------------
    const planA = {
      title: 'Plan A: Boring Strategy',
      description: 'A very generic plan that the user should reject.',
      posts: [
        {
          platform: 'Twitter',
          day: 1,
          copy: 'Buy our stuff.',
          imagePrompt: 'A product photo',
          hashtags: ['#ad'],
          bestTimeToPost: '9:00 AM'
        }
      ]
    };

    // Inject Plan A
    await page.evaluate((plan) => {
      // @ts-expect-error - injected by Playwright
      window.__MOCK_AI_PLAN__ = plan;
    }, planA);

    // Fill form and Generate
    await page.getByPlaceholder(/e\.g\., New album/i).fill('My New Song');
    await page.getByRole('button', { name: 'Generate Campaign' }).click();

    // Verify Plan A is presented (Review Step)
    await expect(page.getByText('Plan A: Boring Strategy')).toBeVisible();
    await expect(page.getByText('Buy our stuff.')).toBeVisible();

    // -----------------------------------------------------------------------
    // 4. User Disposes -> REJECT (Regenerate)
    // -----------------------------------------------------------------------
    // Prepare "Plan B" (The "Good" Plan) BEFORE clicking regenerate
    const planB = {
      title: 'Plan B: Viral Masterpiece',
      description: 'A creative strategy involving puppies and lasers.',
      posts: [
        {
          platform: 'Twitter',
          day: 1,
          copy: 'Puppies with lasers! 🐶⚡️',
          imagePrompt: 'Puppy with laser eyes',
          hashtags: ['#viral', '#puppies'],
          bestTimeToPost: '10:00 AM'
        }
      ]
    };

    // Update Mock to Plan B
    await page.evaluate((plan) => {
      // @ts-expect-error - injected by Playwright
      window.__MOCK_AI_PLAN__ = plan;
    }, planB);

    // Click Regenerate (Resets to Form)
    const regenerateBtn = page.getByRole('button', { name: 'Regenerate' });
    await expect(regenerateBtn).toBeVisible();
    await regenerateBtn.click();

    // Verify reset to form
    await expect(page.getByRole('button', { name: 'Generate Campaign' })).toBeVisible();
    await expect(page.getByText('Plan A: Boring Strategy')).not.toBeVisible();

    // Click Generate Again
    await page.getByRole('button', { name: 'Generate Campaign' }).click();

    // -----------------------------------------------------------------------
    // 5. Verify Loop: Plan B Present
    // -----------------------------------------------------------------------
    await expect(page.getByText('Plan B: Viral Masterpiece')).toBeVisible();
    await expect(page.getByText('Puppies with lasers!')).toBeVisible();

    // -----------------------------------------------------------------------
    // 6. User Disposes -> APPROVE (Create)
    // -----------------------------------------------------------------------
    await page.getByRole('button', { name: 'Create Campaign' }).click();

    // Wait for Modal to Close (Ensures UI is ready for transition)
    await expect(page.getByText('AI Campaign Generator')).not.toBeVisible();

    // 🎼 Maestro Magic: Simulate the Backend Success via Event Injection
    // Since we mocked the User but not the Firestore persistence layer,
    // we explicitly inject the "Saved Campaign" state to verify the UI Handoff.
    const campaignB = {
      id: 'mock-campaign-b',
      assetType: 'campaign',
      title: 'Plan B: Viral Masterpiece',
      description: 'A creative strategy involving puppies and lasers.',
      posts: planB.posts,
      status: 'PENDING',
      startDate: new Date().toISOString()
    };

    await page.evaluate((data) => {
      window.dispatchEvent(new CustomEvent('TEST_INJECT_CAMPAIGN_UPDATE', { detail: data }));
    }, campaignB);

    // Verify Handoff to Campaign Manager
    // Should see Detail View with Plan B title
    await expect(page.getByRole('heading', { name: 'Plan B: Viral Masterpiece' })).toBeVisible();

    // Verify Resource Handoff (The plan data persisted)
    await expect(page.getByText('Puppies with lasers!')).toBeVisible();

    // -----------------------------------------------------------------------
    // 7. Final Gate -> EXECUTE
    // -----------------------------------------------------------------------
    await expect(page.getByText('Pending', { exact: false })).toBeVisible();

    const executeBtn = page.getByRole('button', { name: 'Execute Campaign' });
    await expect(executeBtn).toBeEnabled();
    await executeBtn.click();

    // Verify Transition to Execution State
    await expect(page.getByText('Processing...')).toBeVisible();

    // Optionally check for success toast or status change if immediate
    // But "Processing..." confirms the state transition triggered by the button.
  });
});
