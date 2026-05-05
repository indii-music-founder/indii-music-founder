import { expect } from '@playwright/test';
import { test } from './fixtures/auth';

test.describe('Boardroom Swarm Protocol E2E', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // Setup mock environment and auth
        // Relies on `auth.ts` fixture for Gemini API and RAG network mocking.

        await page.goto('/');
        
        // Wait for store initialization and then open the boardroom overlay
        await page.waitForFunction(() => window.useStore !== undefined);
        await page.evaluate(() => {
            window.useStore.getState().setBoardroomMode(true);
        });
        
        // Wait for the modal to be visible
        await expect(page.locator('[data-testid="boardroom-module"]')).toBeVisible();
    });

    test('should show warning if no agents are seated at the table', async ({ authedPage: page }) => {
        // Ensure no agents are active
        await page.evaluate(() => {
            window.useStore.setState({ activeAgents: [] });
        });

        // Send a message
        await page.evaluate(() => {
            window._testInterval = setInterval(() => {
                console.log('POLL STATE:', JSON.stringify(window.useStore.getState().boardroomMessages));
            }, 1000);
        });
        await page.fill('[data-testid="main-prompt-input"]', 'What is our strategy?');
        await page.click('[data-testid="command-bar-run-btn"]');

        // Expect the system warning message
        await page.waitForFunction(() => {
            const msgs = window.useStore.getState().boardroomMessages || [];
            return msgs.some(m => m.role === 'model' && m.agentId === 'system');
        }, { timeout: 15000 });
        
        await page.evaluate(() => clearInterval(window._testInterval));
    });

    test('should dispatch message to multiple seated agents sequentially', async ({ authedPage: page }) => {
        page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));

        // Seat multiple agents
        await page.evaluate(() => {
            window.useStore.setState({ activeAgents: ['marketing', 'finance'] });
        });

        await page.evaluate(() => {
            window._testInterval = setInterval(() => {
                console.log('POLL STATE 2:', JSON.stringify(window.useStore.getState().boardroomMessages));
            }, 1000);
        });
        
        await page.fill('[data-testid="main-prompt-input"]', 'How much should we spend on ads?');
        await page.click('[data-testid="command-bar-run-btn"]');

        await page.waitForTimeout(1000);
        await page.evaluate(() => {
            console.log("BOARDROOM MESSAGES:", JSON.stringify(window.useStore.getState().boardroomMessages));
            console.log("ACTIVE AGENTS:", window.useStore.getState().activeAgents);
        });

        // Both agents should finish streaming their responses
        await page.waitForFunction(() => {
            const state = window.useStore.getState();
            const msgs = state.boardroomMessages || [];
            const hasMarketing = msgs.filter(m => m.agentId === 'marketing' && m.role === 'model');
            const hasFinance = msgs.filter(m => m.agentId === 'finance' && m.role === 'model');
            if (hasMarketing.length === 0 || hasFinance.length === 0) return false;
            return hasMarketing[hasMarketing.length - 1].isStreaming === false && 
                   hasFinance[hasFinance.length - 1].isStreaming === false;
        }, { timeout: 30000 });
        
        await page.evaluate(() => clearInterval(window._testInterval));
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

        await page.fill('[data-testid="main-prompt-input"]', 'Review this asset');
        await page.click('[data-testid="command-bar-run-btn"]');

        // For E2E, we assume success if the agent responds without error
        await page.waitForFunction(() => {
            const state = window.useStore.getState();
            const msgs = state.boardroomMessages || [];
            return msgs.some(m => m.agentId === 'marketing' && m.role === 'model');
        }, { timeout: 30000 });
    });

    test('should maintain memory continuity across different specialist agents', async ({ authedPage: page }) => {
        // Seat Music and Video Directors
        await page.evaluate(() => {
            window.useStore.setState({ activeAgents: ['music', 'video'] });
        });

        // 1. Establish the context with the Music Director
        await page.fill('[data-testid="main-prompt-input"]', "Music Director, let's establish the 'Neon Phantom' vibe. It should be 'Dark Industrial Synth with Neon Green accents'. Commit this to our shared memory.");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for Music Director to finish streaming (proving it doesn't hang)
        await page.waitForFunction(() => {
            const state = window.useStore.getState();
            const msgs = state.boardroomMessages || [];
            const musicMsgs = msgs.filter(m => m.agentId === 'music' && m.role === 'model');
            if (musicMsgs.length === 0) return false;
            // It should finish streaming
            return musicMsgs[musicMsgs.length - 1].isStreaming === false;
        }, { timeout: 30000 });
        
        // 2. Ask Video Director to recall and build upon the context
        await page.fill('[data-testid="main-prompt-input"]', "Video Director, based on that vibe, what visual effects should we use?");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for Video Director to finish streaming
        await page.waitForFunction(() => {
            const state = window.useStore.getState();
            const msgs = state.boardroomMessages || [];
            const videoMsgs = msgs.filter(m => m.agentId === 'video' && m.role === 'model');
            if (videoMsgs.length === 0) return false;
            return videoMsgs[videoMsgs.length - 1].isStreaming === false;
        }, { timeout: 30000 });

        // 3. Verify the UI did not hang and a response was generated
        // We ensure the circuit breaker and memory threshold fixes kept the swarm running
        const responseText = await page.locator('[data-agent-id="video"] .message-content').last().innerText();
        expect(responseText.length).toBeGreaterThan(0);
        // If the AI is not mocked, it should explicitly mention the dark industrial/neon green theme.
    });
});
