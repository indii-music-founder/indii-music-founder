import { test as customTest, expect } from '@playwright/test';
import { test as authedTest } from './fixtures/auth';

interface TestWindow extends Window {
    useStore: {
        getState: () => Record<string, any>;
        setState: (state: Record<string, any>) => void;
    };
    __TEST_MODE__: boolean;
}

interface Persona {
    id: string;
    email: string;
    displayName: string;
    bio: string;
    brandDescription: string;
    aestheticStyle: string;
    colors: string[];
    fonts: string;
    distributor: string;
    releaseTitle: string;
    releaseTrack: string;
    prompt: string;
}

const personas: Persona[] = [
    {
        id: 'model-909',
        email: 'model909@detroit.soul',
        displayName: 'Model 909',
        bio: 'Deep, analog rhythms and machine-soul grooves born from the industrial heart of Detroit. Forged in the Motor City.',
        brandDescription: 'Raw, machine soul, industrial warehouse energy.',
        aestheticStyle: 'Minimalist',
        colors: ['#121212', '#C05C3E', '#FFBF00', '#708090'], // Charcoal, Rust, Amber, Slate
        fonts: 'Tech/Mono',
        distributor: 'Symphonic',
        releaseTitle: 'Warehouse Soul EP',
        releaseTrack: 'Belleville Rhythms',
        prompt: 'Analog synthesizer keys, raw copper and slate, industrial dark room, warm amber lighting, minimalist Detroit techno layout, photo'
    },
    {
        id: 'metroplex-303',
        email: 'metro303@detroit.soul',
        displayName: 'Metroplex 303',
        bio: 'Searing acid basslines and raw drum machine work representing the concrete warehouses of the Detroit underground.',
        brandDescription: 'Acid basslines, concrete warehouses, hardware-driven beats.',
        aestheticStyle: 'Vintage',
        colors: ['#0d0d0d', '#2c5e3b', '#a31d1d', '#314e6b'], // Black, Oxide Green, Crimson, Steel Blue
        fonts: 'Bold & Geometric',
        distributor: 'Symphonic',
        releaseTitle: 'Concrete Rhythms EP',
        releaseTrack: 'Acid Rebellion',
        prompt: 'Oxidized metal console with glowing indicator lights, concrete wall shadow, warm red practical light, hardware-driven electronic setup, highly detailed macro photo'
    },
    {
        id: 'sub-resistance',
        email: 'sub_res@detroit.soul',
        displayName: 'Subterranean Resistance',
        bio: 'Fast electro-techno rhythms and safety-critical industrial styling designed to challenge commercial sound structures.',
        brandDescription: 'Electro-techno, industrial safety styling, hardware purist.',
        aestheticStyle: 'Minimalist',
        colors: ['#111111', '#555555', '#d4af37', '#222222'], // Black, Grey, Gold, Charcoal
        fonts: 'Tech/Mono',
        distributor: 'Symphonic',
        releaseTitle: 'Sonic Uprising',
        releaseTrack: 'Direct Drive',
        prompt: 'Minimalist control panel of vintage drum machines, brushed steel texture, safety yellow accent tape, shadow silhouettes in a dark room, cinematic photography'
    },
    {
        id: 'motor-machine',
        email: 'motor_mach@detroit.soul',
        displayName: 'Motor City Machine',
        bio: 'Warm, soulful deep house combined with the structural elements of urban industrial factories.',
        brandDescription: 'Warm deep house, soulful factory machine grooves.',
        aestheticStyle: 'Minimalist',
        colors: ['#1c1c1c', '#c29d65', '#9e5e38', '#cccccc'], // Slate, Amber, Copper, Grey
        fonts: 'Clean Sans-Serif',
        distributor: 'Symphonic',
        releaseTitle: 'Belleville Beats',
        releaseTrack: 'Machine Soul',
        prompt: 'Copper pipes, warm light reflection on metal surface, cozy industrial studio setting, vintage monitors, soft warm atmosphere'
    },
    {
        id: 'urban-soul',
        email: 'urban_soul@detroit.soul',
        displayName: 'Urban Soul Project',
        bio: 'Expressive Detroit house music with jazz and soul influences, reflecting the city after dark.',
        brandDescription: 'Jazz-inflected house, night-time Detroit scenery, urban landscape.',
        aestheticStyle: 'Minimalist',
        colors: ['#090909', '#b59410', '#82593c', '#4a5d6e'], // Black, Gold, Bronze, Slate
        fonts: 'Clean Sans-Serif',
        distributor: 'Symphonic',
        releaseTitle: 'Detroit After Dark',
        releaseTrack: 'Motor City Nights',
        prompt: 'Urban horizon silhouette at dusk, warm gold street lamp reflections, analog sound desk faders in soft focus, soulful and intimate lighting'
    }
];

