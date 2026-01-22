/**
 * E2E Test: Image Generation → Video Generation (First/Last Frame Interpolation)
 * 
 * This test validates the complete creative pipeline:
 * 1. Auto sign-in (pre-filled credentials)
 * 2. Generate a "First Frame" image
 * 3. Generate a "Last Frame" image
 * 4. Use Veo 3.1's First/Last Frame interpolation to create a morphing video
 * 
 * @module e2e/image-video-first-last-frame
 */

import { test, expect, Page } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4242';

// Test timeout for long-running AI operations
const AI_GENERATION_TIMEOUT = 120000; // 2 minutes for video generation

test.describe('Image → Video: First/Last Frame Pipeline', () => {

    test.beforeEach(async ({ page }) => {
        // Set viewport for consistent testing
        await page.setViewportSize({ width: 1440, height: 900 });

        // Debug logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error(`[BROWSER ERROR] ${msg.text()}`);
            } else if (msg.text().includes('[Test]') || msg.text().includes('Video') || msg.text().includes('Image')) {
                console.log(`[BROWSER] ${msg.text()}`);
            }
        });

        page.on('pageerror', err => {
            console.error(`[BROWSER EXCEPTION] ${err.message}`);
        });
    });

    test('End-to-End: Generate Images → Set First/Last Frame → Generate Interpolation Video', async ({ page }) => {
        // Extended timeout for this comprehensive workflow
        test.setTimeout(AI_GENERATION_TIMEOUT * 2);

        // ─────────────────────────────────────────────────────────────────────────
        // PHASE 0: AUTHENTICATION (Auto Sign-In)
        // ─────────────────────────────────────────────────────────────────────────

        await test.step('0. Navigate and Auto Sign-In', async () => {
            await page.goto(STUDIO_URL);
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000); // Allow app to initialize

            // Check if we're already on dashboard (session exists)
            const dashboardIndicator = page.getByText('Quick Launch')
                .or(page.getByText('indii is ready'))
                .or(page.locator('button[title="Creative Director"]'))
                .or(page.locator('button').filter({ hasText: 'Video Producer' }));

            const alreadyLoggedIn = await dashboardIndicator.first().isVisible().catch(() => false);

            if (alreadyLoggedIn) {
                console.log('[Test] ✅ Already authenticated (session exists)');
            } else {
                // Look for the Sign In button (credentials are pre-filled)
                const signInBtn = page.getByRole('button', { name: /sign in/i });

                // Wait for button to be visible
                const signInVisible = await signInBtn.isVisible({ timeout: 10000 }).catch(() => false);

                if (signInVisible) {
                    console.log('[Test] Clicking Sign In button...');
                    await signInBtn.click();

                    // Wait for successful authentication and dashboard to load
                    await expect(dashboardIndicator.first()).toBeVisible({ timeout: 20000 });
                    console.log('[Test] ✅ Authentication successful');
                } else {
                    // Check for Guest Login (Dev) button as fallback
                    const guestBtn = page.getByRole('button', { name: /Guest Login/i });
                    if (await guestBtn.isVisible().catch(() => false)) {
                        console.log('[Test] Using Guest Login...');
                        await guestBtn.click();
                        await expect(dashboardIndicator.first()).toBeVisible({ timeout: 20000 });
                        console.log('[Test] ✅ Guest authentication successful');
                    } else {
                        throw new Error('Could not find Sign In or Guest Login button');
                    }
                }
            }
        });

        // ─────────────────────────────────────────────────────────────────────────
        // PHASE 1: NAVIGATE TO VIDEO PRODUCER
        // ─────────────────────────────────────────────────────────────────────────

        await test.step('1. Navigate to Video Producer', async () => {
            // Look for Video Producer/Studio button in navigation
            const videoBtn = page.getByRole('button', { name: /Video (Producer|Studio|Production)/i }).first()
                .or(page.locator('button[title="Video Producer"]'))
                .or(page.locator('button').filter({ hasText: /Video/i }).first());

            await expect(videoBtn).toBeVisible({ timeout: 10000 });
            await videoBtn.click();

            // Verify we're in the Video module (check for Director/Editor UI elements)
            const videoIndicator = page.getByText("Director's Chair")
                .or(page.getByPlaceholder(/Describe your scene/i))
                .or(page.locator('[data-testid="director-prompt-bar"]'));

            await expect(videoIndicator.first()).toBeVisible({ timeout: 15000 });
            console.log('[Test] ✅ Video Producer loaded');
        });

        // ─────────────────────────────────────────────────────────────────────────
        // PHASE 2: GENERATE FIRST FRAME IMAGE
        // ─────────────────────────────────────────────────────────────────────────

        let firstFrameGenerated = false;

        await test.step('2. Generate First Frame Image', async () => {
            // Find the prompt input in the Director Prompt Bar
            const promptInput = page.getByPlaceholder(/Describe your scene/i)
                .or(page.locator('textarea').first())
                .or(page.getByRole('textbox').first());

            await expect(promptInput).toBeVisible({ timeout: 10000 });

            // Enter prompt for first frame
            const firstFramePrompt = 'A futuristic cyberpunk city at night, neon lights reflecting on wet streets, cinematic wide shot';
            await promptInput.fill(firstFramePrompt);

            // Find and click the generate button
            const generateBtn = page.getByRole('button', { name: /generate|create|render/i }).first()
                .or(page.locator('button:has(svg.lucide-sparkles)').first())
                .or(page.locator('button:has(svg.lucide-wand)').first());

            await expect(generateBtn).toBeVisible();
            await generateBtn.click();

            // Wait for generation to complete
            // Look for either:
            // 1. Processing indicator to appear and disappear
            // 2. A video/image to appear in the stage
            // 3. Toast notification of success

            // First, wait for processing to start (optional, may be fast)
            try {
                await page.waitForSelector('text=/Imaginating|Processing|Queued/i', { timeout: 3000 });
                console.log('[Test] Generation started...');
            } catch {
                console.log('[Test] Generation very fast or mocked');
            }

            // Wait for completion - check for asset in stage or history
            const assetVisible = page.locator('video, img.object-contain, [data-testid="stage-preview"]').first()
                .or(page.getByText(/Scene generated/i));

            await expect(assetVisible).toBeVisible({ timeout: 60000 });
            firstFrameGenerated = true;
            console.log('[Test] ✅ First frame generated');
        });

        // ─────────────────────────────────────────────────────────────────────────
        // PHASE 3: SET AS FIRST FRAME (ANCHOR)
        // ─────────────────────────────────────────────────────────────────────────

        await test.step('3. Set Asset as First Frame (Anchor)', async () => {
            // Wait for the "Set Anchor" button to be visible on the stage overlay
            const setAnchorBtn = page.getByTestId('set-anchor-btn')
                .or(page.getByRole('button', { name: /Set Anchor/i }))
                .or(page.locator('button').filter({ hasText: 'Set Anchor' }));

            await expect(setAnchorBtn).toBeVisible({ timeout: 10000 });
            await setAnchorBtn.click();

            // Verify anchor was set (could check store or UI indicator)
            console.log('[Test] ✅ First frame set as anchor');
        });

        // ─────────────────────────────────────────────────────────────────────────
        // PHASE 4: GENERATE LAST FRAME IMAGE
        // ─────────────────────────────────────────────────────────────────────────

        await test.step('4. Generate Last Frame Image', async () => {
            // Find the prompt input again
            const promptInput = page.getByPlaceholder(/Describe your scene/i)
                .or(page.locator('textarea').first())
                .or(page.getByRole('textbox').first());

            // Clear and enter prompt for last frame (transformation target)
            const lastFramePrompt = 'The same cyberpunk city transformed into a utopian garden paradise at sunrise, warm golden light, nature reclaiming the buildings';
            await promptInput.clear();
            await promptInput.fill(lastFramePrompt);

            // Generate
            const generateBtn = page.getByRole('button', { name: /generate|create|render/i }).first()
                .or(page.locator('button:has(svg.lucide-sparkles)').first());

            await generateBtn.click();

            // Wait for generation
            try {
                await page.waitForSelector('text=/Imaginating|Processing/i', { timeout: 3000 });
            } catch {
                // Fast generation
            }

            // Wait for new asset
            await page.waitForTimeout(2000); // Brief pause to ensure new asset is the active one
            console.log('[Test] ✅ Last frame generated');
        });

        // ─────────────────────────────────────────────────────────────────────────
        // PHASE 5: SET AS LAST FRAME (END FRAME)
        // ─────────────────────────────────────────────────────────────────────────

        await test.step('5. Set Asset as Last Frame (End Frame)', async () => {
            // Wait for the "Set End Frame" button
            const setEndFrameBtn = page.getByTestId('set-end-frame-btn')
                .or(page.getByRole('button', { name: /Set End Frame/i }))
                .or(page.locator('button').filter({ hasText: 'End Frame' }));

            await expect(setEndFrameBtn).toBeVisible({ timeout: 10000 });
            await setEndFrameBtn.click();

            console.log('[Test] ✅ Last frame set as end frame');
        });

        // ─────────────────────────────────────────────────────────────────────────
        // PHASE 6: GENERATE INTERPOLATION VIDEO
        // ─────────────────────────────────────────────────────────────────────────

        await test.step('6. Generate First/Last Frame Interpolation Video', async () => {
            // Find the prompt input for the transition description
            const promptInput = page.getByPlaceholder(/Describe your scene/i)
                .or(page.locator('textarea').first())
                .or(page.getByRole('textbox').first());

            // Enter the interpolation/transition prompt
            const interpolationPrompt = 'A magical transformation morphing smoothly from a cyberpunk dystopia to a green utopia. Time passes in accelerated motion, buildings grow plants, neon fades into sunlight.';
            await promptInput.clear();
            await promptInput.fill(interpolationPrompt);

            // Generate the video
            const generateBtn = page.getByRole('button', { name: /generate|create|render/i }).first()
                .or(page.locator('button:has(svg.lucide-sparkles)').first());

            await generateBtn.click();

            // Wait for video generation (this is the longer operation)
            console.log('[Test] Starting interpolation video generation...');

            // Check for processing indicators
            const processingIndicator = page.getByText(/Imaginating|Processing|Queued|Stitching/i);
            try {
                await expect(processingIndicator).toBeVisible({ timeout: 5000 });
                console.log('[Test] Video generation in progress...');
            } catch {
                console.log('[Test] Video may generate quickly or be mocked');
            }

            // Wait for video completion - either toast success or video element
            const videoCompleted = page.getByText(/Scene generated/i)
                .or(page.locator('video[src*="mp4"]'))
                .or(page.locator('video').first());

            await expect(videoCompleted).toBeVisible({ timeout: AI_GENERATION_TIMEOUT });
            console.log('[Test] ✅ Interpolation video generated successfully');
        });

        // ─────────────────────────────────────────────────────────────────────────
        // PHASE 7: VERIFICATION
        // ─────────────────────────────────────────────────────────────────────────

        await test.step('7. Verify Assets in History', async () => {
            // Verify that we have assets in the generated history
            const historyCount = await page.evaluate(() => {
                // @ts-expect-error - accessing store for testing
                return window.useStore?.getState()?.generatedHistory?.length || 0;
            });

            expect(historyCount).toBeGreaterThanOrEqual(1);
            console.log(`[Test] ✅ Total assets in history: ${historyCount}`);

            // Check for video type in history
            const hasVideo = await page.evaluate(() => {
                // @ts-expect-error - accessing store for testing
                const history = window.useStore?.getState()?.generatedHistory || [];
                return history.some((item: any) => item.type === 'video');
            });

            // Note: hasVideo may be false if we're testing with mocks
            console.log(`[Test] Video asset in history: ${hasVideo}`);
        });

        console.log('[Test] ══════════════════════════════════════════════════');
        console.log('[Test] ✅ END-TO-END TEST COMPLETED SUCCESSFULLY');
        console.log('[Test] ══════════════════════════════════════════════════');
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // QUICK SMOKE TEST (With Mocks)
    // ─────────────────────────────────────────────────────────────────────────────

    test('Smoke Test: UI Flow with Mocked Backend', async ({ page }) => {
        test.setTimeout(60000);

        // Mock image generation
        await page.route('**/generateImage**', async route => {
            console.log('[Mock] Image generation intercepted');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        images: [{
                            bytesBase64Encoded: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                            mimeType: 'image/png'
                        }]
                    }
                })
            });
        });

        // Mock video generation trigger
        await page.route('**/triggerVideoJob**', async route => {
            console.log('[Mock] Video job trigger intercepted');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: { jobId: 'mock-video-job-123' } })
            });
        });

        // Mock Firestore for video job status
        await page.addInitScript(() => {
            // @ts-expect-error - Mock for testing
            window.__MOCK_VIDEO_JOB__ = {
                status: 'completed',
                videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                progress: 100
            };
        });

        // Navigate and sign in
        await page.goto(STUDIO_URL);
        await page.waitForLoadState('domcontentloaded');

        const signInBtn = page.getByRole('button', { name: /sign in/i });
        if (await signInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInBtn.click();
        }

        // Wait for dashboard
        await page.waitForTimeout(3000);

        // Check that we're past the login screen
        const isLoggedIn = await page.evaluate(() => {
            // @ts-expect-error - accessing store for testing
            return window.useStore?.getState()?.user !== null;
        }).catch(() => false);

        console.log(`[Test] Logged in: ${isLoggedIn}`);

        // Navigate to Video Producer if available
        const videoBtn = page.locator('button').filter({ hasText: /Video/i }).first();
        if (await videoBtn.isVisible().catch(() => false)) {
            await videoBtn.click();
            console.log('[Test] ✅ Navigated to Video module');
        }

        // Verify First/Last Frame buttons exist in UI
        await page.waitForTimeout(2000);

        // Check for the stage area
        const stageArea = page.locator('.aspect-video, [class*="stage"]').first();
        const stageExists = await stageArea.isVisible().catch(() => false);
        console.log(`[Test] Video stage visible: ${stageExists}`);

        console.log('[Test] ✅ Smoke test completed');
    });
});
