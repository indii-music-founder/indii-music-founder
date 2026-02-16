import { test, expect } from '@playwright/test';

test.describe('Chat Interaction & States', () => {
    test.beforeEach(async ({ page }) => {
        // iPhone X Viewport for consistent layout testing
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
        // Force open via store to be robust against UI changes/animations
        await page.evaluate(() => {
            const store = (window as any).useStore;
            store.setState({ isAgentOpen: true });
            // Ensure history is empty so we see the "How can I help you?" text
            store.setState({ agentHistory: [] });
        });

        // Wait for overlay to appear
        await expect(page.locator('text=How can I help you?')).toBeVisible();
    });

    test('should show thinking indicator during streaming', async ({ page }) => {
        const messageId = 'interaction-test-1';

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

        // Verify "Thinking" indicator (dots)
        const thinkingIndicator = page.locator('div[aria-label="AI is thinking"]');
        await expect(thinkingIndicator).toBeVisible();

        // Update text
        await page.evaluate(({ id }) => {
            const store = (window as any).useStore;
            store.getState().updateAgentMessage(id, { text: 'Hello Pixel' });
        }, { id: messageId });

        await expect(page.locator('text=Hello Pixel')).toBeVisible();
        // Indicator should still be there as isStreaming is true
        await expect(thinkingIndicator).toBeVisible();

        // Finish streaming
        await page.evaluate(({ id }) => {
            const store = (window as any).useStore;
            store.getState().updateAgentMessage(id, { isStreaming: false });
        }, { id: messageId });

        await expect(thinkingIndicator).toBeHidden();
    });

    test('should handle auto-scroll and user interruption', async ({ page }) => {
        // 1. Add Message 1 (Short)
        await page.evaluate(() => {
            const store = (window as any).useStore;
            store.getState().addAgentMessage({
                id: 'msg-1',
                role: 'model',
                text: 'Short message',
                timestamp: Date.now(),
                isStreaming: false
            });
        });
        await expect(page.locator('text=Short message')).toBeVisible();

        // 2. Add Message 2 (Long - overflows)
        const longText = Array.from({ length: 100 }, (_, i) => `Line ${i}`).join('\n\n');
        await page.evaluate(({ text }) => {
            const store = (window as any).useStore;
            store.getState().addAgentMessage({
                id: 'msg-2',
                role: 'model',
                text,
                timestamp: Date.now(),
                isStreaming: true
            });
        }, { text: longText });

        // Ensure auto-scroll to bottom
        await page.locator('text=Line 99').waitFor();
        // Force scroll to bottom to ensure we are in correct state for next step
        // We find the scroller relative to the content to ensure we target the right one
        await page.evaluate(() => {
             const p = Array.from(document.querySelectorAll('p')).find(e => e.textContent?.includes('Line 99'));
             if (p) {
                 let parent = p.parentElement;
                 while (parent) {
                     // Virtuoso scroller usually has these characteristics
                     if (parent.classList.contains('custom-scrollbar') || parent.getAttribute('data-virtuoso-scroller') === 'true') {
                         parent.scrollTop = parent.scrollHeight;
                         parent.dispatchEvent(new Event('scroll'));
                         break;
                     }
                     parent = parent.parentElement;
                 }
             }
        });
        await expect(page.locator('text=Line 99')).toBeInViewport();

        const resumeBtn = page.locator('button[aria-label="Scroll to newest messages"]');
        await expect(resumeBtn).toBeHidden();

        // 3. Scroll UP
        await page.evaluate(() => {
             // Find scroller via content again
             const p = Array.from(document.querySelectorAll('p')).find(e => e.textContent?.includes('Line 99'));
             if (p) {
                 let parent = p.parentElement;
                 while (parent) {
                     if (parent.classList.contains('custom-scrollbar') || parent.getAttribute('data-virtuoso-scroller') === 'true') {
                         parent.scrollTop = 0;
                         parent.dispatchEvent(new Event('scroll'));
                         break;
                     }
                     parent = parent.parentElement;
                 }
             }
        });

        // 4. Add Message 3
        const msg3 = "MESSAGE 3 - NEW";
        await page.evaluate(({ text }) => {
            const store = (window as any).useStore;
            store.getState().addAgentMessage({
                id: 'msg-3',
                role: 'model',
                text,
                timestamp: Date.now(),
                isStreaming: true
            });
        }, { text: msg3 });

        // 5. Verify Auto-scroll PAUSED
        // Resume button should be visible because we are not at bottom
        await expect(resumeBtn).toBeVisible();
        // New message should NOT be in viewport
        await expect(page.locator(`text=${msg3}`)).not.toBeInViewport();

        // 6. Click Resume
        await resumeBtn.click();

        // 7. Verify Auto-scroll RESUMED
        await expect(resumeBtn).toBeHidden();
        await expect(page.locator(`text=${msg3}`)).toBeInViewport();
    });

    test('should show processing footer status', async ({ page }) => {
        // Enable processing
        await page.evaluate(() => {
            const store = (window as any).useStore;
            store.setState({ isAgentProcessing: true });
        });

        await expect(page.locator('text=PROCESSING RESPONSE...')).toBeVisible();

        // Disable processing
        await page.evaluate(() => {
            const store = (window as any).useStore;
            store.setState({ isAgentProcessing: false });
        });

        await expect(page.locator('text=PROCESSING RESPONSE...')).toBeHidden();
    });
});
