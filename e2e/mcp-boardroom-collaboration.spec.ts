import { expect } from '@playwright/test';
import { test } from './fixtures/auth';
import { answerJudgeQuestions } from './fixtures/judgeOverrides';

test.describe('Boardroom Collaboration via MCP', () => {
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
                            text: "MOCK_DATA_FROM_MCP_SERVER: A2A collaboration successful"
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

        // Send a message targeting the manager, who should delegate to the publicist
        // This request asks the Boardroom to act on a Publicist tool: the real judge
        // classifies it as an action and routes it to the Publicist.
        await answerJudgeQuestions(page, { intent: 'action', specialist: 'publicist' });
        await page.fill('[data-testid="main-prompt-input"]', 'Hey Manager, please coordinate with the Publicist to generate a playlist pitch.');
        await page.press('[data-testid="main-prompt-input"]', 'Enter');

        // Wait for both agents to respond
        await page.waitForFunction(() => {
            const state = window.useStore.getState();
            const msgs = state.agentHistory || [];
            
            // Check if both manager and publicist have responded
            const hasManagerResponse = msgs.some(m => m.role === 'model' && m.agentId === 'manager');
            const hasPublicistResponse = msgs.some(m => m.role === 'model' && m.agentId === 'publicist' && m.text.includes('MOCK_DATA_FROM_MCP_SERVER'));
            
            return hasManagerResponse && hasPublicistResponse;
        }, { timeout: 20000 });

        // Stronger assertion checking the actual UI
        const locator = page.locator('[data-agent-id="publicist"] .message-content').last(); // bypass-strict: select latest message in chat thread
        await expect(locator).toContainText('MOCK_DATA_FROM_MCP_SERVER', { timeout: 15000 });
    });
});
