import { expect } from '@playwright/test';
import { test } from './fixtures/auth';
import { answerJudgeQuestions } from './fixtures/judgeOverrides';
import { startMcpSseStub, type McpSseStub } from './fixtures/mcpSseServer';

test.describe('Boardroom Collaboration via MCP', () => {
    // A real local SSE gateway: the MCP client reads tool results from the
    // long-lived SSE stream, which a route mock cannot hold open (ISSUE-1691).
    let mcpStub: McpSseStub;
    test.beforeAll(async () => { mcpStub = await startMcpSseStub(); });
    test.afterAll(async () => { await mcpStub?.stop(); });

    test.beforeEach(async ({ authedPage: page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        
        // Wait for store initialization
        await page.waitForFunction(() => window.useStore !== undefined);
        
        // Open the boardroom overlay with multiple agents
        await page.evaluate(() => {
            window.useStore.getState().setConversationMode('boardroom');
            window.useStore.setState({ activeAgents: ['manager', 'publicist'] });
        });
        
        // Wait for the modal to be visible
        await expect(page.locator('[data-testid="boardroom-module"]')).toBeVisible();
    });

    test('Manager agent collaborates with Publicist agent using MCP tools', async ({ authedPage: page }) => {
        // The auth fixture's Cloud Functions catch-all also matches :5001; let the
        // MCP gateway requests through to the local stub (loopback only).
        await page.route('**/mcpEndpoint/**', route => route.continue());

        // Send a message targeting the manager, who should delegate to the publicist
        // This request asks the Boardroom to act on a Publicist tool: the real judge
        // classifies it as an action and routes it to the Publicist.
        await answerJudgeQuestions(page, { intent: 'action', specialist: 'publicist' });
        await page.fill('[data-testid="main-prompt-input"]', 'Hey Manager, please coordinate with the Publicist to generate a playlist pitch.');
        await page.press('[data-testid="main-prompt-input"]', 'Enter');

        // The Conductor coordinates the hand-off and posts a summary that credits
        // the Publicist's step (no seat answers as 'manager' in today's Boardroom).
        await page.waitForFunction(
            () => (window.useStore.getState().agentHistory || []).some(m =>
                m.role === 'model' && m.agentId === 'generalist' && (m.text || '').includes('Publicist Director')),
            undefined,
            { timeout: 20000 },
        );

        // The gateway really received the Publicist's tool call.
        await expect.poll(() => mcpStub.calls.map(call => call.name), { timeout: 20000 }).toContain('generate_playlist_pitch');

        // Raw tool payloads are system-only and never shown to the user; the
        // Publicist's message reports the executed remote tool instead.
        const locator = page.locator('[data-agent-id="publicist"] .message-content').last(); // bypass-strict: select latest message in chat thread
        await expect(locator).toContainText('Executed remote tool: generate_playlist_pitch', { timeout: 15000 });
    });
});
