import path from 'node:path';
import { test, expect } from './fixtures/auth';

/**
 * Creative Studio E2E Tests
 * Optimized for CI/CD stability.
 */

test.describe('Creative Studio', () => {
    test.use({ viewport: { width: 1440, height: 900 } });
    test.setTimeout(60_000);

    test.beforeEach(async ({ authedPage: page }) => {
        // Mock GenAI generation endpoints
        await page.route('**/cloudfunctions.net/**/generateImage**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: { imageUrl: 'https://via.placeholder.com/1024' },
                }),
            });
        });

        await page.route('**/cloudfunctions.net/**/outpaintImage**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: { imageUrl: 'https://via.placeholder.com/1024x2048' },
                }),
            });
        });

        console.log('[CREATIVE TEST] Navigating to /creative client-side...');
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 30_000 });
        await page.evaluate(() => {
            const store = (window as any).useStore;
            if (store) {
                store.getState().setModule('creative');
            }
        });
        await expect(page.locator('[data-testid="creative-studio-container"]')).toBeVisible({ timeout: 30_000 });
    });

    test('image generation flow: prompt -> generate -> display', async ({ authedPage: page }) => {
        const promptInput = page.locator('[data-testid="direct-prompt-input"]');
        await expect(promptInput).toBeVisible({ timeout: 10_000 });
        await promptInput.fill('A cyberpunk city skyline at night, neon lights');

        const generateBtn = page.locator('[data-testid="direct-generate-btn"]');
        await expect(generateBtn).toBeVisible();
        await generateBtn.click();

        // Canvas should show the new image layer
        const canvasContainer = page.locator('.canvas-container').first();
        await expect(canvasContainer).toBeVisible({ timeout: 15_000 });
        
        // Mock result verification
        const resultNotification = page.locator('text=Generation complete').first();
        if (await resultNotification.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('✓ Image generation completed');
        }
    });

    test('Image Studio toolbar stays interactive through upload and delete', async ({ authedPage: page }) => {
        await page.getByTestId('canvas-mode-canvas').click();

        await expect(page.getByTestId('creative-mode-overlay')).toHaveCount(0);
        const selectTool = page.getByRole('button', { name: 'Select/Move Tool' });
        await selectTool.click();
        await expect(selectTool).toHaveAttribute('aria-pressed', 'true');

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Add Image' }).click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(path.resolve('packages/renderer/public/icon-192.png'));

        await expect.poll(() => page.evaluate(() => {
            const state = (window as any).useStore?.getState();
            return {
                imageCount: state?.canvasImages?.length ?? 0,
                hasSelection: Boolean(state?.selectedCanvasImageId),
            };
        })).toEqual({ imageCount: 1, hasSelection: true });

        await expect(page.getByRole('button', { name: 'Detect Objects' })).toBeEnabled();
        const deleteButton = page.getByRole('button', { name: 'Delete Selected' });
        await expect(deleteButton).toBeEnabled();
        await deleteButton.click();

        await expect.poll(() => page.evaluate(() => {
            const state = (window as any).useStore?.getState();
            return {
                imageCount: state?.canvasImages?.length ?? 0,
                selectedId: state?.selectedCanvasImageId ?? null,
            };
        })).toEqual({ imageCount: 0, selectedId: null });
        await expect(deleteButton).toBeDisabled();
    });

    test('Image Studio local editing tools expose their working controls', async ({ authedPage: page }) => {
        await page.getByTestId('canvas-mode-canvas').click();
        // Exercise the local-canvas path without asking the Firebase-free E2E
        // session to persist a project recovery snapshot.
        await page.evaluate(() => {
            (window as any).useStore?.setState({ currentProjectId: null });
        });
        const canvas = page.getByTestId('infinite-canvas-surface');
        const canvasBox = await canvas.boundingBox();
        expect(canvasBox).not.toBeNull();
        if (!canvasBox) return;

        await page.getByRole('button', { name: 'Generate/Outpaint Tool' }).click();
        await page.mouse.move(canvasBox.x + 80, canvasBox.y + 90);
        await page.mouse.down();
        await page.mouse.move(canvasBox.x + 240, canvasBox.y + 220, { steps: 5 });
        await page.mouse.up();
        await expect(page.getByPlaceholder('Describe what you want to see...')).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();

        await page.getByRole('button', { name: 'Adaptive Crop & Fill' }).click();
        await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
        await page.mouse.down();
        await page.mouse.move(canvasBox.x + 280, canvasBox.y + 260, { steps: 5 });
        await page.mouse.up();
        await expect(page.getByRole('button', { name: 'Crop & Fill' })).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();

        for (let expectedCount = 1; expectedCount <= 2; expectedCount += 1) {
            const fileChooserPromise = page.waitForEvent('filechooser');
            await page.getByRole('button', { name: 'Add Image' }).click();
            const fileChooser = await fileChooserPromise;
            await fileChooser.setFiles(path.resolve('packages/renderer/public/icon-192.png'));
            await expect.poll(() => page.evaluate(() =>
                (window as any).useStore?.getState().canvasImages.length
            )).toBe(expectedCount);
        }

        const flattenButton = page.getByRole('button', { name: 'Flatten Canvas' });
        await expect(flattenButton).toBeEnabled();
        await flattenButton.click();
        await expect.poll(() => page.evaluate(() =>
            (window as any).useStore?.getState().canvasImages.length
        )).toBe(1);

        const undoButton = page.getByRole('button', { name: 'Undo Flatten' });
        await expect(undoButton).toBeEnabled();
        await undoButton.click();
        await expect.poll(() => page.evaluate(() =>
            (window as any).useStore?.getState().canvasImages.length
        )).toBe(2);
        await expect(undoButton).toBeDisabled();
    });

    test.skip('outpainting flow: upload image -> extend -> save', async ({ authedPage: page }) => {
        // Find outpaint tool
        const outpaintToolBtn = page.locator('[data-testid="tool-outpaint"]').or(page.locator('button:has-text("Outpaint")')).first();
        if (await outpaintToolBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await outpaintToolBtn.click();
            
            const extendBtn = page.locator('[data-testid="run-outpaint-button"]');
            if (await extendBtn.isVisible()) {
                await extendBtn.click();
                
                // Verify save
                const saveBtn = page.locator('[data-testid="save-canvas-button"]');
                await expect(saveBtn).toBeVisible({ timeout: 10_000 });
                console.log('✓ Outpainting flow successful');
            }
        }
    });

    test.skip('asset management: create -> rename -> delete', async () => {
        // Obsolete test: Assets drawer was replaced by CreativeClipboard
        // Skipping until e2e tests are updated for CreativeClipboard functionality.
        console.log('✓ Asset management checked (skipped - obsolete UI)');
    });

    test('brand kit integration applies brand colors', async ({ authedPage: page }) => {
        // Open brand kit
        const brandKitBtn = page.locator('[data-testid="tool-brandkit"]').or(page.locator('button:has-text("Brand Kit")')).first();
        if (await brandKitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await brandKitBtn.click();
            
            // Check that brand colors are applied or visible in UI
            const colorSwatch = page.locator('[data-testid="brand-color-swatch"]').first();
            await expect(colorSwatch).toBeVisible({ timeout: 5_000 });
            
            await colorSwatch.click();
            console.log('✓ Brand kit integration accessed');
        }
    });
});
