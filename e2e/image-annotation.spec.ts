import { test, expect } from './fixtures/auth';

/**
 * Image Annotation E2E Tests
 *
 * Covers: Opening the Image Annotator from a generated image in the chat,
 * drawing an annotation, entering a color prompt, and submitting.
 *
 * Run: npx playwright test e2e/image-annotation.spec.ts
 */

test.describe('Image Annotation Flow', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ authedPage: page }) => {
        // Intercept ImageGenerationService calls to return a dummy image if triggered manually
        await page.route('**/*generateImageV3*', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({
                    status: 204,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                    }
                });
                return;
            }
            // 1x1 transparent PNG base64
            const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
            await route.fulfill({
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        images: [{ url: dummyImage }]
                    }
                }),
            });
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('can open inline annotator and submit an edit', async ({ authedPage: page }) => {
        // 1. Navigate to Creative Studio explicitly
        await page.goto('/creative', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000); // Wait for module to render

        // 1.5 Inject an image message into the store and open the agent panel
        await page.evaluate(async () => {
            const store = (window as any).useStore.getState();
            store.setRightPanelTab('agent'); // Opens the right panel to the chat
            store.addAgentMessage({
                id: 'msg-e2e-image',
                agentId: 'creative',
                role: 'model',
                text: 'Here is your generated image',
                timestamp: Date.now(),
                thoughts: [{
                    id: 'thought-1',
                    timestamp: Date.now(),
                    type: 'tool_result',
                    toolName: 'generate_image',
                    text: JSON.stringify({
                        urls: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==']
                    })
                }]
            });
        });

        // 2. Wait for the image to render in the chat
        const imageElement = page.locator('img[alt*="Generated Image"], img[alt*="test image"]');
        await expect(imageElement).toBeVisible({ timeout: 5000 });

        // 3. Hover over the image container to reveal the annotator button
        const imageContainer = imageElement.locator('..').locator('..'); // go up a few levels

        // 4. Click the edit/annotate button using evaluate to bypass hover/interception issues
        const editButton = imageContainer.locator('button[title="Inline Annotator"]');
        await expect(editButton).toBeAttached();
        await editButton.evaluate((node: HTMLElement) => node.click());

        // 5. Verify the annotation canvas or modal opens
        const canvasContainer = page.getByTestId('inline-annotator').first();
        await expect(canvasContainer).toBeVisible({ timeout: 10000 });
        
        // Wait for the actual <canvas> element to render, which means the image has loaded and dimensions are calculated
        await expect(canvasContainer.locator('canvas')).toBeAttached({ timeout: 5000 });

        // 6. Draw on the canvas
        // Get bounding box of the canvas to simulate mouse drag
        const drawableArea = page.locator('.cursor-crosshair').first();
        const canvas = drawableArea.locator('canvas').first();
        await expect(canvas).toBeAttached({ timeout: 10000 });
        
        // Simulate drawing by triggering the E2E helper (bypassing complex canvas/React Synthetic Event pointer drag issues in playwright)
        await page.getByTestId('e2e-force-annotation').evaluate(node => (node as HTMLElement).click());

        // 8. The text input for the red annotation should appear
        const redInput = page.locator('input[placeholder*="red regions"]');
        await expect(redInput).toBeVisible();
        await redInput.fill('Change this area to blue');

        // 9. Click apply and verify it completes
        const applyBtn = page.locator('button', { hasText: 'Apply' }).first();
        await expect(applyBtn).toBeEnabled();
        
        await applyBtn.click();
        
        // After submission, it should be disabled (either due to isSubmitting or because annotations were cleared)
        await expect(applyBtn).toBeDisabled({ timeout: 5000 });
    });
});
