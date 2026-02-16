import { test, expect } from '@playwright/test';

// iPhone X/11/12 Pro Dimensions
const mobileViewport = {
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
};

test.describe('Mobile Chat Layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize(mobileViewport);
        await page.goto('/');

        // Handle Guest Login if present
        const guestBtn = page.getByRole('button', { name: 'Guest Login (Dev)' });
        if (await guestBtn.isVisible()) {
            await guestBtn.click();
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
        }

        // Wait for store to be available (exposed in Dev mode)
        await page.waitForFunction(() => !!(window as any).useStore);

        // Force Open Chat Overlay via Store
        await page.evaluate(() => {
            const store = (window as any).useStore;
            store.setState({ isAgentOpen: true });
        });

        // Wait for overlay to appear
        await expect(page.locator('text=How can I help you?')).toBeVisible();
    });

    test('The Virtual Keyboard Squeeze', async ({ page }) => {
        // Verify initial state
        const input = page.locator('textarea').first(); // Ensure we get the chat input
        await expect(input).toBeVisible();
        await expect(input).toBeInViewport();

        // Simulate Keyboard Open (Resize Height)
        // Shrink from 812 to 400 (approx keyboard size)
        await page.setViewportSize({ ...mobileViewport, height: 400 });

        // Wait for potential layout shift
        await page.waitForTimeout(500);

        // Assert Input is still visible (stuck to bottom)
        await expect(input).toBeInViewport();

        // Assert it is not obscured (checking bounding box y)
        const box = await input.boundingBox();
        expect(box).toBeTruthy();
        // It should be near the bottom (400)
        // Input height is approx 40-60px.
        // y should be > 200 (bottom half of the squeezed viewport)
        // Note: 267px is observed with safe area + actions bar
        expect(box!.y).toBeGreaterThan(200);
        expect(box!.y + box!.height).toBeLessThanOrEqual(400);
    });

    test('The Unbreakable Table', async ({ page }) => {
         // Inject Wide Table
         const messageId = 'table-test-1';
         const wideTableMarkdown = `
| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
|----------|----------|----------|----------|----------|
| Data 1   | Data 2   | Data 3   | Data 4   | Data 5   |
| Long Content 1 | Long Content 2 | Long Content 3 | Long Content 4 | Long Content 5 |
`;

        await page.evaluate(({ id, text }) => {
            const store = (window as any).useStore;
            store.getState().addAgentMessage({
                id,
                role: 'model',
                text,
                timestamp: Date.now(),
                isStreaming: false
            });
        }, { id: messageId, text: wideTableMarkdown });

        // Wait for message to render
        const table = page.locator('table');
        await expect(table).toBeVisible();

        // Check for scroll wrapper
        // The table itself or its parent should have overflow-x: auto
        // We look for the parent usually
        const wrapper = table.locator('..');

        // Check CSS overflow-x
        const overflowX = await wrapper.evaluate((el) => {
             return window.getComputedStyle(el).overflowX;
        });

        // It might be 'auto' or 'scroll'
        expect(['auto', 'scroll']).toContain(overflowX);

        // Check Body Scroll (Global Horizontal Scroll)
        // The body should NOT scroll horizontally
        const bodyScroll = await page.evaluate(() => {
            return {
                scrollWidth: document.body.scrollWidth,
                clientWidth: document.body.clientWidth
            };
        });

        // Tolerance of 1px for subpixel rendering
        expect(bodyScroll.scrollWidth).toBeLessThanOrEqual(bodyScroll.clientWidth + 1);
    });
});
