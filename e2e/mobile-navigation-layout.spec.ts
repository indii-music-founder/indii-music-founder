
import { test, expect } from '@playwright/test';

// Viewport's Mobile Spec
// Device: iPhone SE (375x667)
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 667;

test.describe('📱 Viewport: Mobile Navigation Layout', () => {
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
            const guestLoginBtn = page.getByText('Guest Login (Dev)');
            if (await guestLoginBtn.isVisible()) {
                await guestLoginBtn.click();
            }
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
        }
    });

    test('should replace desktop sidebar with mobile navigation bar', async ({ page }) => {
        // 1. Verify Desktop Sidebar is HIDDEN
        const desktopSidebarToggle = page.getByTestId('sidebar-toggle');
        await expect(desktopSidebarToggle).toBeHidden();

        // 2. Verify Mobile Navigation is VISIBLE
        const moreButton = page.locator('button[aria-label="More"]');
        await expect(moreButton).toBeVisible();

        // Check if it's fixed at the bottom
        const navBar = moreButton.locator('xpath=../..'); // Parent div
        const box = await navBar.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
            expect(box.y + box.height).toBeCloseTo(MOBILE_HEIGHT, 1);
        }
    });

    test('should open full-screen agent chat on mobile (Agent Window Toggle)', async ({ page }) => {
        // This test verifies the critical mobile workflow of opening/closing the AI Agent.
        // On mobile, this replaces the sidebar/overlay approach with a full-screen modal.

        // 1. Open Agent via Store (Simulating the interaction)
        await page.evaluate(() => {
            // @ts-expect-error - Testing Environment Window Property
            if (window.useStore) {
                // @ts-expect-error - Testing Environment Window Property
                const state = window.useStore.getState();
                if (!state.isAgentOpen) {
                    state.toggleAgentWindow();
                }
            }
        });

        // 2. Verify Full Screen Modal
        // The modal has fixed inset-0 z-[70]
        const modal = page.locator('.fixed.inset-0.z-\\[70\\]');
        await expect(modal).toBeVisible();

        const box = await modal.boundingBox();
        // Allow for safe areas, borders, and sub-pixel rendering (within 5% of viewport)
        expect(box?.width).toBeGreaterThan(MOBILE_WIDTH * 0.95);
        expect(box?.height).toBeGreaterThan(MOBILE_HEIGHT * 0.95);

        // 3. Verify Close Button works
        const closeBtn = page.locator('button[aria-label="Close Agent"]');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();

        // 4. Verify Closed
        await expect(modal).toBeHidden();
    });
});
