import { test, expect } from '@playwright/test';

test.describe('Chat Streaming & Interaction', () => {
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

        // 3. Open Chat Overlay
        const toggleBtn = page.locator('button[aria-label="Open chat"]');
        if (await toggleBtn.isVisible()) {
            await toggleBtn.click();
        }

        // Wait for overlay to appear
        // Use a more specific selector if possible, or text that is unique to the overlay
        await expect(page.locator('text=How can I help you?')).toBeVisible();
    });

    test('should show "Thinking" indicator and stream text progressively', async ({ page }) => {
        // 1. Start a new streaming message
        const messageId = 'stream-test-1';

        await page.evaluate(({ id }) => {
            const store = (window as any).useStore;
            store.getState().addAgentMessage({
                id,
                role: 'model',
                text: '', // Start empty
                timestamp: Date.now(),
                isStreaming: true,
                thoughts: [{ id: 't1', text: 'Analyzing request...', timestamp: Date.now() }]
            });
        }, { id: messageId });

        // 2. Verify "Thinking" state
        // Look for the thought bubble or specific UI element for thinking
        // "Analyzing request..." should be visible if thoughts are rendered
        await expect(page.locator('text=Analyzing request...')).toBeVisible();

        // 3. Simulate Text Streaming (Chunk 1)
        const chunk1 = "Hello, I am ";
        await page.evaluate(({ id, text }) => {
            const store = (window as any).useStore;
            store.getState().updateAgentMessage(id, { text });
        }, { id: messageId, text: chunk1 });

        await expect(page.locator(`text=${chunk1}`)).toBeVisible();

        // 4. Simulate Text Streaming (Chunk 2 - Long text to trigger scroll)
        const chunk2 = "Pixel, your automated testing assistant. I am here to ensure that this chat interface handles long streaming responses without glitching, flickering, or breaking the layout. Chaos is my ladder.";
        const fullText = chunk1 + chunk2;

        await page.evaluate(({ id, text }) => {
            const store = (window as any).useStore;
            store.getState().updateAgentMessage(id, { text });
        }, { id: messageId, text: fullText });

        await expect(page.locator(`text=${chunk2}`)).toBeVisible();

        // 5. Verify Auto-Scroll
        // We need to ensure the bottom of the chat is visible.
        // A simple heuristic is that the last message is visible.
        const lastMessage = page.locator(`text=${chunk2}`);
        await expect(lastMessage).toBeInViewport();

        // 6. Finish Streaming
        await page.evaluate(({ id }) => {
            const store = (window as any).useStore;
            store.getState().updateAgentMessage(id, { isStreaming: false });
        }, { id: messageId });
    });

    test('should handle rapid updates without crashing', async ({ page }) => {
        const messageId = 'stream-rapid-1';

        await page.evaluate(({ id }) => {
            const store = (window as any).useStore;
            store.getState().addAgentMessage({
                id,
                role: 'model',
                text: '',
                timestamp: Date.now(),
                isStreaming: true
            });
        }, { id: messageId });

        // Simulate 20 rapid updates
        const chunks = Array.from({ length: 20 }, (_, i) => `Chunk ${i} `);
        let currentText = "";

        for (const chunk of chunks) {
            currentText += chunk;
            await page.evaluate(({ id, text }) => {
                const store = (window as any).useStore;
                store.getState().updateAgentMessage(id, { text });
            }, { id: messageId, text: currentText });

            // Minimal wait to allow React to schedule (simulating fast network)
            await page.waitForTimeout(10);
        }

        await expect(page.locator(`text=${currentText}`)).toBeVisible();
    });
});
