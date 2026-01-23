import { test, expect } from '@playwright/test';

test.describe('Chat Markdown Rendering', () => {
    test.beforeEach(async ({ page }) => {
        // iPhone X Viewport for consistent mobile layout testing
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/');

        // 1. Handle Login (Guest Mode)
        const guestBtn = page.getByRole('button', { name: 'Guest Login (Dev)' });
        if (await guestBtn.isVisible()) {
            await guestBtn.click();
        }

        // 2. Wait for App & Store
        await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
        await page.waitForFunction(() => !!(window as any).useStore);

        // 3. Open Chat Overlay directly via Store (Reliable)
        await page.evaluate(() => {
            const store = (window as any).useStore;
            if (!store.getState().isAgentOpen) {
                store.getState().toggleAgentWindow();
            }
        });

        // Wait for overlay to appear
        await expect(page.locator('text=How can I help you?')).toBeVisible();
    });

    test('should render Markdown Tables with scroll wrapper', async ({ page }) => {
        const messageId = 'md-table-1';
        const markdownTable = `
| Feature | Status |
| :--- | :--- |
| Streaming | ✅ Ready |
| Markdown | 🚧 Testing |
| Tables | 🧪 Pending |
`;

        // Inject message
        await page.evaluate(({ id, text }) => {
            const store = (window as any).useStore;
            store.getState().addAgentMessage({
                id,
                role: 'model',
                text,
                timestamp: Date.now(),
                isStreaming: false
            });
        }, { id: messageId, text: markdownTable });

        // Verify Table exists
        const table = page.locator('table');
        await expect(table).toBeVisible();

        // Verify headers
        await expect(page.locator('th', { hasText: 'Feature' })).toBeVisible();
        await expect(page.locator('th', { hasText: 'Status' })).toBeVisible();

        // Verify content
        await expect(page.locator('td', { hasText: 'Streaming' })).toBeVisible();

        // Verify scroll wrapper class (based on ChatMessage.tsx implementation)
        const wrapper = table.locator('..'); // Parent element
        await expect(wrapper).toHaveClass(/overflow-x-auto/);
    });

    test('should render Code Blocks with syntax highlighting structure', async ({ page }) => {
        const messageId = 'md-code-1';
        const codeBlock = "```typescript\nconst pixel = 'watching';\nconsole.log(pixel);\n```";

        // Inject message
        await page.evaluate(({ id, text }) => {
            const store = (window as any).useStore;
            store.getState().addAgentMessage({
                id,
                role: 'model',
                text,
                timestamp: Date.now(),
                isStreaming: false
            });
        }, { id: messageId, text: codeBlock });

        // Verify Pre/Code block
        // Depending on how CodeBlock is implemented, it might be a 'pre' tag
        await expect(page.locator('pre')).toBeVisible();
        await expect(page.locator('code')).toBeVisible();

        // Verify content is preserved
        await expect(page.locator('code')).toContainText("const pixel = 'watching';");
    });

    test('should render Nested Lists correctly', async ({ page }) => {
        const messageId = 'md-list-1';
        const nestedList = `
- Root Item A
  - Nested Child 1
  - Nested Child 2
- Root Item B
`;

        // Inject message
        await page.evaluate(({ id, text }) => {
            const store = (window as any).useStore;
            store.getState().addAgentMessage({
                id,
                role: 'model',
                text,
                timestamp: Date.now(),
                isStreaming: false
            });
        }, { id: messageId, text: nestedList });

        // Verify List Items
        await expect(page.getByText('Root Item A')).toBeVisible();
        await expect(page.getByText('Nested Child 1')).toBeVisible();
        await expect(page.getByText('Root Item B')).toBeVisible();
    });
});
