
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
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 5000 });
        } catch (e) {
            const guestLoginBtn = page.getByText('Guest Login (Dev)');
            if (await guestLoginBtn.isVisible()) {
                await guestLoginBtn.click();
            }
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 30000 });
        }
    });

    test('should replace desktop sidebar with mobile navigation bar', async ({ page }) => {
        // 1. Verify Desktop Sidebar is HIDDEN
        const desktopSidebarToggle = page.getByTestId('sidebar-toggle');
        await expect(desktopSidebarToggle).toBeHidden();

        // 2. Verify Mobile Navigation is VISIBLE
        const moreButton = page.locator('button[aria-label="Open Navigation"]');
        await expect(moreButton).toBeVisible();

        // Verify FAB position
        const box = await moreButton.boundingBox();
        expect(box).not.toBeNull();
        // It should be within the viewport
        expect(box?.y).toBeLessThan(MOBILE_HEIGHT);
        expect(box?.y).toBeGreaterThan(MOBILE_HEIGHT - 200); // Rough check for bottom area
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
        // Find the chat overlay via its close button to ensure we have the correct container
        // Note: Aria label might be "Close chat" or "Close Agent" depending on implementation
        const closeBtn = page.locator('button[aria-label="Close chat"], button[aria-label="Close Agent"]').first();
        await expect(closeBtn).toBeVisible();

        // The modal container is the ancestor with fixed position
        const modal = closeBtn.locator('xpath=../../..');
        await expect(modal).toHaveCSS('position', 'fixed');

        const box = await modal.boundingBox();
        // Allow for safe areas, borders, and sub-pixel rendering (within 5% of viewport)
        expect(box?.width).toBeGreaterThan(MOBILE_WIDTH * 0.95);
        expect(box?.height).toBeGreaterThan(MOBILE_HEIGHT * 0.95);

        // 3. Verify Close Button works
        await closeBtn.click({ force: true });

        // 4. Verify Closed
        await expect(modal).toBeHidden();
    });

    test('should navigate to Brand Manager and close menu', async ({ page }) => {
        // 1. Open Navigation
        const openNavBtn = page.locator('button[aria-label="Open Navigation"]');
        await openNavBtn.click();

        // 2. Verify Drawer is Open
        const drawer = page.locator('#mobile-nav-drawer');
        await expect(drawer).toBeVisible();

        // 3. Click Brand Manager
        const brandLink = drawer.getByText('Brand Manager');
        await brandLink.click();

        // 4. Verify Drawer Closes
        await expect(drawer).not.toBeVisible();

        // 5. Verify Navigation (URL & Content)
        await expect(page).toHaveURL(/.*\/brand/);
        await expect(page.getByText('BRAND HQ')).toBeVisible();
    });
});
