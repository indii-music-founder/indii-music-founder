import { expect } from '@playwright/test';
import { test } from './fixtures/auth';

test.describe('Boardroom Real User Multi-Turn Scenario', () => {
    test('should execute a realistic multi-turn conversation with dynamic seating and unseating', async ({ authedPage: page }) => {
        test.setTimeout(180_000);
        // Enforce full desktop window size
        await page.setViewportSize({ width: 1280, height: 800 });

        let currentActivePrompt = '';
        (globalThis as any).unseatedAgentsInTest = new Set<string>();

        // Setup custom Vertex AI multi-turn route interceptor with stateless state-machine parsing history
        await page.route(
            /.*(firebasevertexai|generativelanguage|ragProxy).*/,
            async (route) => {
                const method = route.request().method();
                if (method === 'OPTIONS') {
                    await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
                    return;
                }                const url = route.request().url();
                if (url.includes('embedContent') || url.includes('batchEmbedContents')) {
                    console.log(`[E2E:MockAI] Intercepted embedding request to URL: ${url}. Returning mock values.`);
                    const mockEmbeddingResponse = url.includes('batchEmbedContents') 
                        ? { embeddings: [{ values: Array(768).fill(0.01) }] }
                        : { embedding: { values: Array(768).fill(0.01) } };
                    await route.fulfill({
                        status: 200,
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Headers': '*',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(mockEmbeddingResponse)
                    });
                    return;
                }
                const postData = route.request().postData() || '';
                console.log(`[E2E:MockAI] Intercepted request. Payload size: ${postData.length} chars.`);

                // Parse the user message, system instruction, and agent ID from the payload
                let userMessage = '';
                let systemInstructionText = '';
                let extractedAgentId = '';
                try {
                    const parsed = JSON.parse(postData);
                    const contents = parsed.contents || [];
                    const userContents = contents.filter((c: any) => c.role === 'user');
                    if (userContents.length > 0) {
                        // Find the last user content that actually contains non-empty text parts and does NOT start with "Continue." to handle tool loops correctly
                        const userTextContents = userContents.filter((c: any) => 
                            c.parts?.some((p: any) => p.text && p.text.trim() && !p.text.trim().startsWith('Continue.'))
                        );
                        const lastUser = userTextContents.length > 0 ? userTextContents[userTextContents.length - 1] : userContents[userContents.length - 1];
                        userMessage = lastUser.parts?.map((p: any) => p.text || '').join(' ') || '';
                    }
                    const systemInstructionObj = parsed.systemInstruction || parsed.system_instruction || parsed.config?.systemInstruction || parsed.config?.system_instruction;
                    if (systemInstructionObj?.parts?.[0]?.text) {
                        systemInstructionText = systemInstructionObj.parts[0].text;
                    } else if (typeof systemInstructionObj === 'string') {
                        systemInstructionText = systemInstructionObj;
                    }
                    
                    // Attempt to extract agent ID from the context block in the payload
                    // In indii, context is serialized inside the prompt or history contents as JSON
                    const match = postData.match(/"agentId":\s*"([^"]+)"/);
                    if (match) {
                        extractedAgentId = match[1];
                    }
                } catch (e) {
                    console.error('[E2E:MockAI] Failed to parse postData:', e);
                }
                console.log(`[E2E:MockAI] Extracted User Message: "${userMessage.substring(0, 80)}..."`);
                console.log(`[E2E:MockAI] Extracted Agent ID: "${extractedAgentId}"`);
 
                // 1. Check if this is an Autorater request (which expects structured JSON matching scorecard)
                if (userMessage.includes('Intelligence Autorater') || postData.includes('overallPass') || postData.includes('goalCompletion')) {
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
                // 1.5. Check if this is a utility/helper request (like guidelines extraction or search)
                if (postData.length < 5000 && !userMessage.includes('Intelligence Autorater') && !postData.includes('overallPass')) {
                    console.log(`[E2E:MockAI] Fulfilling short utility request (size: ${postData.length} chars).`);
                    let utilityText = "*(Analysis complete)*";
                    if (postData.includes('Extract any') || userMessage.includes('Extract any')) {
                        utilityText = "No conflicting guidelines or specific restrictions found.";
                    }
                    const utilityResponse = {
                        candidates: [
                            {
                                content: {
                                    role: 'model',
                                    parts: [
                                        { text: utilityText }
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
                        body: JSON.stringify(utilityResponse)
                    });
                    return;
                }

                // 2. Extract the actual request text directly from the test-scoped currentActivePrompt variable for 100% fidelity
                let actualRequest = currentActivePrompt;
                console.log(`[E2E:MockAI] Extracted Actual Request from Test Scope: "${actualRequest}"`);
                console.log(`[E2E:MockAI] Extracted System Instruction: "${(systemInstructionText || '').substring(0, 100)}..."`);

                // Prioritize matching executing agent ID by checking the system instruction first
                // 1. Tool loops or continuations ALWAYS belong to the Conductor (generalist) in this boardroom spec
                let executingAgentId = 'generalist';
                const first1500 = userMessage.substring(0, 1500);

                const isUnseatCommand = actualRequest.toLowerCase().includes('done for today') || actualRequest.toLowerCase().includes('clear the table');

                if (isUnseatCommand) {
                    executingAgentId = 'generalist';
                }
                else if (userMessage.includes('Continue. Previous output:') || userMessage.includes('Continue.') || postData.includes('functionCall') || postData.includes('function_call') || postData.includes('functionResponse') || postData.includes('function_response')) {
                    executingAgentId = 'generalist';
                }
                // 2. Check if the prompt belongs to the Conductor first to prevent spoke agent name match hijackings
                else if (userMessage.includes('indii Conductor') || userMessage.includes('Conductor — System Prompt') || userMessage.includes('Conductor — Hub-and-Spoke') || (systemInstructionText && (systemInstructionText.includes('indii Conductor') || systemInstructionText.includes('Conductor — System Prompt')))) {
                    executingAgentId = 'generalist';
                }
                // 3. Otherwise, check spoke agent signatures
                else {
                    const checkStr = (systemInstructionText || '') + '\n' + first1500;
                    if (checkStr.includes('Music Industry Legal Specialist') || checkStr.includes('Legal Director') || checkStr.includes('Legal Specialist') || checkStr.includes('Legal Counsel') || checkStr.includes('General Counsel')) {
                        executingAgentId = 'legal';
                    } else if (checkStr.includes('Music Campaign Manager') || checkStr.includes('Campaign Manager') || checkStr.includes('Marketing Director') || checkStr.includes('Marketing Agent')) {
                        executingAgentId = 'marketing';
                    } else if (checkStr.includes('Music Industry Finance Specialist') || checkStr.includes('Finance Specialist') || checkStr.includes('Finance Director') || checkStr.includes('Finance Agent')) {
                        executingAgentId = 'finance';
                    } else if (checkStr.includes('Creative Director')) {
                        executingAgentId = 'creative';
                    } else if (checkStr.includes('Video Agent') || checkStr.includes('Video Director')) {
                        executingAgentId = 'video';
                    } else if (checkStr.includes('Social Agent') || checkStr.includes('Social Media')) {
                        executingAgentId = 'social';
                    } else if (checkStr.includes('Publicist Agent') || checkStr.includes('Publicist Director')) {
                        executingAgentId = 'publicist';
                    } else if (checkStr.includes('Brand Agent') || checkStr.includes('Brand Director')) {
                        executingAgentId = 'brand';
                    } else if (checkStr.includes('Music Director') || checkStr.includes('Music Agent')) {
                        executingAgentId = 'music';
                    }
                }

                // Fallback: Extract executing agent ID from agentIdentity card by finding the LAST match in the payload
                if (!isUnseatCommand && executingAgentId === 'generalist' && !userMessage.includes('Continue. Previous output:') && !userMessage.includes('Continue.')) {
                    const identityMatches = [...postData.matchAll(/agentIdentity\\*"\s*:\s*\{\s*[^}]+?agentId\\*"\s*:\s*\\*"([^"\\]+)/gi)];
                    if (identityMatches.length > 0) {
                        const lastMatch = identityMatches[identityMatches.length - 1];
                        executingAgentId = lastMatch[1].toLowerCase();
                    }
                }
                console.log(`[E2E:MockAI] Detected Executing Agent ID: "${executingAgentId}"`);

                const isSpoke = executingAgentId !== 'generalist';
                const isConductor = !isSpoke;
                console.log(`[E2E:MockAI] Evaluated isConductor: ${isConductor}`);
                let parts: any[] = [];
 
                const normalized = postData.toLowerCase();
                const hasUnseated = (agentId: string) => {
                    return normalized.includes(`unseated the ${agentId} agent`) || 
                           normalized.includes(`successfully unseated the ${agentId}`);
                };

                if (!isConductor) {
                    let responseText = "*(Specialist review complete)*";
                    if (executingAgentId === 'marketing') {
                        responseText = "[Marketing Dept.]: We propose a $5,000 budget targeting TikTok ads and playlist pitching to support the upcoming release.";
                    } else if (executingAgentId === 'finance') {
                        responseText = "[Finance Dept.]: A $5,000 marketing expense fits within our seasonal cash flow limits. However, we should secure contract splits first.";
                    } else if (executingAgentId === 'legal') {
                        responseText = "[Legal Dept.]: The visual split sheet agreement is drafted with a standard 50/50 split between producer and artist. Ready to send for signature.";
                    } else if (executingAgentId === 'creative') {
                        responseText = "[Creative Director]: The design mockup utilizes neon glassmorphism backgrounds.";
                    } else if (executingAgentId === 'video') {
                        responseText = "[Video Agent]: Generating a 5-second dynamic teaser matching the aesthetic.";
                    } else if (executingAgentId === 'social') {
                        responseText = "[Social Agent]: I have drafted 3 Instagram caption templates with trending music hashtags.";
                    } else if (executingAgentId === 'publicist') {
                        responseText = "[Publicist Agent]: Press release draft is finalized for standard distribution outlets.";
                    } else if (executingAgentId === 'brand') {
                        responseText = "[Brand Agent]: I recommend a sleek, dark-mode visual theme with vibrant accent highlights.";
                    } else if (executingAgentId === 'music') {
                        responseText = "[Music Director]: Pinned to the 'Neon Phantom' vibe. We'll use custom synth bass hooks.";
                    }
                    parts = [{ text: responseText }];
                    console.log(`[E2E:MockAI] Spoke Agent response simulated for Executing ID "${executingAgentId}". Text length: ${responseText.length}`);
                } else {
                    if (actualRequest.includes('done for today') || actualRequest.includes('Clear the table') || actualRequest.includes('clear the table')) {
                        if (normalized.includes('unseat_agent') && normalized.includes('targetagentid')) {
                            // Extract all target agent IDs being unseated in this request history
                            const matches = [...normalized.matchAll(/targetagentid[^a-z0-9_-]+([a-z0-9_-]+)/g)];
                            for (const m of matches) {
                                (globalThis as any).unseatedAgentsInTest.add(m[1].toLowerCase());
                            }
                        }

                        const hasUnseatedLegal = (globalThis as any).unseatedAgentsInTest.has('legal') || hasUnseated('legal');
                        const hasUnseatedCreative = (globalThis as any).unseatedAgentsInTest.has('creative') || hasUnseated('creative');
                        const hasUnseatedVideo = (globalThis as any).unseatedAgentsInTest.has('video') || hasUnseated('video');
                        const hasUnseatedSocial = (globalThis as any).unseatedAgentsInTest.has('social') || hasUnseated('social');
                        const hasUnseatedPublicist = (globalThis as any).unseatedAgentsInTest.has('publicist') || hasUnseated('publicist');
                        const hasUnseatedBrand = (globalThis as any).unseatedAgentsInTest.has('brand') || hasUnseated('brand');
                        const hasUnseatedMusic = (globalThis as any).unseatedAgentsInTest.has('music') || hasUnseated('music');

                        parts = [{ text: "[Executor]: Excusing all remaining agents." }];
                        if (!hasUnseatedLegal) parts.push({ functionCall: { name: 'unseat_agent', args: { targetAgentId: 'legal' } } });
                        if (!hasUnseatedCreative) parts.push({ functionCall: { name: 'unseat_agent', args: { targetAgentId: 'creative' } } });
                        if (!hasUnseatedVideo) parts.push({ functionCall: { name: 'unseat_agent', args: { targetAgentId: 'video' } } });
                        if (!hasUnseatedSocial) parts.push({ functionCall: { name: 'unseat_agent', args: { targetAgentId: 'social' } } });
                        if (!hasUnseatedPublicist) parts.push({ functionCall: { name: 'unseat_agent', args: { targetAgentId: 'publicist' } } });
                        if (!hasUnseatedBrand) parts.push({ functionCall: { name: 'unseat_agent', args: { targetAgentId: 'brand' } } });
                        if (!hasUnseatedMusic) parts.push({ functionCall: { name: 'unseat_agent', args: { targetAgentId: 'music' } } });
                        
                        if (parts.length === 1) {
                            parts = [{ text: "Cleared the boardroom table! Excellent session today." }];
                        }
                    } else if (actualRequest.includes('artistic vibe') || actualRequest.includes('Brand and Music') || actualRequest.includes('align on')) {
                        // Turn 8: Seating Brand and Music
                        const hasSeatedBrand = postData.includes('seated the brand agent');
                        const hasSeatedMusic = postData.includes('seated the music agent');

                        if (!hasSeatedBrand) {
                            parts = [
                                { text: "[Executor]: Summoning Brand and Music Directors to align on the artistic vibe." },
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
                    } else if (actualRequest.includes('social copy') || actualRequest.includes('Social and Publicist') || actualRequest.includes('press release')) {
                        // Turn 7: Seating Social and Publicist
                        const hasSeatedSocial = postData.includes('seated the social agent');
                        const hasSeatedPublicist = postData.includes('seated the publicist agent');

                        if (!hasSeatedSocial) {
                            parts = [
                                { text: "[Executor]: Summoning Social and Publicist agents to outline copy and press releases." },
                                { functionCall: { name: 'seat_agent', args: { targetAgentId: 'social' } } }
                            ];
                        } else if (!hasSeatedPublicist) {
                            parts = [
                                { text: "Social is seated. Summoning Publicist agent." },
                                { functionCall: { name: 'seat_agent', args: { targetAgentId: 'publicist' } } }
                            ];
                        } else {
                            parts = [
                                { text: "[Social Agent]: I have drafted 3 Instagram caption templates with trending music hashtags. [Publicist Agent]: Press release draft is finalized for standard distribution outlets." }
                            ];
                        }
                    } else if (actualRequest.includes('marketing visual') || actualRequest.includes('Creative and Video') || actualRequest.includes('visual for this campaign')) {
                        // Turn 6: Seating Creative and Video
                        const hasSeatedCreative = postData.includes('seated the creative agent');
                        const hasSeatedVideo = postData.includes('seated the video agent');

                        if (!hasSeatedCreative) {
                            parts = [
                                { text: "[Executor]: Summoning Creative Director and Video Agent to design marketing visuals." },
                                { functionCall: { name: 'seat_agent', args: { targetAgentId: 'creative' } } }
                            ];
                        } else if (!hasSeatedVideo) {
                            parts = [
                                { text: "Creative is seated. Summoning Video agent next." },
                                { functionCall: { name: 'seat_agent', args: { targetAgentId: 'video' } } }
                            ];
                        } else {
                            parts = [
                                { text: "[Creative Director]: The design mockup utilizes neon glassmorphism backgrounds. [Video Agent]: Generating a 5-second dynamic teaser matching the aesthetic." }
                            ];
                        }
                    } else if (actualRequest.includes('split sheet') || actualRequest.includes('templates are we using')) {
                        // Turn 5: Ask Legal about licensing templates and split sheet agreements
                        parts = [
                            { text: "[Executor]: Directing the templates inquiry to our Legal department." }
                        ];
                    } else if (actualRequest.includes('good to go') || actualRequest.includes('excused') || actualRequest.includes('thank you')) {
                        // Turn 4: Unseating Marketing and Finance
                        const hasUnseatedMarketing = hasUnseated('marketing');
                        const hasUnseatedFinance = hasUnseated('finance');

                        if (!hasUnseatedMarketing) {
                            parts = [
                                { text: "[Executor]: Marketing and Finance, thank you for the budget details. You are excused." },
                                { functionCall: { name: 'unseat_agent', args: { targetAgentId: 'marketing' } } }
                            ];
                        } else if (!hasUnseatedFinance) {
                            parts = [
                                { text: "Marketing unseated. Excusing Finance." },
                                { functionCall: { name: 'unseat_agent', args: { targetAgentId: 'finance' } } }
                            ];
                        } else {
                            parts = [
                                { text: "Marketing and Finance have successfully left the Boardroom table." }
                            ];
                        }
                    } else if (actualRequest.includes('check the agreements') || actualRequest.includes('Legal') || actualRequest.includes('legal')) {
                        // Turn 3: Summoning Legal
                        const hasSeatedLegal = postData.includes('seated the legal agent');

                        if (!hasSeatedLegal) {
                            parts = [
                                { text: "[Executor]: Bringing Legal into the discussion to review the campaign split sheet agreements." },
                                { functionCall: { name: 'seat_agent', args: { targetAgentId: 'legal' } } }
                            ];
                        } else {
                            parts = [
                                { text: "[Legal Dept.]: I have reviewed the visual licensing templates. Everything aligns with our standard terms. The NDA is drafted and ready for review." }
                            ];
                        }
                    } else if (actualRequest.includes('How much should we spend') || actualRequest.includes('spend on this campaign')) {
                        // Turn 2: Marketing and Finance both respond to budget question
                        parts = [
                            { text: "[Marketing Dept.]: We propose a $5,000 budget targeting TikTok ads and playlist pitching to support the upcoming release." },
                            { text: "[Finance Dept.]: A $5,000 marketing expense fits within our seasonal cash flow limits. However, we should secure contract splits first." }
                        ];
                    } else {
                        // Turn 1: Seating Marketing and Finance (Initial prompt)
                        const hasSeatedMarketing = postData.includes('seated the marketing agent');
                        const hasSeatedFinance = postData.includes('seated the finance agent');
                        console.log(`[E2E:MockAI] Turn 1 Evaluated Seated States: hasSeatedMarketing=${hasSeatedMarketing}, hasSeatedFinance=${hasSeatedFinance}`);

                        if (!hasSeatedMarketing) {
                            parts = [
                                { text: "[Executor]: Hello! I will seat Marketing and Finance at the table immediately to begin our campaign strategy session." },
                                { functionCall: { name: 'seat_agent', args: { targetAgentId: 'marketing' } } }
                            ];
                        } else if (!hasSeatedFinance) {
                            parts = [
                                { text: "Marketing is seated. Now seating Finance." },
                                { functionCall: { name: 'seat_agent', args: { targetAgentId: 'finance' } } }
                            ];
                        } else {
                            parts = [
                                { text: "Marketing and Finance are both seated at the table. Ready to discuss the campaign budget!" }
                            ];
                        }
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

        // Open Boardroom local or custom origin
        const rawUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4242";
        const origin = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
        console.log(`[E2E:Scenario] Navigating to studio origin: ${origin}...`);
        await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30000 });

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
        // HELPER: Synchronized multi-turn message submission
        // ----------------------------------------------------
        const submitMessageAndWaitForIdle = async (promptText: string) => {
            currentActivePrompt = promptText;
            console.log(`[E2E:Scenario] Submitting prompt: "${promptText}"`);
            await cleanOverlays();
            await page.fill('[data-testid="main-prompt-input"]', promptText);
            await page.click('[data-testid="command-bar-run-btn"]');
            
            // Wait 1.5 seconds for the processing state to initialize and start E2E mock loop
            await page.waitForTimeout(1500);
            
            // Wait for isAgentProcessing to become false, signifying the entire turn completion
            await page.waitForFunction(() => {
                return window.useStore.getState().isAgentProcessing === false;
            }, { timeout: 45000 });
            console.log(`[E2E:Scenario] Prompt processing completed for: "${promptText}"`);
        };

        // ----------------------------------------------------
        // TURN 1: Greet and Seat Marketing & Finance
        // ----------------------------------------------------
        await submitMessageAndWaitForIdle("Let's bring in Marketing and Finance");

        // Verify active agents seated
        const seatedAfterTurn1 = await page.evaluate(() => window.useStore.getState().activeAgents);
        expect(seatedAfterTurn1).toContain('marketing');
        expect(seatedAfterTurn1).toContain('finance');

        // Take Turn 1 screenshot
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/media__1779694161957.png' });
        console.log('[E2E:Scenario] Turn 1 Seating verified. Captured screenshot.');

        // ----------------------------------------------------
        // TURN 2: Campaign Budget Discussion
        // ----------------------------------------------------
        await submitMessageAndWaitForIdle("How much should we spend on this campaign?");

        // Verify responses are stored
        const messagesAfterTurn2 = await page.evaluate(() => window.useStore.getState().boardroomMessages || []);
        const hasBudgetDetail = messagesAfterTurn2.some(m => m.text?.includes('$5,000') && m.agentId === 'marketing');
        expect(hasBudgetDetail).toBe(true);
        console.log('[E2E:Scenario] Turn 2 responses verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn2_budget.png' });

        // ----------------------------------------------------
        // TURN 3: Summon Legal
        // ----------------------------------------------------
        await submitMessageAndWaitForIdle("Let's bring in Legal to check the agreements");

        // Verify active agents
        const seatedAfterTurn3 = await page.evaluate(() => window.useStore.getState().activeAgents);
        expect(seatedAfterTurn3).toContain('legal');
        console.log('[E2E:Scenario] Turn 3 Legal seating verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn3_legal_seated.png' });

        // ----------------------------------------------------
        // TURN 4: Dismiss Marketing & Finance
        // ----------------------------------------------------
        await submitMessageAndWaitForIdle("Marketing and Finance, you are good to go, thank you");

        // Verify unseated
        const seatedAfterTurn4 = await page.evaluate(() => window.useStore.getState().activeAgents);
        expect(seatedAfterTurn4).toContain('legal');
        expect(seatedAfterTurn4).not.toContain('marketing');
        expect(seatedAfterTurn4).not.toContain('finance');
        console.log('[E2E:Scenario] Turn 4 Marketing and Finance unseating verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn4_unseated.png' });

        // ----------------------------------------------------
        // TURN 5: Ask Legal about Split Agreement
        // ----------------------------------------------------
        await submitMessageAndWaitForIdle("Legal, what templates are we using and what is the visual split sheet agreement?");

        // Evaluate and log any loading error for legal agent in registry
        const registryError = await page.evaluate(() => {
            const err = (window as any).agentRegistry?.getLoadError('legal');
            if (err) {
                return { message: err.error.message, attempts: err.attempts, stack: err.error.stack };
            }
            return null;
        });
        console.log('[E2E:Diagnostic] Legal agent load error in browser:', registryError);

        // Verify Legal response contains standard 50/50 split
        const messagesAfterTurn5 = await page.evaluate(() => window.useStore.getState().boardroomMessages || []);
        console.log('[E2E:Diagnostic] Turn 5 Boardroom Messages:', JSON.stringify(messagesAfterTurn5, null, 2));
        const hasLegalSplit = messagesAfterTurn5.some(m => m.text?.includes('50/50 split') && m.agentId === 'legal');
        expect(hasLegalSplit).toBe(true);
        console.log('[E2E:Scenario] Turn 5 Legal response verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn5_legal_split.png' });

        // ----------------------------------------------------
        // TURN 6: Summon Creative & Video
        // ----------------------------------------------------
        await submitMessageAndWaitForIdle("Creative and Video, let's generate a marketing visual for this campaign.");

        // Verify active agents
        const seatedAfterTurn6 = await page.evaluate(() => window.useStore.getState().activeAgents);
        expect(seatedAfterTurn6).toContain('creative');
        expect(seatedAfterTurn6).toContain('video');
        console.log('[E2E:Scenario] Turn 6 Creative and Video seating verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn6_creative_video_seated.png' });

        // ----------------------------------------------------
        // TURN 7: Summon Social & Publicist
        // ----------------------------------------------------
        await submitMessageAndWaitForIdle("Social and Publicist, let's outline the social copy and write a press release hook.");

        // Verify active agents
        const seatedAfterTurn7 = await page.evaluate(() => window.useStore.getState().activeAgents);
        expect(seatedAfterTurn7).toContain('social');
        expect(seatedAfterTurn7).toContain('publicist');
        console.log('[E2E:Scenario] Turn 7 Social and Publicist seating verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn7_social_publicist_seated.png' });

        // ----------------------------------------------------
        // TURN 8: Align on Brand and Music
        // ----------------------------------------------------
        await submitMessageAndWaitForIdle("Brand and Music, let's align on the artistic vibe");

        // Verify Brand & Music seated
        const seatedAfterTurn8 = await page.evaluate(() => window.useStore.getState().activeAgents);
        expect(seatedAfterTurn8).toContain('brand');
        expect(seatedAfterTurn8).toContain('music');
        console.log('[E2E:Scenario] Turn 8 Brand and Music seating verified.');
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/turn8_brand_music_seated.png' });

        // ----------------------------------------------------
        // TURN 9: Clear the boardroom table
        // ----------------------------------------------------
        await submitMessageAndWaitForIdle("Thank you team, we are done for today. Clear the table.");

        // Verify all agents unseated
        const finalSeated = await page.evaluate(() => window.useStore.getState().activeAgents);
        console.log('[E2E:Scenario] Final Seated Agents:', finalSeated);
        expect(finalSeated).not.toContain('legal');
        expect(finalSeated).not.toContain('creative');
        expect(finalSeated).not.toContain('video');
        expect(finalSeated).not.toContain('social');
        expect(finalSeated).not.toContain('publicist');
        expect(finalSeated).not.toContain('brand');
        expect(finalSeated).not.toContain('music');

        // Capture final empty boardroom state screenshot
        await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/3e1aa88c-2608-40c1-a35b-af5e12444c40/.tempmediaStorage/media_3e1aa88c-2608-40c1-a35b-af5e12444c40_1779714383863.png' });
        console.log('[E2E:Scenario] Multi-turn test completely successful! All 9 turns seated, unseated, and verified correctly.');
    });
});

