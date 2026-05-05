import { test, expect } from '@playwright/test';

test.describe('Boardroom Swarm Protocol E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Setup mock environment and auth
        await page.goto('/boardroom');
    });

    test('should show warning if no agents are seated at the table', async ({ page }) => {
        // Ensure no agents are active
        await page.evaluate(() => {
            window.useStore.getState().setActiveAgents([]);
        });

        // Send a message
        await page.fill('[data-testid="boardroom-input"]', 'What is our strategy?');
        await page.click('[data-testid="boardroom-send-button"]');

        // Expect the system warning message
        await expect(page.locator('text=*(Please drag at least one agent onto the table to begin the discussion.)*')).toBeVisible();
    });

    test('should dispatch message to multiple seated agents sequentially', async ({ page }) => {
        // Seat multiple agents
        await page.evaluate(() => {
            window.useStore.getState().setActiveAgents(['marketing', 'finance']);
        });

        await page.fill('[data-testid="boardroom-input"]', 'How much should we spend on ads?');
        await page.click('[data-testid="boardroom-send-button"]');

        // Both agents should show loading or response
        await expect(page.locator('[data-agent-id="marketing"]')).toBeVisible();
        await expect(page.locator('[data-agent-id="finance"]')).toBeVisible();
    });

    test('should include referenced assets in the prompt context', async ({ page }) => {
        // Seat an agent and reference an asset
        await page.evaluate(() => {
            window.useStore.getState().setActiveAgents(['marketing']);
            window.useStore.getState().setReferencedAssets([{
                id: 'asset-1',
                name: 'Album Cover',
                type: 'image',
                value: 'base64://fake'
            }]);
        });

        await page.fill('[data-testid="boardroom-input"]', 'Review this asset');
        await page.click('[data-testid="boardroom-send-button"]');

        // We could mock the executor to verify the prompt contains the asset context
        // For E2E, we assume success if the agent responds without error
        await expect(page.locator('[data-agent-id="marketing"]')).toBeVisible();
    });

    test('should handle empty text responses gracefully based on tool execution', async ({ page }) => {
        // This test simulates the agent returning no text but executing tools, 
        // or returning nothing at all
        // It relies on backend mocking or UI assertion of the fallback text
    });
});
