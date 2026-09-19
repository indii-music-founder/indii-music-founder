import path from 'node:path';
import { test, expect } from './fixtures/auth';

/**
 * Creative Studio E2E Tests
 * Optimized for CI/CD stability, strict locator compliance, and deep workflow validation.
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

        await page.waitForSelector('[data-testid="app-container"]', { timeout: 30_000 });
        await page.evaluate(() => {
            const store = (window as any).useStore;
            if (store) {
                store.getState().setModule('creative');
            }
        });
        await expect(page.getByTestId('creative-studio-container')).toBeVisible({ timeout: 30_000 });
    });

    test('image generation flow: prompt -> generate -> display', async ({ authedPage: page }) => {
        // Ensure direct generation view or switch to direct mode
        await page.evaluate(() => {
            const store = (window as any).useStore;
            if (store) {
                store.getState().setViewMode('direct');
            }
        });

        const promptInput = page.getByTestId('direct-prompt-input');
        await expect(promptInput).toBeVisible({ timeout: 10_000 });
        await promptInput.fill('A cyberpunk city skyline at night, neon lights');

        const generateBtn = page.getByTestId('direct-generate-btn');
        await expect(generateBtn).toBeVisible();
        await generateBtn.click();

        // Canvas base layer must be mounted
        const infiniteCanvas = page.getByTestId('infinite-canvas-surface');
        await expect(infiniteCanvas).toBeVisible({ timeout: 15_000 });
        
        // Assert generation state completed
        await expect.poll(() => page.evaluate(() => {
            return (window as any).useStore?.getState().isGenerating;
        })).toBe(false);
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
        await expect(page.getByTestId('infinite-canvas-outpaint-prompt')).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();

        await page.getByRole('button', { name: 'Adaptive Crop & Fill' }).click();
        await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
        await page.mouse.down();
        await page.mouse.move(canvasBox.x + 280, canvasBox.y + 260, { steps: 5 });
        await page.mouse.up();
        await expect(page.getByTestId('infinite-canvas-crop-dialog')).toBeVisible();
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

    test('Brand Assets drawer opens, switches tabs, and closes deterministically', async ({ authedPage: page }) => {
        // Open brand drawer via navbar button
        const brandBtn = page.getByTestId('brand-assets-btn');
        await expect(brandBtn).toBeVisible();
        await brandBtn.click();

        // Drawer must open
        const drawer = page.getByTestId('brand-assets-drawer');
        await expect(drawer).toBeVisible({ timeout: 5000 });

        // Switch to Generate Intelligence tab
        const genTab = drawer.getByRole('button', { name: 'Generate Intelligence' });
        await expect(genTab).toBeVisible();
        await genTab.click();

        // Switch back to Upload tab
        const uploadTab = drawer.getByRole('button', { name: 'Upload' });
        await expect(uploadTab).toBeVisible();
        await uploadTab.click();

        // Close drawer
        const closeBtn = drawer.getByRole('button', { name: 'Close brand assets' });
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await expect(drawer).toHaveCount(0);
    });
});
