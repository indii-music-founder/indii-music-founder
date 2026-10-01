import { expect, type Page } from '@playwright/test';
import { test } from './fixtures/auth';

// A stopped stream is insufficient: a service error must remain a failure,
// with its actual message, rather than being counted as a successful response.
async function assertAgentResponse(page: Page, agentId: string, priorMessageIds: string[] = []) {
    await expect.poll(async () => page.evaluate(({ agentId, priorMessageIds }) =>
        window.useStore.getState().agentHistory.some(message =>
            message.agentId === agentId && message.role === 'model' &&
            !priorMessageIds.includes(message.id) && message.isStreaming === false
        ), { agentId, priorMessageIds }), { timeout: 15_000, message: `${agentId} must finish its actual Boardroom response` }).toBe(true);
    const response = await page.evaluate(({ agentId, priorMessageIds }) =>
        window.useStore.getState().agentHistory.find(message =>
            message.agentId === agentId && message.role === 'model' &&
            !priorMessageIds.includes(message.id) && message.isStreaming === false
        )!, { agentId, priorMessageIds });
    expect(response.text, `${agentId} structural coverage blocked by service failure: ${response.text}`).not.toMatch(/^Error:/);
    expect(response.text.trim()).not.toBe('');
    await expect(page.locator(`[data-message-id="${response.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-message-id="${response.id}"] .message-content`)).not.toHaveText(/^\s*$/);
}

// STRUCTURAL ONLY: the mock-auth fixture and direct store setup below are not
// customer-path or production evidence.
test.describe('Boardroom swarm — structural-only', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // Setup mock environment and auth
        // Relies on `auth.ts` fixture for Gemini API and RAG network mocking.

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        
        // Wait for store initialization and then open the boardroom overlay
        await page.waitForFunction(() => window.useStore !== undefined);
        await page.evaluate(() => {
            window.useStore.getState().setConversationMode('boardroom');
        });
        
        // Wait for the modal to be visible
        await expect(page.locator('[data-testid="boardroom-module"]')).toBeVisible();
    });

    test('should show warning if no agents are seated at the table', async ({ authedPage: page }) => {
        // Ensure no agents are active
        await page.evaluate(() => {
            window.useStore.setState({ activeAgents: [] });
        });

        // Sending without a seated agent is rejected in the UI before any
        // message is sent to the model.
        await page.fill('[data-testid="main-prompt-input"]', 'What is our strategy?');
        await page.locator('[data-testid="main-prompt-input"]').press('Enter');
        await expect(page.getByText('Seat at least one agent on the table to start the discussion.')).toBeVisible();
    });

    test('should dispatch message to multiple seated agents', async ({ authedPage: page }) => {
        // Seat multiple agents using the existing structural store seam.
        await page.evaluate(() => {
            window.useStore.setState({ activeAgents: ['marketing', 'finance'] });
        });

        await page.fill('[data-testid="main-prompt-input"]', 'How much should we spend on ads?');
        await page.locator('[data-testid="main-prompt-input"]').press('Enter');

        await assertAgentResponse(page, 'marketing');
        await assertAgentResponse(page, 'finance');
    });

    test('should include referenced assets in the prompt context', async ({ authedPage: page }) => {
        // Seat an agent and reference an asset
        await page.evaluate(() => {
            const state = window.useStore.getState();
            window.useStore.setState({ activeAgents: ['marketing'] });
            state.clearReferencedAssets();
            state.addReferencedAsset({
                id: 'asset-1',
                name: 'Album Cover',
                type: 'image',
                value: 'base64://fake'
            });
        });

        // Observe the real submitted request; do not infer asset inclusion
        // from a generic response or replace the existing service fixture.
        const requestPromise = page.waitForRequest(request =>
            request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/generateContentStream')
        );
        await page.fill('[data-testid="main-prompt-input"]', 'Review this asset');
        await page.locator('[data-testid="main-prompt-input"]').press('Enter');
        const payload = (await requestPromise).postDataJSON();
        const userText = payload.contents
            .filter((content: { role: string }) => content.role === 'user')
            .flatMap((content: { parts: { text?: string }[] }) => content.parts)
            .map((part: { text?: string }) => part.text || '')
            .join('\n');
        expect(userText).toContain('Review this asset');
        expect(userText).toContain('[BOARDROOM REFERENCED ASSETS]');
        expect(userText).toContain('- Album Cover (image): base64://fake');
        await assertAgentResponse(page, 'marketing');
    });

    test('should maintain memory continuity across different specialist agents', async ({ authedPage: page }) => {
        // Seat Music and Video Directors
        await page.evaluate(() => {
            window.useStore.setState({ activeAgents: ['music', 'video'] });
        });

        // 1. Establish the context with the Music Director
        await page.fill('[data-testid="main-prompt-input"]', "Music Director, let's establish the 'Neon Phantom' vibe. It should be 'Dark Industrial Synth with Neon Green accents'. Commit this to our shared memory.");
        await page.locator('[data-testid="main-prompt-input"]').press('Enter');

        await assertAgentResponse(page, 'music');
        await assertAgentResponse(page, 'video');
        const priorMessageIds = await page.evaluate(() => window.useStore.getState().agentHistory.map(message => message.id));

        // 2. Observe the actual follow-up request's prior-turn context.
        const followUpRequest = page.waitForRequest(request => {
            if (request.method() !== 'POST' || !new URL(request.url()).pathname.endsWith('/generateContentStream')) return false;
            return (request.postData() || '').includes('based on that vibe');
        });
        await page.fill('[data-testid="main-prompt-input"]', "Video Director, based on that vibe, what visual effects should we use?");
        await page.locator('[data-testid="main-prompt-input"]').press('Enter');

        const payload = (await followUpRequest).postDataJSON();
        const submittedText = payload.contents
            .flatMap((content: { parts: { text?: string }[] }) => content.parts)
            .map((part: { text?: string }) => part.text || '')
            .join('\n');
        expect(submittedText).toContain('Neon Phantom');
        expect(submittedText).toContain('Dark Industrial Synth with Neon Green accents');
        await assertAgentResponse(page, 'video', priorMessageIds);
    });
});
