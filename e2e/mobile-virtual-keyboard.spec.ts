
import { test, expect } from '@playwright/test';

// Viewport's Mobile Spec: Virtual Keyboard Squeeze
// Device: iPhone X (375x812) -> Keyboard Open (~375x450)
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;
const KEYBOARD_HEIGHT = 300; // Approx iOS keyboard
const OPEN_HEIGHT = MOBILE_HEIGHT - KEYBOARD_HEIGHT;

test.describe('📱 Viewport: Virtual Keyboard Squeeze', () => {
    test.use({
        viewport: { width: MOBILE_WIDTH, height: MOBILE_HEIGHT },
        hasTouch: true,
        isMobile: true
    });

    test.beforeEach(async ({ page, context }) => {
        // 1. Bypass Auth (Test Mode)
        await context.addInitScript(() => {
            localStorage.setItem('TEST_MODE', 'true');
            (window as any).__TEST_MODE__ = true;
        });

        // 2. Navigate
        await page.goto('/');

        // 3. Handle Login (if needed)
        try {
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 5000 });
        } catch (e) {
            const guestLoginBtn = page.getByText('Guest Login (Dev)');
            if (await guestLoginBtn.isVisible()) {
                await guestLoginBtn.click();
            }
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
        }

        // 4. Ensure Agent Window is Open
        await page.evaluate(() => {
            // @ts-expect-error - Testing Environment Window Property
            if (window.useStore) {
                // @ts-expect-error - Testing Environment Window Property
                const store = window.useStore.getState();
                if (!store.isAgentOpen) {
                    store.toggleAgentWindow();
                }
            }
        });

        // Wait for agent to appear
        await expect(page.getByText('How can I help you?')).toBeVisible();
    });

    test('should keep input visible and resize chat when keyboard opens', async ({ page }) => {
        // Locate the Input Container
        const inputContainer = page.getByTestId('command-bar-input-container');
        await expect(inputContainer).toBeVisible();

        // Locate the Chat/History Area
        // This is usually the area above the command bar.
        // We can find it by looking for the "How can I help you?" text container or the scrollable area.
        // Based on other tests, let's look for the element that contains the messages.
        const chatArea = page.locator('.flex-1.overflow-y-auto'); // Common pattern, but let's be more specific if possible.
        // Or we can just check the bounding box of the input container relative to the viewport.

        // 1. Initial State Check
        const initialInputBox = await inputContainer.boundingBox();
        expect(initialInputBox).not.toBeNull();

        console.log(`📱 Initial Input Y: ${initialInputBox?.y}`);

        // Ensure input is near the bottom
        expect(initialInputBox!.y).toBeGreaterThan(MOBILE_HEIGHT - 200);

        // 2. Simulate Keyboard Open (Resize Viewport)
        console.log(`📱 Simulating Keyboard Open: Resizing to ${MOBILE_WIDTH}x${OPEN_HEIGHT}`);
        await page.setViewportSize({ width: MOBILE_WIDTH, height: OPEN_HEIGHT });

        // Wait for potential layout shifts (debounce, resize listeners)
        await page.waitForTimeout(500);

        // 3. Verify Input is Still Visible and Positioned Correctly
        const squeezedInputBox = await inputContainer.boundingBox();
        expect(squeezedInputBox).not.toBeNull();

        console.log(`📱 Squeezed Input Y: ${squeezedInputBox?.y}`);

        // The input should now be near the bottom of the NEW viewport
        // Allow some tolerance for margins/padding
        expect(squeezedInputBox!.y).toBeLessThan(OPEN_HEIGHT);
        expect(squeezedInputBox!.y).toBeGreaterThan(OPEN_HEIGHT - 200);

        // 4. Verify Visibility
        await expect(inputContainer).toBeVisible();

        // 5. Verify no body scroll (layout shouldn't overflow vertically in a way that hides the input)
        // If the layout breaks, the input might be pushed down and require scrolling to see.
        // We want it sticky or fixed at the bottom.

        // Check if input is "in viewport"
        const isIntersecting = await inputContainer.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        });

        expect(isIntersecting).toBe(true);
    });
});
