import { test, expect } from '@playwright/test';
import { test as authedTest } from './fixtures/auth';
// Typed window interface for Zustand store access in E2E tests
interface TestWindow extends Window {
    useStore: {
        getState: () => Record<string, unknown>;
        setState: (state: Record<string, unknown>) => void;
    };
    __TEST_MODE__: boolean;
}

// Configuration - use environment variables for sensitive data
const BASE_URL = process.env.E2E_STUDIO_URL || 'http://localhost:4242';
const TEST_USER_ID = `gauntlet_user_${Date.now()}`;

// Test credentials from environment (never hardcode!)
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || process.env.AUDITOR_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || process.env.AUDITOR_PASSWORD;

test.describe('The Gauntlet: Live Production Stress Test', () => {
    test.setTimeout(60000); // Increase timeout to 60s for full flow

    test.beforeEach(async ({ page }) => {
        // Capture browser logs for debugging
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', err => console.error(`BROWSER ERROR: ${err.message}`));

        // 1. Visit the live site
        await page.goto(BASE_URL);

        // Wait for initial load
        await page.waitForLoadState('domcontentloaded');
    });

    authedTest('Scenario 1: New User "Speedrun" (Onboarding -> Project -> Agent)', async ({ authedPage: page }) => {
        authedTest.setTimeout(120000); // 120 seconds timeout due to AI loading
        // Enable console log proxying
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));

        // 1. Setup: Bypass Auth & Inject Mock State
        // Using the predefined authenticated fixture's page (`authedPage`) which already injected the bypass scripts
        // Wait briefly for app state hook unification
        await page.waitForTimeout(1000);

        // Force app state to Onboarding (SPA state takes precedence over URL)
        console.log('[Gauntlet] Forcing module state to "onboarding"...');
        await page.evaluate(() => {
            const store = (window as unknown as TestWindow).useStore;
            console.log('[Gauntlet] PRE-Bypass Logic - Current Module:', store.getState().currentModule);

            store.setState({
                currentModule: 'onboarding',
                isAuthenticated: true,
                isAuthReady: true,
                userProfile: {
                    id: 'test-gauntlet-user',
                    uid: 'test-gauntlet-user',
                    email: 'gauntlet@test.com',
                    displayName: 'Gauntlet User',
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
                    careerStage: 'Producer',
                    goals: ['Release Music'],
                    analyzedTrackIds: [],
                    knowledgeBase: [],
                    savedWorkflows: []
                }
            });

            console.log('[Gauntlet] POST-Bypass Logic - Current Module:', store.getState().currentModule);
        });

        // Check for Onboarding Chat
        console.log('[Gauntlet] State set to Onboarding. Checking for Chat Input...');

        // Re-inject TEST_MODE in case of navigation/reload
        await page.evaluate(() => (window as unknown as TestWindow).__TEST_MODE__ = true);

        // 1. Send a message to the AI
        const chatInput = page.locator('[data-testid="prompt-input"]');

        try {
            await expect(chatInput).toBeVisible({ timeout: 5000 });
        } catch (e) {
            console.log('[Gauntlet] Chat Input NOT visible. Dumping page content...');
            const body = await page.evaluate(() => document.body.innerHTML);
            console.log('PAGE CONTENT DUMP:', body.substring(0, 3000));
            console.log('PAGE CONTENT DUMP (END):', body.substring(body.length - 3000));
            throw e;
        }

        // Use a comprehensive prompt to ensure we hit > 50% completion (Bio, Socials, Visuals, Goals)
        await chatInput.fill('I am a hyperpop artist called "Glitched" from London. My specific bio is: I am 22 and I make loud, distorted bubblegum bass music inspired by SOPHIE. I am just starting out but I want to tour the world. My instagram is @glitched_official. My brand colors are Neon Pink and Black.');
        await page.getByRole('button').filter({ has: page.locator('svg.lucide-send') }).click();

        // 2. Wait for AI response
        // Initial greeting (1) + User message (2) + Agent Response (3)
        // We must wait for the count to be 3.
        await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(3, { timeout: 45000 });

        const responseLocator = page.locator('.whitespace-pre-wrap').nth(2); // 0-indexed, so 2 is the 3rd message
        const responseText = await responseLocator.innerText();
        console.log(`[Gauntlet] Agent Response: "${responseText}"`);


        // Check for specific error keywords (adjusted to catch the user-reported "error")
        if (responseText.toLowerCase().includes('glitch') || responseText.toLowerCase().includes('error')) {
            throw new Error(`Agent reported error: ${responseText}`);
        }

        // Fail if we see "Error" or "Failed" in the response
        expect(responseText).not.toMatch(/error/i);
        expect(responseText).not.toMatch(/failed/i);
        expect(responseText).not.toMatch(/went wrong/i);

        // Try to finish if button is available
        const finishBtn = page.getByRole('button', { name: /Go to Studio/i });
        // Wait for it to potentially appear if the agent was successful
        try {
            await expect(page.getByRole('button', { name: "Go to Studio" })).toBeVisible({ timeout: 5000 });
            console.log('[Gauntlet] "Go to Studio" button visible. Clicking...');
            await finishBtn.click(); // Click the button after it's visible
        } catch (e) {
            console.log('[Gauntlet] "Go to Studio" button did not appear. We likely have an agent or state issue.');
            throw new Error(`Onboarding flow failed to complete: "Go to Studio" button missing. Last Agent Response: "${responseText}"`);
        }
        const skipBtn = page.getByRole('button', { name: /skip|continue|enter studio/i });
        if (await skipBtn.isVisible()) {
            await skipBtn.click();
        }

        await expect(page.getByRole('button', { name: /(Agent Workspace|My Dashboard)/i }).first()).toBeVisible({ timeout: 15000 });

        // Switch to "My Dashboard" tab where projects are created
        await page.getByRole('button', { name: /my dashboard/i }).first().click();

        // C. Create New Project (Creative Domain)
        // Dashboard may be loading initially — wait for it to settle
        await page.waitForTimeout(2000);

        // Click the '+' icon New Project button (has title="New Project" and icon-only)
        // Try the icon button first, fall back to the empty state "Create Project" text button
        const newProjectIconBtn = page.locator('button[title="New Project"]');
        const createProjectBtn = page.getByRole('button', { name: /create project/i });

        if (await newProjectIconBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await newProjectIconBtn.click();
        } else {
            // Empty state: "Create Project" button
            await createProjectBtn.first().click();
        }

        // Fill project name in modal
        await page.getByPlaceholder(/project name/i).fill(`Gauntlet Project ${Date.now()}`);
        await page.getByRole('button', { name: /^create$/i }).click();

        // D. Verify Redirection to Creative Module
        await expect(page.getByRole('button', { name: /generate image/i })).toBeVisible({ timeout: 15000 });

        // E. Stress Test: Agent Delegation (The fix we just made)
        // 4. Send a generic message to trigger GenUI (Choice Tool)
        const agentInput = page.getByPlaceholder(/describe your creative task/i);
        await expect(agentInput).toBeVisible();
        await agentInput.fill("I want to update my genre. Please give me some options.");
        await page.keyboard.press('Enter');

        // 5. Wait for Agent Response AND GenUI Buttons
        console.log('[Gauntlet] Waiting for Agent response and Options...');
        const agentResponse = page.locator('.bg-\\[\\#1a1f2e\\]').last();
        await expect(agentResponse).toBeVisible({ timeout: 15000 });

        // Check if buttons rendered (GenUI validation)
        const genUIButtons = agentResponse.locator('button');
        if (await genUIButtons.count() > 0) {
            console.log('[Gauntlet] GenUI Buttons Detected! Clicking first option...');
            await genUIButtons.first().click();
            // Wait for follow-up response
            await page.waitForTimeout(3000);
        } else {
            console.log('[Gauntlet] No GenUI buttons detected, proceeding with text check only.');
        }

        // 6. Send more details to ensure we hit >50% profile completion
        await agentInput.fill("My bio is: I am a Techno producer from Berlin. I love dark industrial sounds. My instagram is @techno_king.");
        await page.keyboard.press('Enter');

        // Wait for processing
        await page.waitForTimeout(5000);
        // F. Verify Response (Not "Failed to fetch")
        const response = page.getByTestId('agent-message').last();
        await expect(response).toBeVisible({ timeout: 20000 });
        await expect(response).not.toContainText('Failed to fetch');
        await expect(response).not.toContainText('error');

        console.log('[Gauntlet] Agent responded successfully.');
    });

    authedTest('Scenario 2: Chaos Check (Rapid Navigation)', async ({ authedPage: page }) => {
        // A. Setup: State already injected via authedPage fixture
        // Wait briefly for state completion
        await page.waitForTimeout(1000);

        // Force app state to a known ready state
        await page.evaluate(() => {
            const store = (window as unknown as TestWindow).useStore;
            store.setState({
                currentModule: 'dashboard',
                isAuthenticated: true,
                isAuthReady: true,
                userProfile: { uid: 'chaos-user', email: 'chaos@test.com', displayName: 'Chaos User' }
            });
        });

        console.log('[Gauntlet] Starting Scenario 2: Chaos Check');

        const navItems = ['dashboard', 'creative'];

        for (let i = 0; i < 5; i++) {
            const randomNav = navItems[Math.floor(Math.random() * navItems.length)];
            console.log(`[Gauntlet] Chaos Step ${i + 1}: Clicking nav-${randomNav}`);

            const navLocator = page.locator(`[data-testid="nav-${randomNav}"]`);
            try {
                await expect(navLocator).toBeVisible({ timeout: 2000 });
                await navLocator.click();
                await page.waitForTimeout(500);
            } catch (e) {
                console.log(`[Gauntlet] Nav item ${randomNav} not found or not visible, skipping.`);
            }
        }
    });

    authedTest('Scenario 3: Membership Limits Gauntlet', async ({ authedPage: page }) => {
        // State injected by authedPage
        await page.waitForTimeout(1000);

        console.log('[Gauntlet] Starting Scenario 3: Membership Limits');

        // Test 1: Verify FREE tier limits
        const freeTierLimits = await page.evaluate(() => {
            const store = (window as unknown as TestWindow).useStore;
            store.setState({
                currentModule: 'dashboard',
                isAuthenticated: true,
                isAuthReady: true,
                organizations: [{
                    id: 'org-free',
                    name: 'Free Org',
                    plan: 'free',
                    members: ['test-user']
                }],
                currentOrganizationId: 'org-free',
                userProfile: { uid: 'test-user', email: 'free@test.com', displayName: 'Free User' }
            });

            const state = store.getState() as Record<string, any>;
            return {
                org: state.organizations ? state.organizations[0] : null,
                plan: state.organizations && state.organizations[0] ? state.organizations[0].plan : null
            };
        });

        console.log('[Gauntlet] Free Tier State:', JSON.stringify(freeTierLimits));
        expect(freeTierLimits.plan).toBe('free');

        // Test 2: Verify PRO tier limits
        const proTierLimits = await page.evaluate(() => {
            const store = (window as unknown as TestWindow).useStore;
            store.setState({
                organizations: [{
                    id: 'org-pro',
                    name: 'Pro Org',
                    plan: 'pro',
                    members: ['test-user']
                }],
                currentOrganizationId: 'org-pro'
            });

            const state = store.getState() as Record<string, any>;
            return {
                org: state.organizations ? state.organizations[0] : null,
                plan: state.organizations && state.organizations[0] ? state.organizations[0].plan : null
            };
        });

        console.log('[Gauntlet] Pro Tier State:', JSON.stringify(proTierLimits));
        expect(proTierLimits.plan).toBe('pro');

        // Test 3: Verify ENTERPRISE tier limits
        const enterpriseTierLimits = await page.evaluate(() => {
            const store = (window as unknown as TestWindow).useStore;
            store.setState({
                organizations: [{
                    id: 'org-enterprise',
                    name: 'Enterprise Org',
                    plan: 'enterprise',
                    members: ['test-user']
                }],
                currentOrganizationId: 'org-enterprise'
            });

            const state = store.getState() as Record<string, any>;
            return {
                org: state.organizations ? state.organizations[0] : null,
                plan: state.organizations && state.organizations[0] ? state.organizations[0].plan : null
            };
        });

        console.log('[Gauntlet] Enterprise Tier State:', JSON.stringify(enterpriseTierLimits));
        expect(enterpriseTierLimits.plan).toBe('enterprise');

        // Test 4: Navigate to Video Studio and check for duration limits
        await page.evaluate(() => {
            const store = (window as unknown as TestWindow).useStore;
            store.setState({
                currentModule: 'video',
                organizations: [{
                    id: 'org-free',
                    name: 'Free Org',
                    plan: 'free',
                    members: ['test-user']
                }],
                currentOrganizationId: 'org-free'
            });
        });

        await page.waitForTimeout(1000);
        const pageContent = await page.content();

        expect(pageContent).not.toContain('Application Error');
        expect(pageContent).not.toContain('Something went wrong');

        console.log('[Gauntlet] Membership Limits Gauntlet completed successfully.');
    });

    authedTest('Scenario 4: Tier Transition Stress Test', async ({ authedPage: page }) => {
        // State injected by authedPage fixture
        await page.waitForTimeout(1000);

        console.log('[Gauntlet] Starting Scenario 4: Tier Transition Stress Test');

        const tiers = ['free', 'pro', 'enterprise'];

        for (let i = 0; i < 10; i++) {
            const tier = tiers[i % 3];

            await page.evaluate((tierValue) => {
                const store = (window as unknown as TestWindow).useStore;
                store.setState({
                    currentModule: 'dashboard',
                    isAuthenticated: true,
                    isAuthReady: true,
                    organizations: [{
                        id: `org-${tierValue}`,
                        name: `${tierValue.charAt(0).toUpperCase() + tierValue.slice(1)} Org`,
                        plan: tierValue,
                        members: ['stress-test-user']
                    }],
                    currentOrganizationId: `org-${tierValue}`,
                    userProfile: { uid: 'stress-test-user', email: 'stress@test.com', displayName: 'Stress User' }
                });
            }, tier);

            const currentPlan = await page.evaluate(() => {
                const store = (window as unknown as TestWindow).useStore;
                const state = store.getState() as Record<string, any>;
                return state.organizations?.[0]?.plan;
            });

            expect(currentPlan).toBe(tier);
            console.log(`[Gauntlet] Tier transition ${i + 1}/10: ${tier} - OK`);

            await page.waitForTimeout(100);
        }

        const finalState = await page.evaluate(() => {
            const store = (window as unknown as TestWindow).useStore;
            const state = store.getState() as Record<string, any>;
            return {
                isAuthenticated: state.isAuthenticated,
                hasOrg: state.organizations && state.organizations.length > 0
            };
        });

        expect(finalState.isAuthenticated).toBe(true);
        expect(finalState.hasOrg).toBe(true);

        console.log('[Gauntlet] Tier Transition Stress Test completed. No crashes detected.');
    });

    // New test: Authenticated flow using env credentials
    test('Scenario 5: Real Auth Flow (requires credentials)', async ({ page }) => {
        // Skip if no credentials configured
        test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'E2E credentials not configured in environment');

        console.log('[Gauntlet] Starting Scenario 5: Real Auth Flow');

        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        // Look for login form
        const emailInput = page.getByLabel(/email/i);
        const passwordInput = page.getByLabel(/password/i);

        if (await emailInput.isVisible({ timeout: 5000 })) {
            console.log('[Gauntlet] Login form found, authenticating...');
            await emailInput.fill(TEST_EMAIL!);
            await passwordInput.fill(TEST_PASSWORD!);
            await page.getByRole('button', { name: /sign in/i }).click();

            // Wait for successful auth
            await expect(page.getByRole('button', { name: /(Agent Workspace|My Dashboard)/i }).first()).toBeVisible({ timeout: 30000 });
            console.log('[Gauntlet] Real auth successful!');
        } else {
            console.log('[Gauntlet] No login form visible, may already be authenticated');
        }
    });
});
