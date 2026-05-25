import { expect } from '@playwright/test';
import { test } from './fixtures/auth';

test.describe('Boardroom Strategic Workflow Scenario', () => {
    test('should execute the complete flowchart dependency chain with dynamic seating and pulse unlock', async ({ authedPage: page }) => {
        // Enforce full desktop window size
        await page.setViewportSize({ width: 1280, height: 800 });

        // Setup custom Vertex AI multi-turn route interceptor with stateless state-machine parsing history
        await page.route(
            /.*(firebasevertexai|generativelanguage)\.googleapis\.com.*/,
            async (route) => {
                const method = route.request().method();
                if (method === 'OPTIONS') {
                    await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
                    return;
                }

                const postData = route.request().postData() || "";
                console.log(`[E2E:MockAI] Intercepted request. Payload size: ${postData.length} chars.`);

                // Parse the user message from the payload to avoid matching prompt history keywords
                let userMessage = "";
                try {
                    const parsed = JSON.parse(postData);
                    const contents = parsed.contents || [];
                    const userContents = contents.filter((c: any) => c.role === 'user');
                    if (userContents.length > 0) {
                        const lastUser = userContents[userContents.length - 1];
                        let rawText = lastUser.parts?.map((p: any) => p.text || '').join(' ') || '';
                        
                        // Lookback strategy: if it's a tool continuation, search backwards for the user command
                        if ((rawText.includes('Continue. Previous output') || rawText.includes('Successfully') || rawText.trim() === '') && userContents.length > 1) {
                            for (let i = userContents.length - 2; i >= 0; i--) {
                                const prevText = userContents[i].parts?.map((p: any) => p.text || '').join(' ') || '';
                                if (!prevText.includes('Continue. Previous output') && prevText.trim() !== '') {
                                    rawText = prevText;
                                    break;
                                }
                            }
                        }
                        userMessage = rawText;
                    }
                } catch (e) {
                    console.error('[E2E:MockAI] Failed to parse postData:', e);
                }

                // Extract the actual request text from the full system prompt/context block
                let actualRequest = userMessage;
                if (userMessage.includes('CURRENT REQUEST:')) {
                    const parts = userMessage.split('CURRENT REQUEST:');
                    actualRequest = parts[parts.length - 1].split('\n')[0].trim();
                }
                console.log(`[E2E:MockAI] Extracted Actual Request: "${actualRequest}"`);

                const isJSON = postData.includes("responseMimeType") && postData.includes("application/json");
                let parts: any[] = [];

                // 1. Check if this is an Autorater request (which expects structured JSON matching scorecard)
                if (actualRequest.includes('Intelligence Autorater') || postData.includes('overallPass') || postData.includes('goalCompletion')) {
                    console.log('[E2E:MockAI] Intercepted Autorater request. Returning mock scorecard.');
                    const scorecard = {
                        goalCompletion: 10,
                        adherence: 10,
                        coherence: 10,
                        toolEfficiency: 10,
                        reasoning: "Mock evaluation trace passes.",
                        overallPass: true
                    };
                    const autoraterResponse = {
                        candidates: [
                            {
                                content: {
                                    role: 'model',
                                    parts: [
                                        { text: JSON.stringify(scorecard) }
                                    ]
                                },
                                finishReason: 'STOP'
                            }
                        ]
                    };
                    await route.fulfill({
                        status: 200,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': '*',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(autoraterResponse)
                    });
                    return;
                }

                const requestLower = actualRequest.toLowerCase();
                const postDataLower = postData.toLowerCase();

                // 2. Main strategic workflow state machine
                if (requestLower.includes('done') || requestLower.includes('clear') || requestLower.includes('unseat') || requestLower.includes('excuse')) {
                    const hasUnseatedCreative = requestLower.includes('[tool: unseat_agent]') && requestLower.includes('creative');
                    const hasUnseatedRoad = requestLower.includes('[tool: unseat_agent]') && requestLower.includes('road');
                    const hasUnseatedMarketing = requestLower.includes('[tool: unseat_agent]') && requestLower.includes('marketing');
                    const hasUnseatedSocial = requestLower.includes('[tool: unseat_agent]') && requestLower.includes('social');

                    if (!hasUnseatedCreative) {
                        parts = [
                            { text: "[indii Conductor]: Strategic goal successfully met! Excusing Creative Director first." },
                            { functionCall: { name: 'unseat_agent', args: { targetAgentId: 'creative' } } }
                        ];
                    } else if (!hasUnseatedRoad) {
                        parts = [
                            { text: "Creative Director excused. Excusing Road Manager next." },
                            { functionCall: { name: 'unseat_agent', args: { targetAgentId: 'road' } } }
                        ];
                    } else if (!hasUnseatedMarketing) {
                        parts = [
                            { text: "Road Manager excused. Excusing Marketing next." },
                            { functionCall: { name: 'unseat_agent', args: { targetAgentId: 'marketing' } } }
                        ];
                    } else if (!hasUnseatedSocial) {
                        parts = [
                            { text: "Marketing excused. Excusing Social Specialist finally." },
                            { functionCall: { name: 'unseat_agent', args: { targetAgentId: 'social' } } }
                        ];
                    } else {
                        parts = [
                            { text: "[indii Conductor]: All agents excused. Boardroom table cleared successfully." }
                        ];
                    }
                } else if (requestLower.includes('materials') || requestLower.includes('drafts') || requestLower.includes('schedule')) {
                    parts = [
                        { text: "[Marketing Dept.]: EPK materials are drafted and aligned with the new album styling." },
                        { text: "[Social Media Dept.]: Draft announcement flyer scheduled for Instagram & Twitter rollout." }
                    ];
                } else if (requestLower.includes('locked') || requestLower.includes('rollout') || requestLower.includes('pulse')) {
                    const hasSeatedMarketing = requestLower.includes('[tool: seat_agent]') && requestLower.includes('marketing');
                    const hasSeatedSocial = requestLower.includes('[tool: seat_agent]') && requestLower.includes('social');

                    if (!hasSeatedMarketing) {
                        parts = [
                            { text: "[indii Conductor]: Pulse trigger! Album art is saved to Firebase Gallery and Detroit dates are confirmed. Seating Marketing first." },
                            { functionCall: { name: 'seat_agent', args: { targetAgentId: 'marketing' } } }
                        ];
                    } else if (!hasSeatedSocial) {
                        parts = [
                            { text: "Marketing is seated. Seating Social Specialist next." },
                            { functionCall: { name: 'seat_agent', args: { targetAgentId: 'social' } } }
                        ];
                    } else {
                        parts = [
                            { text: "[indii Conductor]: Marketing and Social Specialist are seated. Dynamic rollout team active." }
                        ];
                    }
                } else if (requestLower.includes('generate') || requestLower.includes('advance')) {
                    parts = [
                        { text: "[Creative Director]: Generating general album imagery for the launch... Saved to Firebase Gallery." },
                        { text: "[Road Director]: Planning Detroit venue advance & driving logistics. Confirmed tour dates established." }
                    ];
                } else if (requestLower.includes('detroit') || requestLower.includes('tour')) {
                    const hasSeatedCreative = requestLower.includes('[tool: seat_agent]') && requestLower.includes('creative');
                    const hasSeatedRoad = requestLower.includes('[tool: seat_agent]') && requestLower.includes('road');

                    if (!hasSeatedCreative) {
                        parts = [
                            { text: "[indii Conductor]: Starting the Detroit Tour & Album Launch strategy. Seating the Creative Director first." },
                            { functionCall: { name: 'seat_agent', args: { targetAgentId: 'creative' } } }
                        ];
                    } else if (!hasSeatedRoad) {
                        parts = [
                            { text: "Creative Director is seated. Seating Road Manager next." },
                            { functionCall: { name: 'seat_agent', args: { targetAgentId: 'road' } } }
                        ];
                    } else {
                        parts = [
                            { text: "[indii Conductor]: Strategic swarm activated. Creative Director and Road Manager are seated at the table." }
                        ];
                    }
                } else {
                    parts = [
                        { text: "Meeting in progress." }
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
            return msgs.some(m => m.text?.includes('album imagery'));
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
            return msgs.some(m => m.text?.includes('announcement flyer'));
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
