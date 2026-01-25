import { test, expect } from '@playwright/test';

test.describe('Maestro Multi-Step Workflow: User Approval & Handoff', () => {

  // Increase timeout for this long workflow
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
              // Store the created campaign so getCampaignById can return it
              // Explicitly set status to PENDING if not provided
              const newCampaign = { status: 'PENDING', ...campaign, id: 'mock-campaign-id' };
              (window as any).__MOCK_LAST_CAMPAIGN__ = newCampaign;
              return 'mock-campaign-id';
          },
          getCampaignById: async (id: string) => {
              console.log('Mock getCampaignById called', id);
              if (id === 'mock-campaign-id') {
                 return (window as any).__MOCK_LAST_CAMPAIGN__;
              }
              return null;
          },
          updateCampaign: async (id: string, updates: any) => {
              console.log('Mock updateCampaign called', id, updates);
              if (id === 'mock-campaign-id' && (window as any).__MOCK_LAST_CAMPAIGN__) {
                  (window as any).__MOCK_LAST_CAMPAIGN__ = { ...(window as any).__MOCK_LAST_CAMPAIGN__, ...updates };
              }
          }
      };
    });
  });

  test('should execute Agent workflow: Plan -> Reject -> Approve -> Execute -> Handoff', async ({ page }) => {

    // -----------------------------------------------------------------------
    // PHASE 1: Agent Proposal & Rejection (The Gate)
    // -----------------------------------------------------------------------

    // Ensure we are on the campaign dashboard and the button is visible
    const aiGenerateBtn = page.getByText('Generate with AI').first();
    await expect(aiGenerateBtn).toBeVisible({ timeout: 15000 });
    await aiGenerateBtn.click();
    await expect(page.getByText('AI Campaign Generator')).toBeVisible();

    // HACK: Hide floating elements if any (copied from previous tests)
    await page.evaluate(() => {
        const overlays = document.querySelectorAll('.fixed.bottom-8.z-\\[500\\]');
        overlays.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
        });
    });

    // Mock Bad Plan
    const badPlan = {
      title: 'Boring Campaign',
      description: 'A bad idea that should be rejected.',
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

    // Generate Bad Plan
    await page.getByPlaceholder(/e\.g\., New album/i).fill('Bad Idea');
    await page.getByRole('button', { name: 'Generate Campaign' }).click();

    // Verify Bad Plan Preview
    await expect(page.getByText('Boring Campaign')).toBeVisible();

    // Reject (Close Modal)
    // Use precise locator for the modal's close button
    const modal = page.locator('div[role="dialog"][aria-modal="true"]');
    const closeBtn = modal.getByRole('button', { name: 'Close' });
    // Force click to avoid interception by potential overlays/animations
    await closeBtn.click({ force: true });
    await expect(page.getByText('AI Campaign Generator')).toBeHidden();


    // -----------------------------------------------------------------------
    // PHASE 2: Agent Proposal & Approval (The Handoff)
    // -----------------------------------------------------------------------

    // Open Modal Again
    await aiGenerateBtn.click();

    // Mock Good Plan (Dogs Having Fun)
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
        }
      ]
    };

    await page.evaluate((plan) => {
      // @ts-expect-error - injected by Playwright
      window.__MOCK_AI_PLAN__ = plan;
    }, goodPlan);

    // Generate Good Plan
    await page.getByPlaceholder(/e\.g\., New album/i).fill('Dogs Having Fun');
    await page.getByRole('button', { name: 'Generate Campaign' }).click();

    // Verify Good Plan Preview
    await expect(page.getByText('Dogs Having Fun')).toBeVisible();
    await expect(page.getByText('Check out the new video! #DogsHavingFun')).toBeVisible();

    // User Approval (Create Campaign)
    await page.getByRole('button', { name: 'Create Campaign' }).click();

    // -----------------------------------------------------------------------
    // PHASE 3: State Verification (Planning Mode)
    // -----------------------------------------------------------------------

    // Verify navigation to Detail View
    await expect(page.getByRole('heading', { name: 'Dogs Having Fun' })).toBeVisible({ timeout: 10000 });

    // Assert Status is PENDING (or equivalent)
    await expect(page.getByTestId('campaign-status-badge')).toHaveText(/PENDING|PLANNING/i);

    // -----------------------------------------------------------------------
    // PHASE 4: Execution Handoff (The Action)
    // -----------------------------------------------------------------------

    // Mock Execution Network Request
    // Firebase functions often use specific URL patterns.
    // We assume the frontend calls a function named 'executeCampaign'
    await page.route('**/executeCampaign', async route => {
        await new Promise(r => setTimeout(r, 500)); // Simulate processing delay

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
                            // RESOURCE HANDOFF: The file URL
                            imageUrl: 'https://example.com/generated-dog.jpg',
                            caption: p.imagePrompt
                        },
                        status: 'DONE'
                    }))
                }
            })
        });
    });

    // User Execution Approval
    const executeBtn = page.getByRole('button', { name: 'Execute Campaign' });
    await expect(executeBtn).toBeVisible();
    await expect(executeBtn).toBeEnabled();
    await executeBtn.click();

    // Verify Processing State (Optimistic Update)
    await expect(page.getByText('Processing...')).toBeVisible();

    // -----------------------------------------------------------------------
    // PHASE 5: Completion & Resource Handoff Verification
    // -----------------------------------------------------------------------

    // Verify Success Notification (Wait for processing to finish)
    await expect(page.getByText('Campaign executed successfully!')).toBeVisible({ timeout: 10000 });

    // Assert Status is DONE
    await expect(page.getByTestId('campaign-status-badge')).toHaveText(/DONE|PUBLISHED/i);

    // Verify Resource Handoff: Check for the generated asset
    // We expect the image to be rendered
    const image = page.locator('img[src="https://example.com/generated-dog.jpg"]');
    await expect(image).toBeVisible();

    console.log('Maestro Test Completed: Workflow verified from Plan to Published.');

  });
});
