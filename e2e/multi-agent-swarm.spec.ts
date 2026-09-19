import { test, expect } from './fixtures/auth';

/**
 * Multi-Agent Swarm E2E Tests
 * Validate the full chain: Conductor -> Specialist -> Action
 * 
 * Run: npx playwright test e2e/multi-agent-swarm.spec.ts
 */
test.describe('Multi-Agent Swarm Delegation', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // Mock Gemini to return a tool call for delegate_task when generalist is used
        await page.route('**/v1beta/models/**', async route => {
            const request = route.request();
            const postData = request.postData();

            if (postData && postData.includes('marketing') && postData.includes('delegate_task')) {
                // Mock specialist response
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        candidates: [{
                            content: {
                                parts: [{ text: 'Specialist marketing agent completed the task.' }],
                                role: 'model',
                            },
                        }]
                    })
                });
            } else if (postData && !postData.includes('marketing')) {
                // Mock indii Conductor routing to marketing
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        candidates: [{
                            content: {
                                parts: [
                                    { text: "I'll delegate this to the marketing specialist." },
                                    {
                                        functionCall: {
                                            name: "delegate_task",
                                            args: {
                                                targetAgentId: "marketing",
                                                task: "Analyze the campaign"
                                            }
                                        }
                                    }
                                ],
                                role: 'model',
                            },
                        }]
                    })
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        candidates: [{
                            content: {
                                parts: [{ text: 'Default execution completed.' }],
                                role: 'model',
                            }
                        }]
                    })
                });
            }
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#root', { timeout: 15_000 });
    });

    test('Conductor routes task to specialist successfully', async ({ authedPage: page }) => {
        const expandBtn = page.locator('[data-testid="command-bar-expand-button"]');
        if (await expandBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await expandBtn.click();
        }

        const input = page.locator('[data-testid="main-prompt-input"]');
        await expect(input).toBeVisible({ timeout: 10_000 });
        await input.click({ force: true });
        await input.fill('Help me design a marketing campaign for my new album');
        await input.press('Enter');

        // Verify that the specialist marketing agent received the task and completed it
        const agentMessage = page.locator('[data-agent-id="marketing"] [data-testid="agent-message"]');
        await expect(agentMessage).toBeVisible({ timeout: 15_000 });
        await expect(agentMessage).toContainText('Specialist marketing agent completed the task');
    });
});
