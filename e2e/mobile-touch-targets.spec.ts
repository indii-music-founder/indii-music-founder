import { test, expect } from '@playwright/test';

// Viewport's Mobile Spec: Fat Finger & Touch Targets
// Device: iPhone X (375x812)
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;

test.describe('📱 Viewport: Mobile Touch Targets', () => {
    test.use({
        viewport: { width: MOBILE_WIDTH, height: MOBILE_HEIGHT },
        hasTouch: true,
        isMobile: true
    });

    test.beforeEach(async ({ page, context }) => {
        // 1. Bypass Auth
        await context.addInitScript(() => {
            localStorage.setItem('TEST_MODE', 'true');
        });

        // 2. Navigate
        await page.goto('/');

        // 3. Handle Login (if needed)
        try {
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 3000 });
        } catch (e) {
            const guestLoginBtn = page.getByText('Guest Login (Dev)');
            if (await guestLoginBtn.isVisible()) {
                await guestLoginBtn.click();
            }
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
        }
    });

    test('Send button should be at least 44x44px', async ({ page }) => {
        // Find the Send button (Run command)
        // It's wrapped in a tooltip "Run command", so it should have that aria-label
        const sendButton = page.locator('button[aria-label="Run command"]');

        // Wait for it to be visible
        await expect(sendButton).toBeVisible();

        // Get bounding box
        const box = await sendButton.boundingBox();
        expect(box).not.toBeNull();

        console.log(`📱 Send Button Size: ${box?.width}x${box?.height}`);

        // Assert size
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    test('Dock/Detach button should be at least 44x44px', async ({ page }) => {
        // Find the button. It defaults to "Detach from Agent" or "Dock to Agent"
        const dockButton = page.locator('button[aria-label="Detach from Agent"], button[aria-label="Dock to Agent"]');

        await expect(dockButton).toBeVisible();

        const box = await dockButton.boundingBox();
        expect(box).not.toBeNull();

        console.log(`📱 Dock Button Size: ${box?.width}x${box?.height}`);

        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    test('Input textarea should have accessible text size and touch target', async ({ page }) => {
        const textarea = page.locator('textarea');
        await expect(textarea).toBeVisible();

        // Check Font Size (16px prevents zoom on iOS)
        const fontSize = await textarea.evaluate((el) => {
            return window.getComputedStyle(el).fontSize;
        });

        console.log(`📱 Textarea Font Size: ${fontSize}`);
        expect(fontSize).toBe('16px'); // Tailwind text-base is usually 16px (1rem)

        // Check Height (should be easy to tap)
        const box = await textarea.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
    });
});
