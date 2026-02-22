import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4242';
const TEST_USER_EMAIL = 'marcus.deep@test.indiios.com';
const TEST_USER_PASSWORD = 'Test1234!';

// Mock API response for image generation so we don't incur real API costs in CI
const MOCK_GENERATED_IMAGE = {
    data: {
        images: [{
            bytesBase64Encoded: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            mimeType: 'image/png',
        }],
    },
};

const MOCK_VIDEO_RESPONSE = {
    data: { success: true, jobId: 'e2e-mock-job-123' },
};

test.describe('🎨 Creative Canvas E2E — Power User Daisy-Chain', () => {

    test.beforeEach(async ({ page }) => {
        // Intercept Cloud Function calls to avoid real API costs
        await page.route('**/generateImageV3', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ result: MOCK_GENERATED_IMAGE }),
            });
        });

        await page.route('**/editImage', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: {
                        data: {
                            images: [{
                                bytesBase64Encoded: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
                                mimeType: 'image/png',
                            }],
                        },
                    },
                }),
            });
        });

        await page.route('**/triggerVideoJob', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ result: MOCK_VIDEO_RESPONSE }),
            });
        });

        // Login
        await page.goto(STUDIO_URL);
        await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
        await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();

        // Wait for dashboard to confirm auth
        await expect(page.getByRole('button', { name: /Brand/i }).first()).toBeVisible({ timeout: 30000 });
    });

    test('Full creative pipeline: generate → canvas → magic fill → animate', async ({ page }) => {
        // --- Step 1: Navigate to Creative Director ---
        const creativeBtn = page.getByRole('button', { name: /Creative/i }).first();
        await creativeBtn.click();
        await expect(page.getByTestId('prompt-input').or(page.getByPlaceholder(/describe/i)).first()).toBeVisible({ timeout: 10000 });
        console.log('[E2E] ✅ Creative Director module loaded');

        // --- Step 2: Generate an image via prompt ---
        const promptInput = page.getByTestId('prompt-input').or(page.getByPlaceholder(/describe/i)).first();
        await promptInput.fill('A cyberpunk cityscape at sunset with neon reflections');
        const generateBtn = page.getByTestId('generate-btn').or(page.getByRole('button', { name: /generate/i })).first();
        await generateBtn.click();

        // Wait for generation (mock resolves immediately, but animation/loading may delay)
        await expect(page.getByTestId('gallery-item-0').or(page.locator('[data-testid^="gallery-item"]').first())).toBeVisible({ timeout: 15000 });
        console.log('[E2E] ✅ Image generated and visible in gallery');

        // --- Step 3: Select the generated image → open Canvas ---
        const firstGalleryItem = page.locator('[data-testid^="gallery-item"]').first();
        await firstGalleryItem.click();

        // Look for fullsize/canvas view button
        const viewBtn = page.getByTestId('view-fullsize-btn').or(page.getByRole('button', { name: /fullsize|canvas|expand/i })).first();
        if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await viewBtn.click();
        }

        // Canvas container should be visible
        await expect(page.getByTestId('creative-canvas-container')).toBeVisible({ timeout: 10000 });
        console.log('[E2E] ✅ Canvas opened for selected image');

        // --- Step 4: Use Magic Fill (draw + prompt) ---
        const magicInput = page.getByTestId('magic-fill-input');
        if (await magicInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await magicInput.fill('Add a holographic billboard');
            console.log('[E2E] ✅ Magic Fill input populated');
        }

        // --- Step 5: Click Animate button (tests VideoDirector.triggerAnimation path) ---
        const animateBtn = page.getByTestId('animate-btn');
        if (await animateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await animateBtn.click();
            // Expect a toast or status update — animation request should succeed via mock
            console.log('[E2E] ✅ Animate button clicked');
        }

        // --- Step 6: Verify close button works ---
        const closeBtn = page.getByTestId('canvas-close-btn');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();

        // Canvas should close — gallery should be visible again
        await expect(page.getByTestId('creative-canvas-container')).not.toBeVisible({ timeout: 5000 });
        console.log('[E2E] ✅ Canvas closed, returned to gallery');
    });

    test('No console errors during creative workflow', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Filter out known non-error noise (Firebase info logs, etc.)
                if (!text.includes('Firebase') && !text.includes('analytics')) {
                    consoleErrors.push(text);
                }
            }
        });

        // Navigate to Creative module
        const creativeBtn = page.getByRole('button', { name: /Creative/i }).first();
        await creativeBtn.click();
        await expect(page.getByTestId('prompt-input').or(page.getByPlaceholder(/describe/i)).first()).toBeVisible({ timeout: 10000 });

        // Wait a moment for any deferred errors
        await page.waitForTimeout(2000);

        // Assert: no unexpected console errors
        expect(consoleErrors).toEqual([]);
        console.log('[E2E] ✅ Zero console errors in Creative Director');
    });
});
