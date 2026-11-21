import { expect } from '@playwright/test';
import { test } from './fixtures/auth';
import { answerJudgeQuestions } from './fixtures/judgeOverrides';
import { startMcpSseStub, type McpSseStub } from './fixtures/mcpSseServer';

test.describe('A2A Routing to MCP Tools', () => {
    // A real local SSE gateway: the MCP client reads tool results from the
    // long-lived SSE stream, which a route mock cannot hold open (ISSUE-1691).
    let mcpStub: McpSseStub;
    test.beforeAll(async () => { mcpStub = await startMcpSseStub(); });
    test.afterAll(async () => { await mcpStub?.stop(); });

    test.beforeEach(async ({ authedPage: page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        
        // Wait for store initialization
        await page.waitForFunction(() => window.useStore !== undefined);
        
        // Open the boardroom overlay
        await page.evaluate(() => {
            window.useStore.getState().setConversationMode('boardroom');
            window.useStore.setState({ activeAgents: ['publicist'] });
        });
        
        // Wait for the modal to be visible
        await expect(page.locator('[data-testid="boardroom-module"]')).toBeVisible();
    });

    test('Publicist Agent successfully hits the MCP harness and triggers generate_playlist_pitch', async ({ authedPage: page }) => {
        // The auth fixture's Cloud Functions catch-all also matches :5001; let the
        // MCP gateway requests through to the local stub (loopback only).
        await page.route('**/mcpEndpoint/**', route => route.continue());

        // Send a message specifically targeting the new MCP tool with arguments that match its schema
        // This request asks the Boardroom to act on a Publicist tool: the real judge
        // classifies it as an action and routes it to the Publicist.
        await answerJudgeQuestions(page, { intent: 'action', specialist: 'publicist' });
        await page.fill('[data-testid="main-prompt-input"]', 'Generate a playlist pitch for releaseId "track-123" targeting the "RapCaviar" playlist with an aggressive angle.');
        await page.press('[data-testid="main-prompt-input"]', 'Enter');

        // The gateway really received the call, with the user's arguments.
        await expect.poll(() => mcpStub.calls, { timeout: 15000 }).toContainEqual({
            name: 'generate_playlist_pitch',
            args: expect.objectContaining({ releaseId: 'track-123' }),
        });

        // Raw tool payloads are system-only and never shown to the user; the
        // Publicist's message reports the executed remote tool instead.
        const locator = page.locator('[data-agent-id="publicist"] .message-content').last(); // bypass-strict: select latest message in chat thread
        await expect(locator).toContainText('Executed remote tool: generate_playlist_pitch', { timeout: 15000 });
    });
});
