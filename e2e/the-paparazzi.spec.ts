import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:5173';

test.describe('The Paparazzi: Media Pipeline Verification', () => {

    test('Scenario 1: Vision Analysis Flow', async ({ page }) => {
        // 1. Visit Studio
        await page.goto(STUDIO_URL);

        // 2. Ensure Authentication (Mock or session reuse might be needed depending on config)
        // For now, assuming dev environment with auto-bypass or session.
        // If redirect happens, we fail fast.

        // 3. Locate Input Area
        const input = page.locator('input[type="text"][placeholder*="Describe"]');
        await expect(input).toBeVisible();

        // 4. Simulate File Upload (Hidden Input)
        const fileInput = page.locator('input[type="file"]').first(); // Paperclip input

        // Create a dummy image buffer
        const buffer = Buffer.from('fake-image-content');

        // Set input files
        await fileInput.setInputFiles({
            name: 'test-image.jpg',
            mimeType: 'image/jpeg',
            buffer
        });

        // 5. Verify UI Feedback
        // Check for attachment chip or preview
        await expect(page.locator('text=test-image.jpg')).toBeVisible();

        // 6. Send Message asking to "Analyze this"
        await input.fill('What is in this image?');
        await page.locator('button[type="submit"]').click();

        // 7. Verify Agent Response triggers
        // We look for the "AI" avatar or message bubble
        // This confirms the pipeline accepted the image and started processing
        await expect(page.locator('[data-testid="agent-message"]')).toBeVisible({ timeout: 10000 });

        // 8. (Optional) Verify Vision Tool usage in thoughts if expanded
        // This is a deeper check, but basic presence is good enough for "The Paparazzi" V1.
    });

});
