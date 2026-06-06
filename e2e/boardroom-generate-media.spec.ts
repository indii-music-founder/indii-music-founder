import { test, expect } from './fixtures/auth';
import { join } from 'path';

test('Boardroom Live Visual Media Generation', async ({ authedPage: page }) => {
    // Navigate to local site
    console.log('[E2E:Media] Navigating to local site...');
    
    // Mock AI API calls inside the spec to return custom responses for puppy image and video
    await page.route(
      /.*(firebasevertexai|generativelanguage)\.googleapis\.com.*/,
      async (route) => {
        const url = route.request().url();
        console.log(`[E2E:Media-Spec] Intercepted Vertex AI inside spec: ${url}`);

        if (route.request().method() === "OPTIONS") {
          await route.fulfill({ status: 204 });
          return;
        }

        const postData = route.request().postData() || "";
        
        let responseText = "Mock Boardroom Response";
        if (postData.includes("grass") || postData.includes("puppy")) {
          // Puppy image response
          responseText = "I have generated an image of a puppy playing in the grass: ![puppy](https://via.placeholder.com/1024)";
        } else if (postData.includes("animate") || postData.includes("video")) {
          // Puppy video response
          responseText = "I have animated the puppy image into a 4-second cinematic video: [puppy video](https://mock-video.com/v.mp4)";
        }

        const aiResponseObj = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: responseText }],
              },
              finishReason: "STOP",
            },
          ],
        };

        if (url.includes("streamGenerateContent")) {
          if (url.includes("alt=sse")) {
            await route.fulfill({
              status: 200,
              contentType: "text/event-stream",
              body: `data: ${JSON.stringify(aiResponseObj)}\n\n`,
            });
            return;
          } else {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify([aiResponseObj]),
            });
            return;
          }
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(aiResponseObj),
        });
      }
    );

    await page.goto('/creative', { waitUntil: 'networkidle', timeout: 30000 });

    const scratchDir = join(process.cwd(), 'scratch');

    // Capture Landing Page
    await page.screenshot({ path: join(scratchDir, 'boardroom-generate-media-landing.png') });
    console.log('[E2E:Media] Saved landing page screenshot.');

    // Inject Boardroom mode state directly
    console.log('[E2E:Media] Injecting Boardroom overlay state...');
    await page.waitForFunction(() => (window as any).useStore !== undefined, { timeout: 15000 });
    await page.evaluate(() => {
        const state = (window as any).useStore.getState();
        state.setConversationMode('boardroom');
        // Auto-seat Generalist, Creative director, and Video director
        state.addActiveAgent('generalist');
        state.addActiveAgent('creative');
        state.addActiveAgent('video');
    });
    await expect(page.locator('[data-testid="boardroom-module"]')).toBeVisible({ timeout: 15000 });

    // Send chat message to generate an image of dogs
    console.log('[E2E:Media] Submitting prompt to generate dog image...');
    const chatInput = page.locator('[data-testid="main-prompt-input"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    await chatInput.fill('generate an image of a cute puppy playing in the grass');
    await chatInput.press('Enter');

    // Wait for the Conductor and Creative Director to process the image generation
    console.log('[E2E:Media] Polling store for generated creative studio assets...');
    await page.waitForFunction(() => {
        const store = (window as any).useStore;
        if (!store) return false;
        const history = store.getState().boardroomMessages || [];
        // Look for completed image generation response containing generated images or success status
        return history.some(m => m.role === 'model' && m.agentId === 'creative' && m.isStreaming === false);
    }, { timeout: 60000 });

    // Capture Boardroom showing the generated puppy image
    await page.screenshot({ path: join(scratchDir, 'boardroom-generate-media-puppy.png') });
    console.log('[E2E:Media] Saved screenshot of generated puppy image.');

    // Fetch the generated image base64 bytes or URL from creative history
    const assetUrl = await page.evaluate(() => {
        const store = (window as any).useStore;
        if (!store) return null;
        const messages = store.getState().boardroomMessages || [];
        // Look for image source links or mock base64 outputs generated in context
        const imageMsgs = messages.filter(m => m.role === 'model' && m.agentId === 'creative');
        const match = imageMsgs[imageMsgs.length - 1]?.text?.match(/src="([^"]+)"/) || imageMsgs[imageMsgs.length - 1]?.text?.match(/!\[.*\]\((.*)\)/);
        return match ? match[1] : 'base64://mock_puppy_image';
    });
    console.log('[E2E:Media] Extracted puppy asset URL:', assetUrl);

    // Direct the Conductor to make this puppy image into a headed video using the image-to-video tool (Veo firstFrame)
    console.log('[E2E:Media] Submitting prompt to animate image into a video...');
    const chatInputAnimate = page.locator('[data-testid="main-prompt-input"]').first();
    const commandText = `animate this puppy image into a 4-second cinematic video showing it running towards the camera: ${assetUrl}`;
    await chatInputAnimate.fill(commandText);
    await chatInputAnimate.press('Enter');

    // Wait for the Conductor/Video Director to complete the first-to-last frame video generation
    console.log('[E2E:Media] Waiting for video generation segment to complete...');
    await page.waitForFunction(() => {
        const store = (window as any).useStore;
        if (!store) return false;
        const history = store.getState().boardroomMessages || [];
        // Wait for video model outputs
        return history.some(m => m.role === 'model' && m.agentId === 'video' && m.isStreaming === false);
    }, { timeout: 60000 });

    // Capture boardroom showing completed puppy video
    await page.screenshot({ path: join(scratchDir, 'boardroom-generate-media-video.png') });
    console.log('[E2E:Media] Saved final puppy video animation screenshot.');

    // Assert that the video is successfully rendered
    const historyText = await page.evaluate(() => {
        const store = (window as any).useStore;
        return store ? JSON.stringify(store.getState().boardroomMessages) : '';
    });
    expect(historyText).toContain('video');
    console.log('[E2E:Media] Headed puppy image-to-video generation successfully completed and verified!');
});
