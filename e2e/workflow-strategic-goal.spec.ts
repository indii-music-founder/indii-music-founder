import { expect } from '@playwright/test';
import { test } from './fixtures/auth';

test.describe('Boardroom Strategic Workflow Scenario', () => {
    test('should execute the complete flowchart dependency chain with dynamic seating and pulse unlock', async ({ authedPage: page }) => {
        // Enforce full desktop window size
        await page.setViewportSize({ width: 1280, height: 800 });

        // Setup custom Vertex AI multi-turn route interceptor
        let turn = 0;
        let creativeSeated = false;
        let roadSeated = false;
        let marketingSeated = false;
        let socialSeated = false;
        let unseatIndex = 0;

        await page.route(
            /.*(firebasevertexai|generativelanguage)\.googleapis\.com.*/,
            async (route) => {
                const method = route.request().method();
                if (method === 'OPTIONS') {
                    await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
                    return;
                }

                const postData = route.request().postData() || "";
                console.log(`[E2E:MockAI] Intercepted Vertex call`);

                let lastText = "";
                let lastFunctionResponseName = "";
                try {
                    const parsed = JSON.parse(postData);
                    const contents = parsed.contents || [];
                    console.log(`[E2E:MockAI] contents: ${JSON.stringify(contents)}`);
                    const lastContent = contents[contents.length - 1];
                    if (lastContent && lastContent.parts) {
                        for (const part of lastContent.parts) {
                            if (part.text) {
                                lastText += part.text + " ";
                            }
                            if (part.functionResponse) {
                                lastFunctionResponseName = part.functionResponse.name;
                            }
                        }
                    }
                } catch (e) {
                    // Fallback to postData string checking
                }

                const isJSON = postData.includes("responseMimeType") && postData.includes("application/json");

                let parts: any[] = [];

                const isSeatAgent = lastFunctionResponseName === "seat_agent" || lastText.includes("[Tool: seat_agent]");
                const isUnseatAgent = lastFunctionResponseName === "unseat_agent" || lastText.includes("[Tool: unseat_agent]");

                console.log(`[E2E:MockAI] url: ${route.request().url()}`);
                console.log(`[E2E:MockAI] isJSON: ${isJSON}, isSeatAgent: ${isSeatAgent}, isUnseatAgent: ${isUnseatAgent}`);
                console.log(`[E2E:MockAI] lastText substring: "${lastText.slice(-300)}"`);
                console.log(`[E2E:MockAI] Seating state - creativeSeated: ${creativeSeated}, roadSeated: ${roadSeated}, marketingSeated: ${marketingSeated}, socialSeated: ${socialSeated}`);

                if (isJSON) {
                    if (postData.includes("goalCompletion") || postData.includes("overallPass")) {
                        parts = [
                            {
                                text: JSON.stringify({
                                    goalCompletion: 10,
                                    adherence: 10,
                                    coherence: 10,
                                    toolEfficiency: 10,
                                    reasoning: "Perfect execution.",
                                    overallPass: true
                                })
                            }
                        ];
                    } else {
                        parts = [
                            {
                                text: JSON.stringify({ success: true })
                            }
                        ];
                    }
                } else if (isSeatAgent) {
                    if (lastText.includes("Successfully seated the social agent")) {
                        socialSeated = true;
                        parts = [
                            { text: "Social Specialist seated. Rollout team is fully ready." }
                        ];
                        console.log("[E2E:MockAI] Match: Successfully seated the social agent");
                    } else if (lastText.includes("Successfully seated the marketing agent")) {
                        marketingSeated = true;
                        parts = [
                            { text: "Marketing seated. Seating Social Specialist now." },
                            {
                                functionCall: {
                                    name: 'seat_agent',
                                    args: { targetAgentId: 'social' }
                                }
                            }
                        ];
                        console.log("[E2E:MockAI] Match: Successfully seated the marketing agent");
                    } else if (lastText.includes("Successfully seated the road agent")) {
                        roadSeated = true;
                        parts = [
                            { text: "Road Manager seated. Both primary agents are ready." }
                        ];
                        console.log("[E2E:MockAI] Match: Successfully seated the road agent");
                    } else if (lastText.includes("Successfully seated the creative agent") || !creativeSeated) {
                        creativeSeated = true;
                        parts = [
                            { text: "Creative Director seated. Seating Road Manager now." },
                            {
                                functionCall: {
                                    name: 'seat_agent',
                                    args: { targetAgentId: 'road' }
                                }
                            }
                        ];
                        console.log("[E2E:MockAI] Match: Successfully seated the creative agent / default");
                    }
                } else if (isUnseatAgent) {
                    if (lastText.includes("Successfully unseated the social agent")) {
                        parts = [
                            { text: "Meeting adjourned. Swarm is idle." }
                        ];
                        console.log("[E2E:MockAI] Match: Successfully unseated the social agent");
                    } else if (lastText.includes("Successfully unseated the marketing agent")) {
                        parts = [
                            {
                                functionCall: {
                                    name: 'unseat_agent',
                                    args: { targetAgentId: 'social' }
                                }
                            }
                        ];
                        console.log("[E2E:MockAI] Match: Successfully unseated the marketing agent");
                    } else if (lastText.includes("Successfully unseated the road agent")) {
                        parts = [
                            {
                                functionCall: {
                                    name: 'unseat_agent',
                                    args: { targetAgentId: 'marketing' }
                                }
                            }
                        ];
                        console.log("[E2E:MockAI] Match: Successfully unseated the road agent");
                    } else if (lastText.includes("Successfully unseated the creative agent") || unseatIndex === 0) {
                        unseatIndex = 1;
                        parts = [
                            {
                                functionCall: {
                                    name: 'unseat_agent',
                                    args: { targetAgentId: 'road' }
                                }
                            }
                        ];
                        console.log("[E2E:MockAI] Match: Successfully unseated the creative agent / default");
                    }
                } else if (lastText.includes("plan a Detroit tour") || lastText.includes("Detroit tour with the new album art")) {
                    parts = [
                        {
                            text: "[indii Conductor]: Starting the Detroit Tour & Album Launch strategy. Seating the Creative Director and Road Manager to begin planning."
                        },
                        {
                            functionCall: {
                                name: 'seat_agent',
                                args: { targetAgentId: 'creative' }
                            }
                        }
                    ];
                } else if (lastText.includes("generate the art") || lastText.includes("plan Detroit advance")) {
                    parts = [
                        {
                            text: "[Creative Director]: Generating general album imagery for the launch..."
                        },
                        {
                            text: "[Road Director]: Planning Detroit venue advance & driving logistics..."
                        }
                    ];
                } else if (lastText.includes("Trigger rollout") || lastText.includes("locked. Trigger rollout")) {
                    parts = [
                        {
                            text: "[indii Conductor]: Pulse trigger! Album art is saved to Firebase Gallery and Detroit dates are confirmed. Seating Marketing & Social."
                        },
                        {
                            functionCall: {
                                name: 'seat_agent',
                                args: { targetAgentId: 'marketing' }
                            }
                        }
                    ];
                } else if (lastText.includes("rollout materials") || lastText.includes("schedule drafts")) {
                    parts = [
                        {
                            text: "[Marketing Dept.]: EPK materials are drafted and aligned with the new album styling."
                        },
                        {
                            text: "[Social Media Dept.]: Draft announcement flyer scheduled for Instagram & Twitter rollout."
                        }
                    ];
                } else if (lastText.includes("Clear the boardroom") || lastText.includes("We are done")) {
                    parts = [
                        {
                            text: "[indii Conductor]: Strategic goal successfully met! Excusing all seated agents and adjourning."
                        },
                        {
                            functionCall: {
                                name: 'unseat_agent',
                                args: { targetAgentId: 'creative' }
                            }
                        }
                    ];
                } else {
                    parts = [
                        {
                            text: "Meeting in progress."
                        }
                    ];
                }

                const responseObj = {
                    candidates: [
                        {
                            content: {
                                role: 'model',
                                parts: parts
                            },
                            finishReason: 'STOP'
                        }
                    ]
                };

                const isSSE = route.request().url().includes('streamGenerateContent');

                if (isSSE) {
                    await route.fulfill({
                        status: 200,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': '*',
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive'
                        },
                        body: `data: ${JSON.stringify(responseObj)}\n\n`
                    });
                } else {
                    await route.fulfill({
                        status: 200,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': '*',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(responseObj)
                    });
                }
            }
        );

        // Open Boardroom
        console.log('[E2E:Strategic] Navigating and opening Boardroom...');
        await page.goto('/');
        await page.waitForFunction(() => typeof window.useStore?.getState === 'function');
        await page.evaluate(() => {
            window.useStore.getState().setConversationMode('boardroom');
        });
        await expect(page.locator('[data-testid="boardroom-module"]')).toBeVisible();
        await page.waitForTimeout(2000);

        // ----------------------------------------------------
        // TURN 1: State Strategic Goal
        // ----------------------------------------------------
        console.log('[E2E:Strategic] Turn 1: Submitting strategic tour goal...');
        await page.fill('[data-testid="main-prompt-input"]', "Let's plan a Detroit tour with the new album art");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for Creative Director to seat
        console.log('[E2E:Strategic] Waiting for Creative Director to seat...');
        await page.waitForFunction(() => {
            const store = window.useStore;
            return typeof store?.getState === 'function' && store.getState().activeAgents.includes('creative');
        }, { timeout: 15000 });

        // Wait for Road Manager to seat
        console.log('[E2E:Strategic] Waiting for Road Manager to seat...');
        await page.waitForFunction(() => {
            const store = window.useStore;
            return typeof store?.getState === 'function' && store.getState().activeAgents.includes('road');
        }, { timeout: 15000 });

        // ----------------------------------------------------
        // TURN 2: Task Execution (Art & Tour Dates)
        // ----------------------------------------------------
        console.log('[E2E:Strategic] Turn 2: Requesting imagery and tour dates advance...');
        await page.fill('[data-testid="main-prompt-input"]', "Creative Director generate the art, Road Director plan Detroit advance");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for responses to register in messages
        await page.waitForFunction(() => {
            const store = window.useStore;
            if (typeof store?.getState !== 'function') return false;
            const msgs = store.getState().boardroomMessages || [];
            return msgs.some(m => m.text?.includes('album imagery') && m.agentId === 'creative');
        }, { timeout: 15000 });
        console.log('[E2E:Strategic] Creative and Road tasks registered.');

        // ----------------------------------------------------
        // TURN 3: Task Dependency (Pulse Unlock) & Marketing Seating
        // ----------------------------------------------------
        console.log('[E2E:Strategic] Turn 3: Triggers pulse to unlock flyer dependency...');
        await page.fill('[data-testid="main-prompt-input"]', "Imagery and dates are locked. Trigger rollout.");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for Marketing and Social to be seated
        await page.waitForFunction(() => {
            const store = window.useStore;
            if (typeof store?.getState !== 'function') return false;
            const active = store.getState().activeAgents;
            return active.includes('marketing') && active.includes('social');
        }, { timeout: 15000 });
        console.log('[E2E:Strategic] Pulse triggered. Marketing & Social seated successfully.');

        // ----------------------------------------------------
        // TURN 4: Marketing Rollout Copy
        // ----------------------------------------------------
        console.log('[E2E:Strategic] Turn 4: Social flyer rollout execution...');
        await page.fill('[data-testid="main-prompt-input"]', "Generate rollout materials and schedule drafts");
        await page.click('[data-testid="command-bar-run-btn"]');

        await page.waitForFunction(() => {
            const store = window.useStore;
            if (typeof store?.getState !== 'function') return false;
            const msgs = store.getState().boardroomMessages || [];
            return msgs.some(m => m.text?.includes('announcement flyer') && m.agentId === 'social');
        }, { timeout: 15000 });
        console.log('[E2E:Strategic] Rollout executed successfully.');

        // ----------------------------------------------------
        // TURN 5: Strategic Goal Complete & Dismiss Swarm
        // ----------------------------------------------------
        console.log('[E2E:Strategic] Turn 5: Adjourning and excusing the swarm...');
        await page.fill('[data-testid="main-prompt-input"]', "We are done. Clear the boardroom table.");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for all agents to be unseated
        await page.waitForFunction(() => {
            const store = window.useStore;
            if (typeof store?.getState !== 'function') return false;
            const active = store.getState().activeAgents;
            return !active.includes('creative') && !active.includes('road') && !active.includes('marketing') && !active.includes('social');
        }, { timeout: 15000 });

        const finalSeated = await page.evaluate(() => window.useStore?.getState?.()?.activeAgents || []);
        console.log('[E2E:Strategic] Final seated agents list:', finalSeated);
        expect(finalSeated).not.toContain('creative');
        expect(finalSeated).not.toContain('road');
        expect(finalSeated).not.toContain('marketing');
        expect(finalSeated).not.toContain('social');
        console.log('[E2E:Strategic] Boardroom strategic workflow E2E test completed and verified!');
    });
});
