import { expect } from '@playwright/test';
import { test } from './fixtures/auth';

test.describe('Boardroom Real User Multi-Turn Scenario', () => {
    test('should execute a realistic multi-turn conversation with dynamic seating and unseating', async ({ authedPage: page }) => {
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

                const postData = route.request().postData() || '';
                console.log(`[E2E:MockAI] Intercepted request. Payload size: ${postData.length} chars.`);

                // Parse the user message from the payload to avoid matching prompt history keywords
                let userMessage = '';
                try {
                    const parsed = JSON.parse(postData);
                    const contents = parsed.contents || [];
                    const userContents = contents.filter((c: any) => c.role === 'user');
                    if (userContents.length > 0) {
                        const lastUser = userContents[userContents.length - 1];
                        userMessage = lastUser.parts?.map((p: any) => p.text || '').join(' ') || '';
                    }
                } catch (e) {
                    console.error('[E2E:MockAI] Failed to parse postData:', e);
                }
                console.log(`[E2E:MockAI] Extracted User Message: "${userMessage}"`);

                let parts: any[] = [];

                if (userMessage.includes('done for today') || userMessage.includes('Clear the table') || userMessage.includes('clear the table')) {
                    // Turn 7: Unseating Legal, Brand, and Music
                    const hasUnseatedLegal = postData.includes('"name": "unseat_agent"') && postData.includes('"targetAgentId": "legal"');
                    const hasUnseatedBrand = postData.includes('"name": "unseat_agent"') && postData.includes('"targetAgentId": "brand"');
                    const hasUnseatedMusic = postData.includes('"name": "unseat_agent"') && postData.includes('"targetAgentId": "music"');

                    if (!hasUnseatedLegal) {
                        parts = [
                            { text: "[Executor]: Clearing the boardroom table. Excusing Legal department." },
                            { functionCall: { name: 'unseat_agent', args: { targetAgentId: 'legal' } } }
                        ];
                    } else if (!hasUnseatedBrand) {
                        parts = [
                            { text: "Legal has been excused. Unseating Brand next." },
                            { functionCall: { name: 'unseat_agent', args: { targetAgentId: 'brand' } } }
                        ];
                    } else if (!hasUnseatedMusic) {
                        parts = [
                            { text: "Brand has been excused. Unseating Music Director finally." },
                            { functionCall: { name: 'unseat_agent', args: { targetAgentId: 'music' } } }
                        ];
                    } else {
                        parts = [
                            { text: "Cleared the boardroom table! Excellent session today." }
                        ];
                    }
                } else if (userMessage.includes('artistic vibe') || userMessage.includes('Brand and Music') || userMessage.includes('align on')) {
                    // Turn 6: Seating Brand and Music
                    const hasSeatedBrand = postData.includes('"name": "seat_agent"') && postData.includes('"targetAgentId": "brand"');
                    const hasSeatedMusic = postData.includes('"name": "seat_agent"') && postData.includes('"targetAgentId": "music"');

                    if (!hasSeatedBrand) {
                        parts = [
                            { text: "[Executor]: Summoning Brand and Music Directors to align on the artistic vibe and release design." },
                            { functionCall: { name: 'seat_agent', args: { targetAgentId: 'brand' } } }
                        ];
                    } else if (!hasSeatedMusic) {
                        parts = [
                            { text: "Brand is seated. Summoning Music Director next." },
                            { functionCall: { name: 'seat_agent', args: { targetAgentId: 'music' } } }
                        ];
                    } else {
                        parts = [
                            { text: "[Brand Agent]: I recommend a sleek, dark-mode visual theme with vibrant accent highlights. [Music Director]: Pinned to the 'Neon Phantom' vibe. We'll use custom synth bass hooks." }
                        ];
                    }
                } else if (userMessage.includes('split sheet') || userMessage.includes('templates are we using')) {
                    // Turn 5: Ask Legal about licensing templates and split sheet agreements
                    parts = [
                        { text: "[Legal Dept.]: The visual split sheet agreement is drafted with a standard 50/50 split between producer and artist. Ready to send for signature." }
                    ];
                } else if (userMessage.includes('good to go') || userMessage.includes('excused') || userMessage.includes('thank you')) {
                    // Turn 4: Unseating Marketing and Finance
                    const hasUnseatedMarketing = postData.includes('"name": "unseat_agent"') && postData.includes('"targetAgentId": "marketing"');
                    const hasUnseatedFinance = postData.includes('"name": "unseat_agent"') && postData.includes('"targetAgentId": "finance"');

                    if (!hasUnseatedMarketing) {
                        parts = [
                            {
                                text: "[Executor]: Marketing and Finance, thank you for the budget details. You are excused."
                            },
                            {
                                functionCall: {
                                    name: 'unseat_agent',
                                    args: { targetAgentId: 'marketing' }
                                }
                            }
                        ];
                    } else if (!hasUnseatedFinance) {
                        parts = [
                            {
                                text: "Marketing unseated. Excusing Finance."
                            },
                            {
                                functionCall: {
                                    name: 'unseat_agent',
                                    args: { targetAgentId: 'finance' }
                                }
                            }
                        ];
                    } else {
                        parts = [
                            {
                                text: "Marketing and Finance have successfully left the Boardroom table."
                            }
                        ];
                    }
                } else if (userMessage.includes('check the agreements') || userMessage.includes('Legal') || userMessage.includes('legal')) {
                    // Turn 3: Summoning Legal
                    const hasSeatedLegal = postData.includes('"name": "seat_agent"') && postData.includes('"targetAgentId": "legal"');

                    if (!hasSeatedLegal) {
                        parts = [
                            {
                                text: "[Executor]: Bringing Legal into the discussion to review the campaign split sheet agreements."
                            },
                            {
                                functionCall: {
                                    name: 'seat_agent',
                                    args: { targetAgentId: 'legal' }
                                }
                            }
                        ];
                    } else {
                        parts = [
                            {
                                text: "[Legal Dept.]: I have reviewed the visual licensing templates. Everything aligns with our standard terms. The NDA is drafted and ready for review."
                            }
                        ];
                    }
                } else if (userMessage.includes('How much should we spend') || userMessage.includes('spend on this campaign')) {
                    // Turn 2: Marketing and Finance both respond to budget question
                    parts = [
                        {
                            text: "[Marketing Dept.]: We propose a $5,000 budget targeting TikTok ads and playlist pitching to support the upcoming release."
                        },
                        {
                            text: "[Finance Dept.]: A $5,000 marketing expense fits within our seasonal cash flow limits. However, we should secure contract splits first."
                        }
                    ];
                } else {
                    // Turn 1: Seating Marketing and Finance (Initial prompt)
                    const hasSeatedMarketing = postData.includes('"name": "seat_agent"') && postData.includes('"targetAgentId": "marketing"');
                    const hasSeatedFinance = postData.includes('"name": "seat_agent"') && postData.includes('"targetAgentId": "finance"');

                    if (!hasSeatedMarketing) {
                        parts = [
                            {
                                text: "[Executor]: Hello! I will seat Marketing and Finance at the table immediately to begin our campaign strategy session."
                            },
                            {
                                functionCall: {
                                    name: 'seat_agent',
                                    args: { targetAgentId: 'marketing' }
                                }
                            }
                        ];
                    } else if (!hasSeatedFinance) {
                        parts = [
                            {
                                text: "Marketing is seated. Now seating Finance."
                            },
                            {
                                functionCall: {
                                    name: 'seat_agent',
                                    args: { targetAgentId: 'finance' }
                                }
                            }
                        ];
                    } else {
                        parts = [
                            {
                                text: "Marketing and Finance are both seated at the table. Ready to discuss the campaign budget!"
                            }
                        ];
                    }
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

        // Open Boardroom production origin
        console.log('[E2E:Scenario] Navigating to studio web app...');
        await page.goto('https://indii-music-studio.web.app', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Set local storage items on the production origin to bypass onboarding and tours completely
        console.log('[E2E:Scenario] Injecting E2E localStorage bypasses to production origin...');
        await page.evaluate(() => {
            try {
                localStorage.setItem("FIREBASE_E2E_MOCK", "1");
                localStorage.setItem("onboarding_dismissed", "true");
                localStorage.setItem("indii_tour_completed_v1", "true");
                localStorage.setItem("indii_cookie_consent", JSON.stringify({
                    essential: true,
                    analytics: false,
                    errorTracking: false,
                    marketing: false,
                    timestamp: new Date().toISOString(),
                    version: 1,
                }));
                localStorage.setItem("E2E_DISTRIBUTOR_CONNECTIONS", JSON.stringify([
                    { distributorId: "distrokid", isConnected: false, features: { canCreateRelease: true, canUpdateRelease: true, canTakedown: true, canFetchEarnings: true, canFetchAnalytics: true } },
                    { distributorId: "tunecore", isConnected: true, features: { canCreateRelease: true, canUpdateRelease: true, canTakedown: true, canFetchEarnings: true, canFetchAnalytics: true } },
                    { distributorId: "cdbaby", isConnected: true, features: { canCreateRelease: true, canUpdateRelease: true, canTakedown: true, canFetchEarnings: true, canFetchAnalytics: true } },
                    { distributorId: "symphonic", isConnected: true, features: { canCreateRelease: true, canUpdateRelease: true, canTakedown: true, canFetchEarnings: true, canFetchAnalytics: true } },
                ]));
            } catch (e) {
                console.error('Failed to set localStorage on production origin:', e);
            }
        });

        // Reload to apply localStorage bypasses
        console.log('[E2E:Scenario] Reloading page to boot with localStorage mock context...');
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

        // Force transition to Boardroom mode
        console.log('[E2E:Scenario] Programmatically changing conversation mode to Boardroom...');
        await page.waitForFunction(() => window.useStore !== undefined, { timeout: 15000 });
        await page.evaluate(() => {
            window.useStore.getState().setConversationMode('boardroom');
        });
        await expect(page.locator('[data-testid="boardroom-module"]')).toBeVisible({ timeout: 15000 });

        // Helper to sweep popovers and active body pointer blocks
        const cleanOverlays = async () => {
            console.log('[E2E:Scenario] Sweeping Driver.js overlays and resetting pointerEvents...');
            await page.evaluate(() => {
                if ((window as any).driverObj) {
                    try {
                        (window as any).driverObj.destroy();
                    } catch (e) {}
                }
                document.body.classList.remove('driver-active', 'driver-fade');
                document.body.style.pointerEvents = 'auto';
                document.querySelectorAll('.driver-overlay, .driver-popover, .driver-overlay-animated').forEach(el => el.remove());
            });
            await page.waitForTimeout(500);
        };

        // Sweep initial overlays
        await cleanOverlays();

        // ----------------------------------------------------
        // TURN 1: Greet and Seat Marketing & Finance
        // ----------------------------------------------------
        console.log('[E2E:Scenario] Turn 1: Submitting request to seat Marketing and Finance...');
        await cleanOverlays();
        await page.fill('[data-testid="main-prompt-input"]', "Let's bring in Marketing and Finance");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for Marketing to be seated
        console.log('[E2E:Scenario] Waiting for Marketing to seat...');
        await page.waitForFunction(() => {
            return window.useStore.getState().activeAgents.includes('marketing');
        }, { timeout: 20000 });

        // Wait for Finance to be seated
        console.log('[E2E:Scenario] Waiting for Finance to seat...');
        await page.waitForFunction(() => {
            return window.useStore.getState().activeAgents.includes('finance');
        }, { timeout: 20000 });

        // Take Turn 1 screenshot
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/media__1779694161957.png' });
        console.log('[E2E:Scenario] Turn 1 Seating verified. Captured screenshot.');

        // ----------------------------------------------------
        // TURN 2: Campaign Budget Discussion
        // ----------------------------------------------------
        console.log('[E2E:Scenario] Turn 2: Asking budget question...');
        await cleanOverlays();
        await page.fill('[data-testid="main-prompt-input"]', "How much should we spend on this campaign?");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for responses
        await page.waitForFunction(() => {
            const msgs = window.useStore.getState().boardroomMessages || [];
            return msgs.some(m => m.text?.includes('$5,000') && m.agentId === 'marketing');
        }, { timeout: 20000 });
        console.log('[E2E:Scenario] Turn 2 responses verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn2_budget.png' });

        // ----------------------------------------------------
        // TURN 3: Summon Legal
        // ----------------------------------------------------
        console.log('[E2E:Scenario] Turn 3: Asking to bring in Legal...');
        await cleanOverlays();
        await page.fill('[data-testid="main-prompt-input"]', "Let's bring in Legal to check the agreements");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for Legal to be seated
        await page.waitForFunction(() => {
            return window.useStore.getState().activeAgents.includes('legal');
        }, { timeout: 20000 });
        console.log('[E2E:Scenario] Turn 3 Legal seating verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn3_legal_seated.png' });

        // ----------------------------------------------------
        // TURN 4: Dismiss Marketing & Finance
        // ----------------------------------------------------
        console.log('[E2E:Scenario] Turn 4: Asking to excuse Marketing and Finance...');
        await cleanOverlays();
        await page.fill('[data-testid="main-prompt-input"]', "Marketing and Finance, you are good to go, thank you");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for Marketing and Finance to be unseated (removed from the table)
        console.log('[E2E:Scenario] Waiting for Marketing & Finance to be unseated...');
        await page.waitForFunction(() => {
            const active = window.useStore.getState().activeAgents;
            return !active.includes('marketing') && !active.includes('finance');
        }, { timeout: 20000 });

        // Verify remaining active agents
        const seatedAfterTurn4 = await page.evaluate(() => window.useStore.getState().activeAgents);
        console.log('[E2E:Scenario] Seated Agents after Turn 4:', seatedAfterTurn4);
        expect(seatedAfterTurn4).toContain('legal');
        expect(seatedAfterTurn4).not.toContain('marketing');
        expect(seatedAfterTurn4).not.toContain('finance');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn4_unseated.png' });

        // ----------------------------------------------------
        // TURN 5: Ask Legal about Split Agreement
        // ----------------------------------------------------
        console.log('[E2E:Scenario] Turn 5: Asking Legal about visual split sheets...');
        await cleanOverlays();
        await page.fill('[data-testid="main-prompt-input"]', "Legal, what templates are we using and what is the visual split sheet agreement?");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for response
        await page.waitForFunction(() => {
            const msgs = window.useStore.getState().boardroomMessages || [];
            return msgs.some(m => m.text?.includes('50/50 split') && m.agentId === 'legal');
        }, { timeout: 20000 });
        console.log('[E2E:Scenario] Turn 5 Legal response verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn5_legal_split.png' });

        // ----------------------------------------------------
        // TURN 6: Seat Brand and Music
        // ----------------------------------------------------
        console.log('[E2E:Scenario] Turn 6: Seating Brand and Music Directors...');
        await cleanOverlays();
        await page.fill('[data-testid="main-prompt-input"]', "Brand and Music, let's align on the artistic vibe");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for Brand to be seated
        await page.waitForFunction(() => {
            return window.useStore.getState().activeAgents.includes('brand');
        }, { timeout: 20000 });

        // Wait for Music to be seated
        await page.waitForFunction(() => {
            return window.useStore.getState().activeAgents.includes('music');
        }, { timeout: 20000 });

        console.log('[E2E:Scenario] Turn 6 Brand and Music seating verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn6_swarm_seated.png' });

        // ----------------------------------------------------
        // TURN 7: Clear the boardroom table
        // ----------------------------------------------------
        console.log('[E2E:Scenario] Turn 7: Clearing the boardroom table...');
        await cleanOverlays();
        await page.fill('[data-testid="main-prompt-input"]', "Thank you team, we are done for today. Clear the table.");
        await page.click('[data-testid="command-bar-run-btn"]');

        // Wait for Legal, Brand, and Music to be unseated
        await page.waitForFunction(() => {
            const active = window.useStore.getState().activeAgents;
            return !active.includes('legal') && !active.includes('brand') && !active.includes('music');
        }, { timeout: 20000 });

        const finalSeated = await page.evaluate(() => window.useStore.getState().activeAgents);
        console.log('[E2E:Scenario] Final Seated Agents:', finalSeated);
        expect(finalSeated).not.toContain('legal');
        expect(finalSeated).not.toContain('brand');
        expect(finalSeated).not.toContain('music');

        // Capture final boardroom state screenshot (showing labels, empty table, Conductor seated)
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/.tempmediaStorage/media_3e1aa88c-2608-40c1-a35b-af5e12444c40_1779714383863.png' });
        console.log('[E2E:Scenario] Multi-turn test completely successful! Seated agents correct and visual proof captured.');
    });
});
