import { test, expect } from './fixtures/auth';

/**
 * Image Annotation E2E Tests
 *
 * Covers: Opening the Image Annotator from a generated image in the chat,
 * drawing an annotation on the canvas, entering a color prompt, and submitting.
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
        await page.waitForTimeout(1000);

        // 2. Inject an image message into the store and open the agent panel
        await page.evaluate(async () => {
            const store = (window as any).useStore.getState();
            store.setRightPanelTab('agent');
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

        // 3. Wait for the image to render in the chat
        const imageElement = page.locator('img[alt*="Generated Image"], img[alt*="test image"]').first(); // bypass-strict: chat feed can contain multiple rendered previews
        await expect(imageElement).toBeVisible({ timeout: 5000 });

        // 4. Click the edit/annotate button
        const imageContainer = imageElement.locator('..').locator('..');
        const editButton = imageContainer.locator('button[title="Inline Annotator"]');
        await expect(editButton).toBeAttached();
        await editButton.evaluate((node: HTMLElement) => node.click());

        // 5. Verify the annotation canvas modal opens
        const annotator = page.getByTestId('inline-annotator');
        await expect(annotator).toBeVisible({ timeout: 10000 });
        
        // 6. Wait for canvas element to render
        const drawableArea = annotator.locator('.cursor-crosshair');
        await expect(drawableArea).toBeVisible({ timeout: 5000 });
        const canvas = drawableArea.locator('canvas');
        await expect(canvas).toBeAttached({ timeout: 10000 });
        
        // 7. Draw through pointer simulation
        const box = await drawableArea.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box!.x + box!.width * 0.55, box!.y + box!.height * 0.5, { steps: 5 });
        await page.mouse.up();

        // 8. The text input for the red annotation should appear
        const redInput = annotator.locator('input[placeholder*="red regions"]');
        await expect(redInput).toBeVisible();
        await redInput.fill('Change this area to blue');

        // 9. Click apply and verify it completes
        const applyBtn = annotator.getByRole('button', { name: /Apply Edits/ });
        await expect(applyBtn).toBeEnabled();
        await applyBtn.click();
        
        // After submission, it should be disabled
        await expect(applyBtn).toBeDisabled({ timeout: 5000 });
    });
});