const BASE_URL = process.env.E2E_STUDIO_URL || 'http://localhost:4242';

authedTest.describe('Detroit Techno Onboarding & Studio Flow Stress Test', () => {
    authedTest.use({ viewport: { width: 1440, height: 900 } });
    authedTest.setTimeout(1800000); // 30 minutes total timeout for long execution loop

    authedTest('Scenario: Full Detroit Techno Artist Journey', async ({ authedPage: page }) => {
        // Enable console log proxying
        page.on('console', msg => console.log(`[Techno E2E] BROWSER: ${msg.text()}`));
        page.on('pageerror', err => console.error(`[Techno E2E] BROWSER ERROR: ${err.message}`));

        // Auto-accept confirmation dialogs (e.g. unsaved changes on navigation)
        page.on('dialog', async dialog => {
            console.log(`[Techno E2E] Auto-accepting dialog: [${dialog.type()}] "${dialog.message()}"`);
            await dialog.accept();
        });

        let onboardingTurn = 0;
        let currentPersona = personas[0]!;

        // 1. Intercept AI API calls (Vertex/Gemini)
        await page.route(/.*(firebasevertexai|generativelanguage)\.googleapis\.com.*/, async (route) => {
            const url = route.request().url();
            console.log(`[Techno E2E] Intercepted GenAI URL: ${url}`);

            if (route.request().method() === "OPTIONS") {
                await route.fulfill({
                    status: 204,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                        "Access-Control-Allow-Headers": "*"
                    }
                });
                return;
            }

            // Image generation models (imagen or generateImages)
            if (url.includes('generateImages') || url.includes('imagen') || url.includes('predict')) {
                await route.fulfill({
                    status: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Credentials": "true",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        candidates: [
                            {
                                content: {
                                    parts: [
                                        {
                                            inlineData: {
                                                mimeType: 'image/png',
                                                data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                                            },
                                        },
                                    ],
                                    role: 'model',
                                },
                            },
                        ],
                    }),
                });
                return;
            }

            // Otherwise, handle onboarding text chat conversation sequentially
            let text = "";
            const functionCalls: any[] = [];

            onboardingTurn++;
            console.log(`[Techno E2E] Processing AI Turn ${onboardingTurn} for ${currentPersona.displayName}`);

            if (onboardingTurn === 1) {
                text = `${currentPersona.displayName} — I respect that. Detroit is the birthplace of techno, the birthplace of machine soul. Raw analog drums and industrial warehouse vibes have a permanent place in music history. Since you're forging this path, where are you at in your career right now?`;
                functionCalls.push({
                    name: "updateProfile",
                    args: {
                        bio: currentPersona.bio,
                        brand_description: currentPersona.brandDescription
                    }
                });
                functionCalls.push({
                    name: "askMultipleChoice",
                    args: {
                        question_type: "career_stage",
                        options: ["Just starting out", "Building momentum", "Established", "Industry veteran"]
                    }
                });
            } else if (onboardingTurn === 2) {
                text = `Got it, building momentum is the sweet spot. That's when the raw hustle starts to pay off. As you push forward with ${currentPersona.displayName}, what's the immediate target?`;
                functionCalls.push({
                    name: "updateProfile",
                    args: {
                        career_stage: "Building momentum"
                    }
                });
                functionCalls.push({
                    name: "askMultipleChoice",
                    args: {
                        question_type: "goals",
                        options: ["Grow fanbase", "Touring", "Sync licensing", "Label deal"]
                    }
                });
            } else if (onboardingTurn === 3) {
                text = `Touring is where underground techno lives. The sweat, the shadows, the sound systems. To get you on those lineups, your visual brand needs to match that raw warehouse energy. What's the visual aesthetic style we are building around?`;
                functionCalls.push({
                    name: "updateProfile",
                    args: {
                        goals: ["Grow fanbase", "Touring"]
                    }
                });
                functionCalls.push({
                    name: "askMultipleChoice",
                    args: {
                        question_type: "aesthetic_style",
                        options: ["Minimalist", "Maximalist", "Vintage", "Futuristic", "Cinematic", "Abstract"]
                    }
                });
            } else if (onboardingTurn === 4) {
                text = `${currentPersona.aestheticStyle} industrial. Spot on. No clutter, just raw impact — like a concrete warehouse at 4 AM. And to enforce this, I'm setting a strict guard: no neon, no cyberpunk cliches, no cartoon gloss. What color vibe represents ${currentPersona.displayName}?`;
                functionCalls.push({
                    name: "updateProfile",
                    args: {
                        aesthetic_style: currentPersona.aestheticStyle,
                        negative_prompt: "no neon, no cyberpunk, no bright cartoon colors, no glossy synthwave"
                    }
                });
                functionCalls.push({
                    name: "askMultipleChoice",
                    args: {
                        question_type: "color_vibe",
                        options: ["Black & White", "Muted & Earthy", "High Contrast", "Warm tones", "Cool tones"]
                    }
                });
            } else if (onboardingTurn === 5) {
                text = `Nice choice. Charcoal, rust orange, slate gray, and analog amber. It feels tactile, like vacuum tubes and warehouse metal. Let's lock down the typography to match. What font style fits ${currentPersona.displayName}?`;
                functionCalls.push({
                    name: "updateProfile",
                    args: {
                        colors: currentPersona.colors
                    }
                });
                functionCalls.push({
                    name: "askMultipleChoice",
                    args: {
                        question_type: "font_style",
                        options: ["Bold & Geometric", "Elegant Serif", "Clean Sans-Serif", "Tech/Mono", "Handwritten"]
                    }
                });
            } else if (onboardingTurn === 6) {
                text = `${currentPersona.fonts} typography is perfect. Keep it industrial. Now let's handle the plumbing. How are we getting this music out? Who are you distributing with?`;
                functionCalls.push({
                    name: "updateProfile",
                    args: {
                        fonts: currentPersona.fonts
                    }
                });
                functionCalls.push({
                    name: "askMultipleChoice",
                    args: {
                        question_type: "distributor",
                        options: ["Symphonic", "CD Baby", "DistroKid", "TuneCore"]
                    }
                });
            } else if (onboardingTurn === 7) {
                text = `${currentPersona.distributor} is a solid choice. Excellent indie focus and strong support. Let's save that. Now, let's talk about what we're releasing next. What is the title of the track or project we're preparing?`;
                functionCalls.push({
                    name: "updateProfile",
                    args: {
                        distributor: currentPersona.distributor
                    }
                });
                functionCalls.push({
                    name: "shareDistributorInfo",
                    args: {
                        distributor_name: currentPersona.distributor
                    }
                });
            } else if (onboardingTurn === 8) {
                text = `'${currentPersona.releaseTitle}' — that's a classic title. For an EP format, how many tracks are we talking about?`;
                functionCalls.push({
                    name: "updateProfile",
                    args: {
                        release_title: currentPersona.releaseTitle
                    }
                });
                functionCalls.push({
                    name: "askMultipleChoice",
                    args: {
                        question_type: "release_type",
                        options: ["Single", "EP (3-6 tracks)", "Album (7+ tracks)", "Remix", "DJ Mix"]
                    }
                });
            } else if (onboardingTurn === 9) {
                text = `Alright, a solid EP rollout. To help plan the marketing campaigns, what's the primary mood of '${currentPersona.releaseTitle}'?`;
                functionCalls.push({
                    name: "updateProfile",
                    args: {
                        release_type: "EP (3-6 tracks)"
                    }
                });
                functionCalls.push({
                    name: "askMultipleChoice",
                    args: {
                        question_type: "mood",
                        options: ["Dark & moody", "Euphoric", "Introspective", "High-energy", "Chill"]
                    }
                });
            } else {
                text = `High-energy machine rhythms. Perfect. That's the engine of the Motor City. We've got the core brand kit, colors, fonts, distributor, and your upcoming EP set up. Let's enter the studio!`;
                functionCalls.push({
                    name: "updateProfile",
                    args: {
                        release_mood: "High-energy",
                        release_genre: "Techno",
                        release_themes: "motor city nights, warehouse energy, machine rhythms"
                    }
                });
                functionCalls.push({
                    name: "finishOnboarding",
                    args: {}
                });
            }

            const response = {
                candidates: [
                    {
                        content: {
                            role: "model",
                            parts: functionCalls.map(fc => ({ functionCall: fc })).concat({ text })
                        },
                        finishReason: "STOP"
                    }
                ]
            };

            await route.fulfill({
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Credentials": "true",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(response)
            });
        });

        // 2. Mock Cloud Functions (support both production URLs and local emulator ports)
        await page.route(/.*(cloudfunctions\.net|:5001)\/.*/, async (route) => {
            const url = route.request().url();
            console.log(`[Techno E2E] Intercepted Cloud Function: ${url}`);

            if (route.request().method() === "OPTIONS") {
                await route.fulfill({
                    status: 204,
                });
                return;
            }

            const mockSubscriptionPayload = {
                id: 'mock-sub-global',
                userId: 'test-user-uid-e2e',
                tier: 'pro_monthly',
                status: 'active',
                currentPeriodStart: Date.now(),
                currentPeriodEnd: Date.now() + 30 * 86400000,
                cancelAtPeriodEnd: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            const mockUsagePayload = {
                tier: 'pro_monthly',
                resetDate: Date.now() + 30 * 86400000,
                imagesGenerated: 0,
                imagesRemaining: 100,
                imagesPerMonth: 100,
                videoDurationSeconds: 0,
                videoDurationMinutes: 0,
                videoRemainingMinutes: 10,
                videoTotalMinutes: 10,
                aiChatTokensUsed: 0,
                aiChatTokensRemaining: 100000,
                aiChatTokensPerMonth: 100000,
                storageUsedGB: 0,
                storageRemainingGB: 10,
                storageTotalGB: 10,
                projectsCreated: 0,
                projectsRemaining: 10,
                maxProjects: 10,
                teamMembersUsed: 1,
                teamMembersRemaining: 4,
                maxTeamMembers: 5
            };

            if (url.includes('getSubscription')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ result: mockSubscriptionPayload, data: mockSubscriptionPayload }),
                });
                return;
            }

            if (url.includes('getUsageStats')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ result: mockUsagePayload, data: mockUsagePayload }),
                });
                return;
            }

            if (url.includes('initiateDelivery')) {
                const res = { deliveryId: 'delivery-techno-001', status: 'queued', distributor: 'Symphonic' };
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ result: res, data: res }),
                });
                return;
            }

            if (url.includes('getDeliveryStatus')) {
                const res = { deliveryId: 'delivery-techno-001', status: 'delivered', distributor: 'Symphonic', deliveredAt: new Date().toISOString() };
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ result: res, data: res }),
                });
                return;
            }

            if (url.includes('validateDDEX')) {
                const res = { valid: true, errors: [], warnings: ['Cover art warning'] };
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ result: res, data: res }),
                });
                return;
            }

            // Fallback success for other functions (returns mock doc ID to prevent UPC/ISRC recordAssignment failures)
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ result: { id: 'mock-doc-id', success: true } }),
            });
        });

        // Loop through all 5 personas
        for (let pIdx = 0; pIdx < personas.length; pIdx++) {
            currentPersona = personas[pIdx]!;
            onboardingTurn = 0;

            console.log(`\n======================================================`);
            console.log(`[Techno E2E] Starting Journey for Persona [${pIdx + 1}/${personas.length}]: ${currentPersona.displayName}`);
            console.log(`======================================================\n`);

            // Intercept Firestore user doc reads for test-user-uid-e2e and return the active persona
            await page.route("**/firestore.googleapis.com/**/users/test-user-uid-e2e", async (route) => {
                const req = route.request();
                const headers = req.headers();
                const origin = headers['origin'] || headers['Origin'] || 'http://localhost:4242';
                const corsHeaders = {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-version, X-HTTP-Session-Id, X-Goog-Api-Key, X-Goog-Api-Client, X-Firebase-Client",
                };
                if (req.method() === "OPTIONS") {
                    await route.fulfill({ status: 204, headers: corsHeaders });
                    return;
                }
                console.log(`[Techno E2E] Intercepted user doc GET request for ${currentPersona.displayName}`);
                await route.fulfill({
                    status: 200,
                    headers: corsHeaders,
                    contentType: "application/json",
                    body: JSON.stringify({
                        name: "projects/mock-project/databases/(default)/documents/users/test-user-uid-e2e",
                        fields: {
                            uid: { stringValue: "test-user-uid-e2e" },
                            email: { stringValue: currentPersona.email },
                            displayName: { stringValue: currentPersona.displayName },
                            membershipTier: { stringValue: "pro" },
                            onboardingCompleted: { booleanValue: false },
                        },
                    }),
                });
            });

            await page.route(url => url.pathname.includes("batchGet") || url.pathname.includes("documents:get"), async (route) => {
                const req = route.request();
                const headers = req.headers();
                const origin = headers['origin'] || headers['Origin'] || 'http://localhost:4242';
                const corsHeaders = {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-version, X-HTTP-Session-Id, X-Goog-Api-Key, X-Goog-Api-Client, X-Firebase-Client",
                };
                if (req.method() === "OPTIONS") {
                    await route.fulfill({ status: 204, headers: corsHeaders });
                    return;
                }
                console.log(`[Techno E2E] Intercepted batchGet/documents:get for ${currentPersona.displayName}`);
                await route.fulfill({
                    status: 200,
                    headers: corsHeaders,
                    contentType: "application/json",
                    body: JSON.stringify([
                        {
                            found: {
                                name: "projects/mock-project/databases/(default)/documents/users/test-user-uid-e2e",
                                fields: {
                                    uid: { stringValue: "test-user-uid-e2e" },
                                    email: { stringValue: currentPersona.email },
                                    displayName: { stringValue: currentPersona.displayName },
                                    membershipTier: { stringValue: "pro" },
                                    onboardingCompleted: { booleanValue: false },
                                },
                                createTime: "2024-01-01T00:00:00.000Z",
                                updateTime: "2024-01-01T00:00:00.000Z",
                            },
                            readTime: "2024-01-01T00:00:00.000Z"
                        }
                    ]),
                });
            });

            // 3. Force Zustand state to Onboarding
            console.log('[Techno E2E] Initializing onboarding state...');
            await page.goto(BASE_URL);
            await page.waitForFunction(() => (window as any).useStore !== undefined, { timeout: 15000 });

            await page.evaluate((persona) => {
                const store = (window as any).useStore;
                const state = store.getState();
                
                // Clear the global profile subscription to prevent offline load overwrites
                if (state.clearSubscription) {
                    try {
                        state.clearSubscription('global_profile');
                    } catch (e) {}
                }

                store.setState({
                    currentModule: 'onboarding',
                    isAuthenticated: true,
                    isAuthReady: true,
                    loadUserProfile: async () => { console.log('[Techno E2E] Stubbed loadUserProfile called'); },
                    userProfile: {
                        id: 'test-user-uid-e2e',
                        uid: 'test-user-uid-e2e',
                        email: persona.email,
                        displayName: persona.displayName,
                        bio: '',
                        preferences: { theme: 'dark', notifications: true, observabilityEnabled: false },
                        brandKit: {
                            colors: [],
                            fonts: '',
                            brandDescription: '',
                            negativePrompt: '',
                            socials: {},
                            brandAssets: [],
                            referenceImages: [],
                            releaseDetails: {
                                title: '', type: 'Single', artists: '', genre: '',
                                mood: '', themes: '', lyrics: ''
                            }
                        },
                        careerStage: '',
                        goals: [],
                        analyzedTrackIds: [],
                        knowledgeBase: [],
                        savedWorkflows: []
                    }
                });
            }, currentPersona);

            const chatInput = page.locator('[data-testid="prompt-input"]');
            await expect(chatInput).toBeVisible({ timeout: 15000 });

            // Phase 1: Onboarding Chat Simulation
            console.log(`[Techno E2E] Onboarding Step 1: Introducing ${currentPersona.displayName}...`);
            await chatInput.fill(`I am ${currentPersona.displayName} from Detroit. ${currentPersona.bio}`);
            await page.locator('button[aria-label="Send message"]').click();
            await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(3, { timeout: 30000 });
            await page.waitForTimeout(1500); // realistic user timing delay

            console.log('[Techno E2E] Onboarding Step 2: Selecting Building momentum...');
            await page.getByRole('button', { name: "Building momentum" }).first().click();
            await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(5, { timeout: 30000 });
            await page.waitForTimeout(1500);

            console.log('[Techno E2E] Onboarding Step 3: Selecting Touring...');
            await page.getByRole('button', { name: "Touring" }).first().click();
            await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(7, { timeout: 30000 });
            await page.waitForTimeout(1500);

            console.log(`[Techno E2E] Onboarding Step 4: Selecting ${currentPersona.aestheticStyle}...`);
            await page.getByRole('button', { name: currentPersona.aestheticStyle }).first().click();
            await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(9, { timeout: 30000 });
            await page.waitForTimeout(1500);

            console.log('[Techno E2E] Onboarding Step 5: Selecting Warm tones...');
            await page.getByRole('button', { name: "Warm tones" }).first().click();
            await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(11, { timeout: 30000 });
            await page.waitForTimeout(1500);

            console.log(`[Techno E2E] Onboarding Step 6: Selecting ${currentPersona.fonts}...`);
            await page.getByRole('button', { name: currentPersona.fonts }).first().click();
            await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(13, { timeout: 30000 });
            await page.waitForTimeout(1500);

            console.log(`[Techno E2E] Onboarding Step 7: Selecting ${currentPersona.distributor}...`);
            await page.getByRole('button', { name: currentPersona.distributor }).first().click();
            await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(15, { timeout: 30000 });
            await page.waitForTimeout(1500);

            console.log(`[Techno E2E] Onboarding Step 8: Sending release title: ${currentPersona.releaseTitle}...`);
            await chatInput.fill(currentPersona.releaseTitle);
            await page.locator('button[aria-label="Send message"]').click();
            await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(17, { timeout: 30000 });
            await page.waitForTimeout(1500);

            console.log('[Techno E2E] Onboarding Step 9: Selecting EP...');
            await page.getByRole('button', { name: "EP (3-6 tracks)" }).first().click();
            await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(19, { timeout: 30000 });
            await page.waitForTimeout(1500);

            console.log('[Techno E2E] Onboarding Step 10: Selecting High-energy...');
            await page.getByRole('button', { name: "High-energy" }).first().click();

            // Verify Automatic Redirect to Dashboard
            console.log('[Techno E2E] Onboarding complete. Waiting for redirect to dashboard...');
            const dashboardBtn = page.getByRole('button', { name: /(Agent Workspace|My Dashboard|Dashboard)/i }).first();
            await expect(dashboardBtn).toBeVisible({ timeout: 35000 });
            await page.waitForTimeout(1500);

            // Phase 2: Creative Director (artwork creation)
            console.log('[Techno E2E] Phase 2: Navigating to Creative Director...');
            await page.locator('[data-testid="nav-item-creative"]').click();
            await page.waitForTimeout(2000);

            // Click Direct View Button if visible
            const directBtn = page.locator('[data-testid="direct-view-btn"]');
            if (await directBtn.isVisible().catch(() => false)) {
                await directBtn.click();
                await page.waitForTimeout(1000);
            }

            const directPrompt = page.locator('[data-testid="direct-prompt-input"]');
            if (await directPrompt.isVisible().catch(() => false)) {
                console.log(`[Techno E2E] Generating artwork for prompt: "${currentPersona.prompt}"...`);
                await directPrompt.fill(currentPersona.prompt);
                
                const generateBtn = page.locator('[data-testid="direct-generate-btn"]');
                if (await generateBtn.isVisible().catch(() => false)) {
                    await generateBtn.click();
                    await page.waitForTimeout(3000);

                    // In E2E Mock mode, generating an image directly redirects to "editor" viewMode.
                    const bottomActionBtn = page.locator('[data-testid="bottom-action-btn"]');
                    const isBottomActionBtnVisible = await bottomActionBtn.isVisible({ timeout: 5000 }).catch(() => false);
                    if (isBottomActionBtnVisible) {
                        console.log('[Techno E2E] Cover art generated (bottom action button visible). Transitioning to editor...');
                        await bottomActionBtn.click();
                        await page.waitForTimeout(1000);
                    } else {
                        console.log('[Techno E2E] Cover art generated (redirected to editor view directly).');
                        const viewMode = await page.evaluate(() => (window as any).useStore.getState().viewMode);
                        console.log(`[Techno E2E] Current viewMode: ${viewMode}`);
                        expect(viewMode).toBe('editor');
                    }
                }
            }
            await page.waitForTimeout(1500);

            // Phase 3: Distribution setup and connection
            console.log('[Techno E2E] Phase 3: Navigating to Distribution Module...');
            await page.locator('[data-testid="nav-item-distribution"]').click();
            await expect(page.locator('[data-testid="distribution-dashboard"]')).toBeVisible({ timeout: 30000 });
            await page.waitForTimeout(1500);

            // Switch to Catalogue tab (to link distributor credentials)
            console.log(`[Techno E2E] Switching to Catalogue tab to connect ${currentPersona.distributor}...`);
            await page.locator('[data-testid="distro-tab-catalogue"]').click();
            await expect(page.locator('[data-testid="distributors-grid"]')).toBeVisible({ timeout: 10000 });

            const connectBtn = page.locator('[data-testid="connect-button-distrokid"]').or(page.locator('[data-testid="distributor-card-connect"]')).first();
            await expect(connectBtn).toBeVisible({ timeout: 10000 });
            await connectBtn.click({ force: true });

            const connectModal = page.locator('[data-testid="connect-distributor-modal"]').first();
            await expect(connectModal).toBeVisible({ timeout: 10000 });

            const usernameField = page.locator('[data-testid="distro-auth-username"]');
            if (await usernameField.isVisible()) {
                await usernameField.fill(`${currentPersona.id}-symphonic`);
            }

            const passwordField = page.locator('[data-testid="distro-auth-password"]');
            if (await passwordField.isVisible()) {
                await passwordField.fill('motorcitywarehouse909');
            }
            await page.waitForTimeout(1000);

            const finalizeBtn = page.locator('[data-testid="distro-finalize-connection"]');
            await expect(finalizeBtn).toBeVisible();
            await finalizeBtn.click();
            await expect(connectModal).not.toBeVisible({ timeout: 10000 });
            console.log(`[Techno E2E] Distributor connected successfully for ${currentPersona.displayName}!`);
            await page.waitForTimeout(1500);

            // Phase 4: Submit Release Metadata Packet
            console.log('[Techno E2E] Phase 4: Submitting release metadata packet...');
            await page.locator('[data-testid="distro-tab-new"]').click();
            await page.waitForTimeout(1000);
            
            const createReleaseBtn = page.locator('[data-testid="releases-submit-button"]').or(page.locator('[data-testid="create-release-btn"]')).first();
            await expect(createReleaseBtn).toBeVisible({ timeout: 10000 });
            await createReleaseBtn.click({ force: true });

            const metaModal = page.locator('[data-testid="metadata-modal"]');
            await expect(metaModal).toBeVisible({ timeout: 10000 });

            await page.locator('[data-testid="release-title-input"]').fill(currentPersona.releaseTitle);
            await page.locator('[data-testid="release-artist-input"]').fill(currentPersona.displayName);
            await page.locator('[data-testid="release-track-title-input"]').fill(currentPersona.releaseTrack);
            await page.waitForTimeout(1000);

            const submitReleaseBtn = page.locator('[data-testid="release-submit-button"]');
            await expect(submitReleaseBtn).toBeVisible();
            await submitReleaseBtn.click({ force: true });

            const doneBtn = page.locator('[data-testid="release-done-button"]');
            await expect(doneBtn).toBeVisible({ timeout: 30000 });
            await doneBtn.click();
            await expect(metaModal).not.toBeVisible();
            console.log(`[Techno E2E] EP Metadata submitted successfully for ${currentPersona.displayName}!`);
            await page.waitForTimeout(1500);

            // Phase 5: QC Analysis Checks
            console.log('[Techno E2E] Phase 5: Running QC Analysis checks...');
            await page.locator('[data-testid="distro-tab-brain"]').click();
            await page.waitForTimeout(1500);

            // Fill input fields in QC Panel to prevent validation error toasts
            console.log(`[Techno E2E] Pre-filling QC metadata for release "${currentPersona.releaseTitle}"...`);
            await page.locator('[data-testid="qc-input-title"]').fill(currentPersona.releaseTitle);
            await page.locator('[data-testid="qc-input-artist"]').fill(currentPersona.displayName);
            await page.waitForTimeout(1000);
            
            const runQCBtn = page.locator('[data-testid="qc-run-analysis"]');
            await expect(runQCBtn).toBeVisible({ timeout: 10000 });
            await runQCBtn.click({ force: true });

            const passedBadge = page.locator('[data-testid="qc-passed-badge"]');
            await expect(passedBadge).toBeVisible({ timeout: 25000 });
            console.log(`[Techno E2E] QC validation passed for ${currentPersona.displayName}!`);
            await page.waitForTimeout(1500);

            // Phase 6: Finance & Splits Review
            console.log('[Techno E2E] Phase 6: Navigating to Finance & Splits review...');
            await page.locator('[data-testid="nav-item-finance"]').click();
            await expect(page.getByRole('heading', { name: /Finance/i }).first()).toBeVisible({ timeout: 20000 });
            await page.waitForTimeout(1500);

            const expensesTab = page.locator('[data-testid="finance-tab-expenses"]');
            await expensesTab.click();
            await expect(expensesTab).toHaveAttribute('data-state', 'active');
            await page.waitForTimeout(1000);

            const royaltiesTab = page.locator('[data-testid="finance-tab-royalties"]');
            await royaltiesTab.click();
            await expect(royaltiesTab).toHaveAttribute('data-state', 'active');
            await page.waitForTimeout(1000);

            const recoupmentTab = page.locator('[data-testid="finance-tab-recoupment"]');
            await recoupmentTab.click();
            await expect(recoupmentTab).toHaveAttribute('data-state', 'active');
            console.log(`[Techno E2E] Finance tabs reviewed for ${currentPersona.displayName}!`);
            await page.waitForTimeout(1500);

            // Phase 7: State Verification
            console.log('[Techno E2E] Phase 7: Verifying final Zustand store state...');
            const finalProfile = await page.evaluate(() => {
                const store = (window as any).useStore;
                return store.getState().userProfile;
            });

            console.log(`[Techno E2E] Verified artist profile bio for ${currentPersona.displayName}:`, finalProfile.bio);
            expect(finalProfile.displayName).toBe(currentPersona.displayName);
            expect(finalProfile.careerStage).toBe("Building momentum");
            expect(finalProfile.goals).toContain("Touring");

            console.log(`[Techno E2E] Persona loop for ${currentPersona.displayName} completed and verified successfully!\n`);
            await page.waitForTimeout(3000);
        }

        console.log('[Techno E2E] All 5 Detroit Techno/House Artist Journeys completed and verified successfully!');
    });
});
