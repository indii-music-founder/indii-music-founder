
import { test, expect } from '@playwright/test';

test.describe('Maestro Music Video Workflow', () => {

  test.beforeEach(async ({ page }) => {
    // -----------------------------------------------------------------------
    // 1. Setup & Auth Bypass
    // -----------------------------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Auth Bypass via Guest Login
    const guestLoginBtn = page.getByRole('button', { name: 'Guest Login (Dev)' });
    if (await guestLoginBtn.isVisible()) {
        await guestLoginBtn.click();
        await expect(guestLoginBtn).toBeHidden({ timeout: 10000 });
    }
    await expect(page.getByText('Quick Launch')).toBeVisible({ timeout: 15000 });
  });

  test('should verify Complete Workflow: Plan -> Reject -> Approve -> Execute -> Edit -> Publish', async ({ page }) => {
    // Increase timeout for this long workflow
    test.setTimeout(90000);

    // -----------------------------------------------------------------------
    // PHASE 1: PLANNING & APPROVAL GATE (User <-> Agent Manager)
    // -----------------------------------------------------------------------

    // 1.1 Switch to Campaign Manager (simulating "Planning" phase)
    await page.waitForFunction(() => !!(window as any).useStore);
    await page.evaluate(() => {
        // @ts-expect-error - Navigate via store
        window.useStore.setState({ currentModule: 'campaign' });
    });

    // 1.2 Agent Proposes (Attempt 1 - Bad Plan)
    const createBtn = page.getByRole('button', { name: /New Campaign/i }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    await page.getByTestId('campaign-title-input').fill('Bad Music Video Idea');
    await page.getByTestId('campaign-description-input').fill('A boring static image.');
    await page.getByTestId('create-campaign-submit-btn').click();

    // Handle Modal / Transition
    const badCampaignCard = page.getByRole('heading', { name: 'Bad Music Video Idea' }).first();
    await expect(badCampaignCard).toBeVisible({ timeout: 10000 });
    const closeBtn = page.getByRole('button', { name: 'Close modal' });
    if (await closeBtn.isVisible()) { await closeBtn.click(); }
    await badCampaignCard.click();

    // 1.3 User Disposes -> REJECT (Loop Back)
    await expect(page.getByRole('heading', { name: 'Bad Music Video Idea' })).toBeVisible();
    const backBtn = page.locator('button:has(svg.lucide-arrow-left)').first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Verify we are back at start
    await expect(createBtn).toBeVisible();

    // 1.4 Agent Proposes (Attempt 2 - Good Plan)
    await createBtn.click();
    await page.getByTestId('campaign-title-input').fill('Dogs Having Fun Video');
    await page.getByTestId('campaign-description-input').fill('A viral music video.');
    await page.getByTestId('create-campaign-submit-btn').click();

    const goodCampaignCard = page.getByRole('heading', { name: 'Dogs Having Fun Video' }).first();
    await expect(goodCampaignCard).toBeVisible({ timeout: 10000 });
    if (await closeBtn.isVisible()) { await closeBtn.click(); }
    await goodCampaignCard.click();

    // 1.5 User Disposes -> APPROVE (Execute)
    await expect(page.getByRole('heading', { name: 'Dogs Having Fun Video' })).toBeVisible();
    const executeBtn = page.getByRole('button', { name: 'Execute Campaign' });
    await expect(executeBtn).toBeEnabled();
    await executeBtn.click();

    // 1.6 Verify Transition to Execution
    await expect(page.getByText('Processing...')).toBeVisible();


    // -----------------------------------------------------------------------
    // PHASE 2: HANDOFF & GENERATION (Agent Lens <-> User)
    // -----------------------------------------------------------------------
    // Simulating "Processing" completion and asset generation.

    await page.evaluate(() => {
      const mockHistory = [
        {
          id: 'mock-song-1',
          type: 'audio',
          url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          prompt: 'Dogs Having Fun Song',
          timestamp: Date.now()
        },
        {
           id: 'mock-video-1',
           type: 'video',
           url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
           prompt: 'Dogs Running',
           timestamp: Date.now()
        }
      ];

      // @ts-expect-error - Mocking partial store state
      window.useStore.setState({
        generatedHistory: mockHistory
      });
    });

    // -----------------------------------------------------------------------
    // PHASE 3: EDITING & REVIEW (User <-> Editor Tool)
    // -----------------------------------------------------------------------

    // Navigate Back to HQ
    const returnToHQ = page.getByRole('button', { name: 'Return to HQ' });
    if (await returnToHQ.isVisible()) {
        await returnToHQ.click();
    } else {
        await page.goto('/');
    }

    // Wait for "Quick Launch" or check if we are already in Video Production
    // If we were in Campaign processing, we went back to HQ.
    // If the navigation failed, we might still be in Video Production (from previous failed run context? no, beforeEach resets)
    // Wait for HQ dashboard
    await expect(page.getByText('Quick Launch')).toBeVisible({ timeout: 15000 });

    // Navigate to Video Production using generic locator
    // We check for "Video Studio" or "Video Production" or "Video Producer"
    const videoButton = page.getByRole('button', { name: /Video (Producer|Studio|Production)/ }).first();
    await expect(videoButton).toBeVisible();
    await videoButton.click();

    // We are now on "Video Producer" page.
    // Check if we need to switch to Editor Mode.
    // The page heading "Video Producer" confirms we are there.
    // Check for "Director" / "Editor" toggle.
    const editorToggle = page.getByRole('button', { name: 'Editor' });
    await expect(editorToggle).toBeVisible({ timeout: 15000 });
    await editorToggle.click();

    await expect(page.getByText('Studio Editor')).toBeVisible({ timeout: 15000 });

    // Verify Handoff (Assets available)
    const assetsTab = page.locator('button[title="Assets Library"]');
    await expect(assetsTab).toBeVisible({ timeout: 10000 });
    await assetsTab.click();

    const songAsset = page.getByText('Dogs Having Fun Song');
    await expect(songAsset).toBeVisible();

    // -----------------------------------------------------------------------
    // PHASE 4: PUBLISH (User Final Approval)
    // -----------------------------------------------------------------------

    // Assemble (Drag & Drop)
    const timeline = page.locator('.custom-scrollbar').last();
    const mockDropData = JSON.stringify({
          id: 'mock-song-1',
          type: 'audio',
          url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          prompt: 'Dogs Having Fun Song',
          timestamp: Date.now()
    });

    const timelineHandle = await timeline.elementHandle();
    await page.evaluate(({ timeline, data }) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('application/json', data);
        const event = new DragEvent('drop', {
            bubbles: true, cancelable: true, dataTransfer: dataTransfer,
            clientX: 200, clientY: 200
        });
        timeline?.dispatchEvent(event);
    }, { timeline: timelineHandle, data: mockDropData });

    // Verify Assembly
    await expect(page.getByText('Dogs Having Fun Song').last()).toBeVisible();

    // Publish (Approve)
    const exportBtn = page.getByTestId('video-export-btn');
    await expect(exportBtn).toBeVisible();

    // Mock Network
    await page.route('**/renderVideo', async route => {
       await route.fulfill({
         status: 200,
         contentType: 'application/json',
         body: JSON.stringify({ data: { success: true, renderId: 'mock-render-123' } })
       });
    });

    await exportBtn.click();

    // Final Success Verification
    await expect(page.getByText('Cloud render started successfully!')).toBeVisible({ timeout: 5000 });
  });
});
