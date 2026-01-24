
import { test, expect } from '@playwright/test';

test.describe('Maestro Multi-Step Approval Workflow', () => {

  test.beforeEach(async ({ page }) => {
    // -----------------------------------------------------------------------
    // 1. Setup & Auth Bypass (Mock User)
    // -----------------------------------------------------------------------
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
        user: mockUser,
        authLoading: false,
        currentModule: 'campaign'
      });

      // Mock Marketing Service
      const mockCampaigns = new Map();
      // @ts-expect-error - Mocking global service
      window.__MOCK_MARKETING_SERVICE__ = {
        createCampaign: async (campaign) => {
           const id = 'mock-campaign-123';
           const newCampaign = { ...campaign, id, status: 'PENDING' };
           mockCampaigns.set(id, newCampaign);
           return id;
        },
        getCampaignById: async (id) => {
           return mockCampaigns.get(id) || null;
        },
        getCampaigns: async () => {
           return Array.from(mockCampaigns.values());
        },
        updateCampaign: async (id, updates) => {
           const current = mockCampaigns.get(id);
           if (current) {
             mockCampaigns.set(id, { ...current, ...updates });
           }
        }
      };
    });
  });

  test('should execute Agent-User Handoff with Rejection Loop: Plan -> Generate -> Reject -> Approve -> Execute', async ({ page }) => {
    // -----------------------------------------------------------------------
    // STEP 1: PLANNING (Agent Proposes, User Approves)
    // -----------------------------------------------------------------------

    // Open AI Generate Modal
    const aiGenerateBtn = page.getByRole('button', { name: 'Generate with AI' }).first();
    await expect(aiGenerateBtn).toBeVisible();
    await aiGenerateBtn.click();

    // Mock the Agent's Plan
    const mockPlan = {
      title: 'Maestro Symphony Launch',
      description: 'A multi-step workflow test',
      posts: [
        {
          platform: 'Twitter',
          day: 1,
          copy: 'Step 1 complete!',
          imagePrompt: 'A conductor with a baton',
          hashtags: ['#maestro', '#test'],
          bestTimeToPost: '9:00 AM'
        },
        {
          platform: 'Instagram',
          day: 1,
          copy: 'Visualizing the workflow',
          imagePrompt: 'Abstract flow chart art',
          hashtags: ['#workflow', '#art'],
          bestTimeToPost: '12:00 PM'
        }
      ]
    };

    await page.evaluate((plan) => {
      // @ts-expect-error - injected by Playwright
      window.__MOCK_AI_PLAN__ = plan;
    }, mockPlan);

    // Fill Brief & Generate
    await page.getByPlaceholder(/e\.g\., New album/i).fill('Maestro Test');
    await page.getByRole('button', { name: 'Generate Campaign' }).click();

    // Verify Preview
    await expect(page.getByText('Maestro Symphony Launch')).toBeVisible();

    // Create Campaign (User Approves Plan)
    await page.getByRole('button', { name: 'Create Campaign' }).click();

    // Verify Detail View
    await expect(page.getByRole('heading', { name: 'Maestro Symphony Launch' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('campaign-status-badge')).toHaveText('PENDING');

    // -----------------------------------------------------------------------
    // STEP 2: GENERATION (Agent Works)
    // -----------------------------------------------------------------------

    // Setup Mock for Image Generation
    await page.evaluate(() => {
      // @ts-expect-error - Mocking global service
      window.__MOCK_CAMPAIGN_AI_SERVICE__ = {
        generatePostImages: async (posts, onProgress) => {
           // Simulate progress
           if(onProgress) onProgress({ current: 1, total: posts.length, currentPostId: posts[0].id, status: 'generating' });

           // Return posts with mocked images
           return posts.map((p, i) => ({
             ...p,
             imageAsset: {
               ...p.imageAsset,
               imageUrl: i === 0
                  ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' // Blue pixel
                  : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' // Red pixel
             }
           }));
        },
        generateSingleImage: async (post) => {
           return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='; // Green pixel
        }
      };
    });

    // Click "Generate 2 Images"
    const generateImagesBtn = page.getByRole('button', { name: /Generate.*Images/ });
    await expect(generateImagesBtn).toBeVisible();
    await generateImagesBtn.click();

    // In Modal: Click "Generate 2 Images" (or "Generate Images")
    // Wait for modal to be visible
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    // Use more specific selector or force click
    const modalGenerateBtn = page.locator('div[role="dialog"]').getByRole('button', { name: /Generate.*Images/ });
    await expect(modalGenerateBtn).toBeVisible();
    await modalGenerateBtn.click({ force: true });

    // Verify Images Generated
    await expect(page.getByAltText('Post 1')).toBeVisible();
    await expect(page.getByAltText('Post 2')).toBeVisible();

    // Verify status badges "Complete"
    // Use strict mode safe selector
    await expect(page.locator('text=Complete').first()).toBeVisible();

    // -----------------------------------------------------------------------
    // STEP 3: REVIEW & REJECT (The Loop)
    // -----------------------------------------------------------------------

    // Find the second post container (index 1)
    const postContainer = page.locator('.aspect-square').nth(1);
    await postContainer.hover();

    // Click Regenerate
    const regenerateBtn = postContainer.getByRole('button');
    await regenerateBtn.click();

    // Verify that generateSingleImage was called and image updated (Green pixel)
    // Wait for the new image src to appear.
    // We search for the base64 string or part of it
    const newImage = page.locator('img[src*="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="]');
    await expect(newImage).toBeVisible();

    // -----------------------------------------------------------------------
    // STEP 4: APPROVAL (User Approves Assets)
    // -----------------------------------------------------------------------

    // Click "Apply & Save"
    await page.getByRole('button', { name: 'Apply & Save' }).click();

    // Verify Modal Closed
    await expect(page.getByRole('dialog')).toBeHidden();

    // Verify Images are now in the Campaign Detail Timeline
    // In TimelineView, there are images.
    await expect(page.locator('img[src*="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="]')).toBeVisible(); // Blue
    await expect(page.locator('img[src*="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="]')).toBeVisible(); // Green

    // -----------------------------------------------------------------------
    // STEP 5: EXECUTION (Final Handoff)
    // -----------------------------------------------------------------------

    const executeBtn = page.getByRole('button', { name: 'Execute Campaign' });
    await expect(executeBtn).toBeEnabled();
    await executeBtn.click();

    // Verify Status Transition
    await expect(page.getByText('Processing...')).toBeVisible();

    // Optionally verify status badge changed to Executing
    // Depending on how fast the mock/state updates.
    // The component shows "Processing..." while isExecuting is true.
  });

});
