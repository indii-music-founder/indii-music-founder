
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
        // Mobile view: Fullscreen modal with "How can I help you?" (Empty State) or Agent Name
        await expect(page.getByText('How can I help you?')).toBeVisible();
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

        expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 1);
    });

    test('should handle wide images without breaking layout', async ({ page }) => {
        // Inject a wide image (2000px wide SVG)
        await page.evaluate(() => {
            // @ts-expect-error - Testing Environment Window Property
            const store = window.useStore.getState();

            // 2000px wide red rectangle
            const wideImageSrc = "data:image/svg+xml,%3Csvg%20width%3D%222000%22%20height%3D%22100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%222000%22%20height%3D%22100%22%20fill%3D%22red%22%2F%3E%3C%2Fsvg%3E";

            store.addAgentMessage({
                id: 'test-image-msg',
                role: 'model',
                text: `Here is a wide image:\n\n![Wide Image](${wideImageSrc})`,
                timestamp: Date.now(),
                isStreaming: false
            });
        });

        // Verify Image Exists
        const img = page.locator('img[alt="Wide Image"]');
        await expect(img).toBeVisible();

        // Check if image is constrained
        const imgBox = await img.boundingBox();
        const viewportSize = page.viewportSize();

        console.log(`📱 Wide Image: width=${imgBox?.width}, viewport=${viewportSize?.width}`);

        // Image width should be <= viewport width (minus padding)
        expect(imgBox?.width).toBeLessThan(viewportSize!.width);

        // Verify BODY does NOT scroll horizontally
        const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
        const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);

        expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 1);
    });

    test('should handle deep JSON tool output without breaking layout', async ({ page }) => {
        // Inject a deep JSON tool output
        await page.evaluate(() => {
            // @ts-expect-error - Testing Environment Window Property
            const store = window.useStore.getState();

            const deepJson = {
                level1: {
                    level2: {
                        level3: {
                            level4: {
                                level5: {
                                    text: "This is a deeply nested JSON object that simulates complex tool output.",
                                    data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                                    meta: "Some metadata here to make it wider"
                                }
                            }
                        }
                    }
                }
            };

            const jsonString = JSON.stringify(deepJson);
            // Double escape quotes to survive Markdown rendering
            const escapedJsonString = jsonString.replace(/"/g, '\\"');

            // To trigger the special Tool Renderer in ChatMessage.tsx, we must match the pattern:
            // [Tool: delegate_task] Output: { ... "text": "[Tool: inner_tool] Output: { ... }" ... }
            const innerToolOutput = `[Tool: test_tool] Output: ${escapedJsonString}`;
            const outerJson = {
                text: innerToolOutput
            };
            const toolOutputText = `[Tool: delegate_task] Output: ${JSON.stringify(outerJson)}`;

            store.addAgentMessage({
                id: 'test-json-msg',
                role: 'model',
                text: toolOutputText,
                timestamp: Date.now(),
                isStreaming: false
            });
        });

        // Verify Tool Result is visible
        const toolResult = page.getByText('Tool Result: test_tool');
        await expect(toolResult).toBeVisible();

        // Verify the formatted JSON container
        const container = toolResult.locator('xpath=..');

        // Check bounding box
        const box = await container.boundingBox();
        const viewportSize = page.viewportSize();

        console.log(`📱 JSON Container: width=${box?.width}, viewport=${viewportSize?.width}`);

        expect(box?.width).toBeLessThan(viewportSize!.width);

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
