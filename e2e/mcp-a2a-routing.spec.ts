import { expect } from '@playwright/test';
import { test } from './fixtures/auth';

test.describe('A2A Routing to MCP Tools', () => {
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
            const sseResponse = `event: endpoint\ndata: /indii-music-founder/us-central1/mcpEndpoint/message\n\n`;
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
        await page.fill('[data-testid="main-prompt-input"]', 'Generate a playlist pitch for releaseId "track-123" targeting the "RapCaviar" playlist with an aggressive angle.');
        await page.click('[data-testid="command-bar-run-btn"]');

        // Stronger assertion checking the actual UI
        const locator = page.locator('[data-agent-id="publicist"] .message-content').last();
        await expect(locator).toContainText('MOCK_DATA_FROM_MCP_SERVER', { timeout: 15000 });
    });
});
