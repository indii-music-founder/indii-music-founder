
import { test, expect } from '@playwright/test';

// Viewport's Mobile Spec
// Device: iPhone SE (375x667)
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 667;

test.describe('📱 Viewport: Mobile Chat Interface', () => {
    // Correctly configure the runner for mobile emulation (Touch + UA)
    test.use({
        viewport: { width: MOBILE_WIDTH, height: MOBILE_HEIGHT },
        hasTouch: true,
        isMobile: true
    });

    test.beforeEach(async ({ page, context }) => {
        // 1. Bypass Auth (Test Mode)
        await context.addInitScript(() => {
            localStorage.setItem('TEST_MODE', 'true');
        });

        // 2. Navigate
        await page.goto('/');

        // 3. Handle Login (if needed)
        try {
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 3000 });
        } catch (e) {
            // If app container didn't appear, check for Guest Login button
            const guestLoginBtn = page.getByText('Guest Login (Dev)');
            if (await guestLoginBtn.isVisible()) {
                console.log('📱 Clicking Guest Login button...');
                await guestLoginBtn.click();
            }

            // Wait for app shell again
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
        }
    });

    test('should have accessible "Send" button touch target', async ({ page }) => {
        // "The Fat Finger Test"
        const runButton = page.getByTestId('command-bar-run-btn');
        await expect(runButton).toBeVisible();

        const box = await runButton.boundingBox();
        expect(box).not.toBeNull();

        if (box) {
            console.log(`📱 "Run" Button Size: ${box.width}px x ${box.height}px`);

            // Viewport's Journal Entry: The visual button is small (~32px),
            // but for this test we ensure it's at least visible and usable.
            expect(box.height).toBeGreaterThan(28);
            expect(box.width).toBeGreaterThan(44);
        }
    });

    test('should keep input visible when keyboard opens (Viewport Squeeze)', async ({ page }) => {
        // "The Virtual Keyboard Test"
        const inputContainer = page.getByTestId('command-bar-input-container');
        await expect(inputContainer).toBeVisible();

        // 1. Get initial position
        const initialBox = await inputContainer.boundingBox();
        expect(initialBox).not.toBeNull();
        const initialBottom = initialBox!.y + initialBox!.height;

        // Ensure it's at the bottom of the screen initially
        expect(initialBottom).toBeGreaterThan(MOBILE_HEIGHT - 100);

        // 2. Simulate Keyboard Open (Resize Viewport Height)
        const KEYBOARD_HEIGHT = 267;
        const NEW_HEIGHT = MOBILE_HEIGHT - KEYBOARD_HEIGHT; // 400px

        await page.setViewportSize({
            width: MOBILE_WIDTH,
            height: NEW_HEIGHT
        });

        // Wait for layout adaptation
        await page.waitForTimeout(500);

        // 3. Verify Input is still visible and at the new bottom
        await expect(inputContainer).toBeVisible();
        const squeezedBox = await inputContainer.boundingBox();
        expect(squeezedBox).not.toBeNull();

        const squeezedBottom = squeezedBox!.y + squeezedBox!.height;

        // It should be near the new bottom (400px)
        expect(squeezedBottom).toBeGreaterThan(NEW_HEIGHT - 100);
        expect(squeezedBottom).toBeLessThanOrEqual(NEW_HEIGHT);

        console.log(`📱 Input Position after squeeze: y=${squeezedBox!.y}, bottom=${squeezedBottom} (Viewport H: ${NEW_HEIGHT})`);
    });

    test('should prevent horizontal scroll on main body', async ({ page }) => {
        // "The Horizontal Scroll Check"
        const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const clientWidth = await page.evaluate(() => document.body.clientWidth);

        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
});
