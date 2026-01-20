import { test, expect } from '@playwright/test';

// iPhone X Viewport
const mobileViewport = {
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
};

test.describe('Mobile Chat Layout & Content', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize(mobileViewport);
        await page.goto('/');

        // Handle Login
        // Check if we are on the login page by looking for the Guest Login button
        // Note: This button only exists in DEV mode, which the test runner should use
        const guestBtn = page.getByRole('button', { name: 'Guest Login (Dev)' });
        if (await guestBtn.isVisible()) {
            await guestBtn.click();
        }

        // Wait for app to load
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
    });

    test('should keep CommandBar visible when Chat Overlay is open', async ({ page }) => {
        // Open the Chat Overlay
        const toggleBtn = page.locator('button[aria-label="Open chat"]');

        // If chat is already open (icon is "Close chat"), we don't need to click
        if (await toggleBtn.isVisible()) {
             await toggleBtn.click();
        } else {
             // Maybe it's already open, check for Close chat button
             const closeBtn = page.locator('button[aria-label="Close chat"]');
             if (!await closeBtn.isVisible()) {
                 // Try to find the toggle button again, maybe verify selector
                 console.log("Could not find Open Chat button");
             }
        }

        // Wait for overlay animation
        await page.waitForTimeout(1000);

        // Verify Chat Overlay is visible
        const chatOverlay = page.locator('text=How can I help you?');
        // Note: If there are messages, this text might be gone. But initially it should be there.
        // Better selector for the overlay container:
        // The overlay has specific classes. Let's look for the header agent name.
        const header = page.locator('text=indii');
        await expect(header.first()).toBeVisible();

        // Verify Command Bar Input is visible
        const inputContainer = page.getByTestId('command-bar-input-container');
        await expect(inputContainer).toBeVisible();

        // Critical Check: Is it covered?
        // We can check if the input receives pointer events or is on top.
        // A simple way is to try to click it.
        await inputContainer.click({ timeout: 2000 });

        // Check z-index/stacking if possible, or reliance on click success
        const box = await inputContainer.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
             // Ensure it's at the bottom of the screen
             expect(box.y).toBeGreaterThan(600);
        }
    });

    test('should handle wide Markdown tables without breaking layout', async ({ page }) => {
        // Open Chat
        const toggleBtn = page.locator('button[aria-label="Open chat"]');
        if (await toggleBtn.isVisible()) await toggleBtn.click();

        // Inject a wide table message via window.useStore
        await page.evaluate(() => {
            const store = (window as any).useStore;
            if (store) {
                store.setState((state: any) => ({
                    agentHistory: [
                        ...state.agentHistory,
                        {
                            id: 'test-msg-table',
                            role: 'model',
                            text: `
| ID | Name | Role | Department | Status | Performance | Last Active |
|----|------|------|------------|--------|-------------|-------------|
| 001 | John Doe | Senior Developer | Engineering | Active | High | 2023-10-01 |
| 002 | Jane Smith | Product Manager | Product | Active | High | 2023-10-02 |
| 003 | Bob Johnson | Designer | Design | Offline | Medium | 2023-09-28 |
| 004 | Alice Brown | QA Engineer | QA | Active | High | 2023-10-03 |
                            `,
                            timestamp: Date.now(),
                            isStreaming: false
                        }
                    ]
                }));
            }
        });

        // Wait for message to render
        await page.waitForSelector('table');

        // Check for table visibility
        const table = page.locator('table');
        await expect(table).toBeVisible();

        // Verify the scroll container
        // The table should be wrapped in a div with overflow-x-auto
        const wrapper = table.locator('xpath=..'); // Parent

        // Check computed style for overflow
        const overflow = await wrapper.evaluate((el) => {
            return window.getComputedStyle(el).overflowX;
        });
        expect(overflow).toBe('auto');

        // Verify body does NOT scroll horizontally
        // On mobile, the window width is 375.
        // The table width should be > 375.
        const tableWidth = await table.evaluate(el => el.getBoundingClientRect().width);
        expect(tableWidth).toBeGreaterThan(300); // Should be wide enough to potentially scroll

        // Check if the scrollWidth of body > clientWidth
        const bodyScroll = await page.evaluate(() => {
            return document.body.scrollWidth > document.body.clientWidth;
        });

        // Strictly, body shouldn't scroll. But sometimes sticky footers make this hard to test.
        // Better: Ensure the main layout container doesn't scroll.
        expect(bodyScroll).toBe(false);
    });

    test('should handle long code blocks without breaking layout', async ({ page }) => {
        const toggleBtn = page.locator('button[aria-label="Open chat"]');
        if (await toggleBtn.isVisible()) await toggleBtn.click();

        await page.evaluate(() => {
            const store = (window as any).useStore;
            if (store) {
                store.setState((state: any) => ({
                    agentHistory: [
                        ...state.agentHistory,
                        {
                            id: 'test-msg-code',
                            role: 'model',
                            text: "Here is some code:\n```javascript\nconst veryLongVariableName = 'This is a very long string that should definitely overflow the container on a mobile device and trigger a horizontal scrollbar if implemented correctly';\nfunction anotherLongFunction(param1, param2, param3, param4, param5) { return param1 + param2; }\n```",
                            timestamp: Date.now(),
                            isStreaming: false
                        }
                    ]
                }));
            }
        });

        await page.waitForSelector('pre');
        const pre = page.locator('pre');
        await expect(pre).toBeVisible();

        // Parent wrapper check
        const wrapper = pre.locator('xpath=..');
        const overflow = await wrapper.evaluate((el) => window.getComputedStyle(el).overflowX);
        expect(overflow).toBe('auto');
    });
});
