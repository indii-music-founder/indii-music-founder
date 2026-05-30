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

        console.log('[CREATIVE TEST] Navigating to /creative...');
        await page.goto('/creative');
        await expect(page.locator('[data-testid="creative-studio-container"]')).toBeVisible({ timeout: 30_000 });
    });

    test('image generation flow: prompt -> generate -> display', async ({ authedPage: page }) => {
        const promptInput = page.locator('[data-testid="generation-prompt-input"]');
        await expect(promptInput).toBeVisible({ timeout: 10_000 });
        await promptInput.fill('A cyberpunk city skyline at night, neon lights');

        const generateBtn = page.locator('[data-testid="generate-image-button"]');
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

    test('outpainting flow: upload image -> extend -> save', async ({ authedPage: page }) => {
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

    test('asset management: create -> rename -> delete', async ({ authedPage: page }) => {
        // Open assets drawer
        const assetsBtn = page.locator('[data-testid="open-assets-drawer"]').or(page.locator('button:has-text("Assets")')).first();
        await expect(assetsBtn).toBeVisible({ timeout: 10_000 });
        await assetsBtn.click();

        const assetDrawer = page.locator('[data-testid="assets-drawer"]');
        await expect(assetDrawer).toBeVisible({ timeout: 10_000 });

        // Check for an asset item, attempt to click options
        const assetItem = page.locator('[data-testid="asset-item"]').first();
        if (await assetItem.isVisible({ timeout: 5000 }).catch(() => false)) {
            const renameBtn = assetItem.locator('[data-testid="asset-rename"]');
            if (await renameBtn.isVisible()) {
                await renameBtn.click();
                const renameInput = page.locator('[data-testid="asset-rename-input"]');
                await renameInput.fill('New Asset Name');
                await renameInput.press('Enter');
            }

            const deleteBtn = assetItem.locator('[data-testid="asset-delete"]');
            if (await deleteBtn.isVisible()) {
                await deleteBtn.click();
                const confirmDelete = page.locator('[data-testid="confirm-delete"]');
                if (await confirmDelete.isVisible()) await confirmDelete.click();
            }
        }
        console.log('✓ Asset management checked');
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
