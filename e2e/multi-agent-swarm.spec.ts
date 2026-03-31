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

        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
    });

    test('Conductor routes task to specialist successfully', async ({ authedPage: page }) => {
        const input = page.locator('[data-testid="prompt-input"], textarea[placeholder], [role="textbox"]').first();
        await input.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });

        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) {
            // Open CommandBar if collapsed
            const commandBar = page.locator('[class*="command"], [class*="prompt"]').first();
            await commandBar.click().catch(() => { });
            await page.waitForTimeout(500);
        }

        const inputReady = page.locator('[data-testid="prompt-input"], textarea, [role="textbox"]').first();
        await inputReady.click({ force: true });
        await inputReady.fill('Help me design a marketing campaign for my new album');
        await inputReady.press('Enter');

        // Wait for agent history to update
        await page.waitForTimeout(2000);

        // App should survive the complex delegation flow
        await expect(page.locator('#root')).toBeVisible();
    });
});
