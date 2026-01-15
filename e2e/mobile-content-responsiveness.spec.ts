
import { test, expect } from '@playwright/test';

// Viewport's Mobile Spec
// Device: iPhone SE (375x667)
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 667;

test.describe('📱 Viewport: Content Responsiveness', () => {
    test.use({
        viewport: { width: MOBILE_WIDTH, height: MOBILE_HEIGHT },
        hasTouch: true,
        isMobile: true
    });

    test.beforeEach(async ({ page, context }) => {
        // 1. Bypass Auth (Test Mode) & Enable Store Access
        await context.addInitScript(() => {
            localStorage.setItem('TEST_MODE', 'true');
            // Force TEST_MODE on window to expose useStore if not already in DEV
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
        // Mobile view: Fullscreen modal with "AI Assistant" header
        await expect(page.getByText('AI Assistant')).toBeVisible();
    });

    test('should handle wide markdown tables without breaking layout ("The Unbreakable Table")', async ({ page }) => {
        // Inject a wide table
        await page.evaluate(() => {
            // @ts-expect-error - Testing Environment Window Property
            const store = window.useStore.getState();

            const wideTable = `
| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| This is some long content | This is some long content | This is some long content | This is some long content | This is some long content | This is some long content |
| Data 1 | Data 2 | Data 3 | Data 4 | Data 5 | Data 6 |
`;

            store.addAgentMessage({
                id: 'test-table-msg',
                role: 'model',
                text: "Here is a wide table:\n\n" + wideTable,
                timestamp: Date.now(),
                isStreaming: false
            });
        });

        // Verify Table Exists
        const table = page.locator('table');
        await expect(table).toBeVisible();

        // Check for horizontal scroll on the container (ChatOverlay wraps table in a div with overflow-x-auto)
        // The structure in ChatOverlay is: div.overflow-x-auto > table
        const tableContainer = table.locator('xpath=..');

        // Verify styling class
        await expect(tableContainer).toHaveClass(/overflow-x-auto/);

        // Verify actual scroll capability (scrollWidth > clientWidth)
        const scrollWidth = await tableContainer.evaluate((el) => el.scrollWidth);
        const clientWidth = await tableContainer.evaluate((el) => el.clientWidth);

        console.log(`📱 Table Container: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
        expect(scrollWidth).toBeGreaterThan(clientWidth);

        // Verify BODY does NOT scroll horizontally
        const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);

        console.log(`📱 Body: scrollWidth=${bodyScrollWidth}, clientWidth=${bodyClientWidth}`);

        // Allow a small margin of error (1px) due to sub-pixel rendering, but strictly no major overflow
        expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 1);
    });

    test('should handle long code blocks without breaking layout', async ({ page }) => {
        // Inject a long code block
        await page.evaluate(() => {
            // @ts-expect-error - Testing Environment Window Property
            const store = window.useStore.getState();

            const longCode = `
\`\`\`typescript
function thisIsAVeryLongFunctionNameThatShouldDefinitelyOverflowTheViewportIfItDoesNotWrapOrScrollCorrectly(parameter1: string, parameter2: number): void {
    console.log("This is a very long line of code that serves the purpose of testing the horizontal scrolling capabilities of the code block renderer component in the chat interface.");
}
\`\`\`
`;

            store.addAgentMessage({
                id: 'test-code-msg',
                role: 'model',
                text: "Here is a long code block:\n\n" + longCode,
                timestamp: Date.now(),
                isStreaming: false
            });
        });

        // Verify Pre/Code Exists
        const pre = page.locator('pre');
        await expect(pre).toBeVisible();

        // In ChatOverlay, pre is wrapped in div.overflow-x-auto
        const preContainer = pre.locator('xpath=..');

        // Verify styling
        await expect(preContainer).toHaveClass(/overflow-x-auto/);

        // Verify scroll capability
        const scrollWidth = await preContainer.evaluate((el) => el.scrollWidth);
        const clientWidth = await preContainer.evaluate((el) => el.clientWidth);

        console.log(`📱 Code Container: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
        expect(scrollWidth).toBeGreaterThan(clientWidth);

        // Verify BODY does NOT scroll horizontally
        const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);

        expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 1);
    });
});
