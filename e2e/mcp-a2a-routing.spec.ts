import { expect } from '@playwright/test';
import { test } from './fixtures/auth';
import { answerJudgeQuestions } from './fixtures/judgeOverrides';

// @external-legacy: needs the deployed MCP gateway (Arcjet + Vertex + a release the account owns);
// route mocks cannot answer over the long-lived SSE stream (ISSUE-1691). Genuine coverage:
// e2e/mcp-publicist-live.spec.ts (@live, owner-run on indii.music).
test.describe('@external-legacy @structural A2A Routing to MCP Tools (mock auth, route-mocked MCP gateway)', () => {
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
        // Intercept the /mcpEndpoint/sse and /mcpEndpoint/message calls to simulate the Cloud Run MCP server
        await page.route('**/mcpEndpoint/sse', async (route) => {
            // Simulate SSE handshake
            // The message endpoint must sit under the configured gateway (assertMcpTransportDestination),
            // whose path includes the Firebase project id — derive it from the actual /sse request.
            const ssePath = new URL(route.request().url()).pathname;
            const sseResponse = `event: endpoint\ndata: ${ssePath.replace(/\/sse$/, '/message')}\n\n`;
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true',
                },
                body: sseResponse
            });
        });

        await page.route('**/mcpEndpoint/message', async (route) => {
            // Simulate the JSON-RPC response from the backend stub
            const requestBody = JSON.parse(route.request().postData() || '{}');
            const response = {
                jsonrpc: "2.0",
                id: requestBody.id,
                result: {
                    content: [
                        {
                            type: "text",
                            text: "MOCK_DATA_FROM_MCP_SERVER: generate_playlist_pitch executed successfully"
                        }
                    ]
                }
            };

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true',
                },
                body: JSON.stringify(response)
            });
        });

        // Send a message specifically targeting the new MCP tool with arguments that match its schema
        // This request asks the Boardroom to act on a Publicist tool: the real judge
        // classifies it as an action and routes it to the Publicist.
        await answerJudgeQuestions(page, { intent: 'action', specialist: 'publicist' });
        await page.fill('[data-testid="main-prompt-input"]', 'Generate a playlist pitch for releaseId "track-123" targeting the "RapCaviar" playlist with an aggressive angle.');
        await page.press('[data-testid="main-prompt-input"]', 'Enter');

        // Stronger assertion checking the actual UI
        const locator = page.locator('[data-agent-id="publicist"] .message-content').last(); // bypass-strict: select latest message in chat thread
        await expect(locator).toContainText('MOCK_DATA_FROM_MCP_SERVER', { timeout: 15000 });
    });
});
