import { expect } from '@playwright/test';
import { test } from './fixtures/auth';

// STRUCTURAL ONLY: uses mock auth/stream fixtures and store setup; not live-account evidence.
test('Live Test: Boardroom', async ({ authedPage: page }) => {
    const uncaughtErrors: string[] = [];
    page.on('pageerror', (error) => {
        uncaughtErrors.push(error.message);
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.useStore !== undefined);

    await page.evaluate(() => {
        window.useStore.getState().setConversationMode('boardroom');
    });

    const boardroom = page.locator('[data-testid="boardroom-module"]');
    await expect(boardroom).toBeVisible();

    const input = page.locator('[data-testid="main-prompt-input"]:visible');
    await expect(input).toBeVisible();

    await input.fill('hi');
    await input.press('Enter');

    await expect.poll(async () => page.evaluate(() => {
        const state = window.useStore.getState();
        const latestModelReply = [...state.agentHistory]
            .reverse()
            .find(msg => msg.role === 'model' && msg.isStreaming === false);
        return {
            processing: state.isAgentProcessing,
            replyText: latestModelReply?.text?.trim() ?? '',
        };
    }), { timeout: 15_000 }).toEqual({
        processing: false,
        replyText: expect.stringMatching(/.+/),
    });

    const lastModelMessage = await page.evaluate(() =>
        [...window.useStore.getState().agentHistory]
            .reverse()
            .find(msg => msg.role === 'model' && msg.isStreaming === false)
    );
    expect(lastModelMessage).toBeDefined();
    expect(lastModelMessage!.text).not.toMatch(/^Error:/);
    await expect(page.locator(`[data-message-id="${lastModelMessage!.id}"] .message-content`)).not.toHaveText(/^\s*$/);
    expect(uncaughtErrors).toEqual([]);
});
