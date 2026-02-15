import { test, expect } from '@playwright/test';

test.describe('Maestro Step Workflow', () => {

  // Increase timeout for this test suite
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    // -----------------------------------------------------------------------
    // 1. Setup & Auth Bypass
    // -----------------------------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

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

      // Inject user and set module to 'campaign'
      // @ts-expect-error - Mocking partial store state for test
      window.useStore.setState({
        initializeAuthListener: () => () => { },
        loadUserProfile: async () => {}, // Mock to prevent side effects
        initializeHistory: async () => {}, // Mock
        loadProjects: async () => {}, // Mock
        user: mockUser,
        userProfile: null, // Ensure no profile so useMarketing skips Firestore
        authLoading: false,
        currentModule: 'campaign'
      });

      // Mock MarketingService to avoid Firestore
      (window as any).__MOCK_MARKETING_SERVICE__ = {
          createCampaign: async (campaign: any) => {
              console.log('Mock createCampaign called');
              // Store it in a global mock store if needed, or just return ID
              (window as any).__MOCK_LAST_CAMPAIGN__ = { ...campaign, id: 'mock-campaign-id', status: 'PENDING' };
              return 'mock-campaign-id';
          },
          getCampaignById: async (id: string) => {
              console.log('Mock getCampaignById called', id);
              if (id === 'mock-campaign-id') {
                  return (window as any).__MOCK_LAST_CAMPAIGN__;
              }
              return null;
          }
      };
    });
  });

  test('should execute Multi-Step Workflow: Plan -> Reject -> Approve -> Execute -> Verify', async ({ page }) => {
    // -----------------------------------------------------------------------
    // PHASE 1: Agent Proposes & User Rejects (The "No" Path)
    // -----------------------------------------------------------------------

    // Wait for lazy loading to finish (increase timeout)
    await expect(page.getByText('Active Campaigns')).toBeVisible({ timeout: 30000 });

    // 1. Open AI Generate Modal
    const aiGenerateBtn = page.getByText('Generate with AI').first();
    await expect(aiGenerateBtn).toBeVisible();
    await aiGenerateBtn.click();
    await expect(page.getByText('AI Campaign Generator')).toBeVisible();

    // 2. Mock Bad Plan
    const badPlan = {
      title: 'Boring Campaign',
      description: 'A bad idea',
      posts: [
        {
          platform: 'Twitter',
          day: 1,
          copy: 'Boring tweet',
          imagePrompt: 'Grey wall',
          hashtags: ['#boring'],
          bestTimeToPost: '9:00 AM'
        }
      ]
    };
    await page.evaluate((plan) => {
      // @ts-expect-error - injected by Playwright
      window.__MOCK_AI_PLAN__ = plan;
    }, badPlan);

    // 3. Generate
    await page.getByPlaceholder(/e\.g\., New album/i).fill('Bad Topic');
    await page.getByRole('button', { name: 'Generate Campaign' }).evaluate(b => (b as HTMLElement).click());

    // Verify Loading State
    await expect(page.getByText('Generating...')).toBeVisible();

    // 4. Verify Preview & Reject (Close Modal)
    await expect(page.getByText('Boring Campaign')).toBeVisible({ timeout: 10000 });
    // Simulate "Reject" by closing the modal without creating
    const closeBtn = page.getByRole('button', { name: 'Close' }).first();
    // Some modals have a specific X button or click outside.
    // Assuming standard accessible dialog close or pressing Escape.
    await page.keyboard.press('Escape');

    // Verify we are back to dashboard (Modal closed)
    await expect(page.getByText('AI Campaign Generator')).toBeHidden();

    // -----------------------------------------------------------------------
    // PHASE 2: Agent Proposes & User Approves (Step 1: Plan Approval)
    // -----------------------------------------------------------------------

    // 1. Open Modal Again
    await aiGenerateBtn.click();

    // 2. Mock Good Plan
    const goodPlan = {
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
        },
        {
          platform: 'Twitter',
          day: 2,
          copy: 'Who let the dogs out? We did! #DogsHavingFun',
          imagePrompt: 'Dog wearing sunglasses',
          hashtags: ['#Music', '#NewDrop'],
          bestTimeToPost: '3:00 PM'
        }
      ]
    };
    await page.evaluate((plan) => {
      // @ts-expect-error - injected by Playwright
      window.__MOCK_AI_PLAN__ = plan;
    }, goodPlan);

    // 3. Generate
    await page.getByPlaceholder(/e\.g\., New album/i).fill('Dogs Having Fun');
    await page.getByRole('button', { name: 'Generate Campaign' }).evaluate(b => (b as HTMLElement).click());

    // 4. Verify Preview
    await expect(page.getByText('Dogs Having Fun')).toBeVisible();
    await expect(page.getByText('Check out the new video! #DogsHavingFun')).toBeVisible();

    // 5. Approve (Create Campaign)
    await page.getByRole('button', { name: 'Create Campaign' }).evaluate(b => (b as HTMLElement).click());

    // 6. Assert State Transition: PLANNING -> PENDING
    // We expect to be redirected to the Detail View
    await expect(page.getByRole('heading', { name: 'Dogs Having Fun' })).toBeVisible({ timeout: 10000 });
    // Check status badge
    await expect(page.getByTestId('campaign-status-badge')).toHaveText('PENDING');

    // -----------------------------------------------------------------------
    // PHASE 3: Execution & Handoff (Step 2: Execution Approval)
    // -----------------------------------------------------------------------

    // 1. Setup Mock for Cloud Function (The "Agent Execution")
    await page.route('**/executeCampaign', async route => {
        // Mock the processing delay
        await new Promise(r => setTimeout(r, 500));

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
                            // The "Resource Handoff" - Agent provides the file
                            imageUrl: 'https://example.com/generated-dog.jpg',
                            caption: p.imagePrompt
                        },
                        status: 'DONE' // Agent marks it as DONE
                    }))
                }
            })
        });
    });

    // 2. Click Execute (Approve)
    const executeBtn = page.getByRole('button', { name: 'Execute Campaign' });
    await expect(executeBtn).toBeVisible();
    await executeBtn.evaluate(b => (b as HTMLElement).click());

    // 3. Assert "Processing" State (IN_PROGRESS)
    // The button should change text or state
    await expect(page.getByText('Processing...')).toBeVisible();

    // -----------------------------------------------------------------------
    // PHASE 4: Completion & Verification
    // -----------------------------------------------------------------------

    // 1. Verify Success Notification
    await expect(page.getByText('Campaign executed successfully!')).toBeVisible({ timeout: 10000 });

    // 2. Verify Final State (DONE)
    await expect(page.getByTestId('campaign-status-badge')).toHaveText('DONE');

    // 3. Verify Resource Handoff
    // The image URL should be present in the UI (e.g., in the post card)
    // We look for the image or the "Asset: Generated Image" text
    await expect(page.getByText('Asset: Generated Image').first()).toBeVisible();

    // Optionally check if the image src is correct (if rendered)
    const images = page.locator('img[src="https://example.com/generated-dog.jpg"]');
    await expect(images.first()).toBeVisible();

  });
});
