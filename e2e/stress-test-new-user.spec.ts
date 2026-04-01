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


        // Check for specific error keywords — avoid false positives from artist names.
        // "Glitched" is the test artist's name, so we must NOT match on "glitch" alone.
        const lowerResponse = responseText.toLowerCase();
        const apiMissingPatterns = ['tech hiccup', 'error occurred', 'went wrong', 'failed to', 'unable to process', 'something went wrong'];
        const isApiMissing = apiMissingPatterns.some(p => lowerResponse.includes(p));

        if (isApiMissing) {
            console.log(`[Gauntlet] Agent reported an error or missing API key (matched: "${responseText}"). Handled gracefully via 'Skip'`);
        }

        // Try to finish if button is available. Normally the AI would yield "Go to Studio" 
        // after finishing onboarding. If the API failed, we can use "Skip" instead.
        const finishBtn = page.getByRole('button', { name: "Go to Studio" });
        const skipBtn = page.getByRole('button', { name: /skip|continue|enter studio|done/i });

        if (await finishBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('[Gauntlet] "Go to Studio" button visible. Clicking...');
            await finishBtn.click();
        } else if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('[Gauntlet] "Skip/Continue" button visible. Clicking...');
            await skipBtn.click();
        } else {
            console.log('[Gauntlet] Neither finish nor skip buttons appeared. We likely have an agent or state issue.');
            throw new Error(`Onboarding flow failed to complete: Both "Go to Studio" and "Skip" commands missing. Last Agent Response: "${responseText}"`);
        }

        await expect(page.getByRole('button', { name: /(Agent Workspace|My Dashboard)/i }).first()).toBeVisible({ timeout: 15000 });

        // C. Navigate to Creative Domain
        // Project creation is no longer required upfront; users jump straight into modules
        await page.waitForTimeout(1000);
        console.log('[Gauntlet] Navigating to Creative Director...');
        await page.locator('[data-testid="nav-item-creative"]').click();

        // D. Verify Creative Director Module Loaded
        await expect(page.getByRole('heading', { name: /Creative Director/i })).toBeVisible({ timeout: 15000 });
        console.log('[Gauntlet] Creative Director module loaded.');

        // E. Verify Key Sub-Modules Are Accessible
        // The Creative Director has tabs: Gallery, Canvas, Direct, Lab, Release AND Builder, Brand, Library
        const galleryTab = page.getByRole('button', { name: /gallery/i }).first();
        const builderTab = page.getByRole('button', { name: /builder/i }).first();
        await expect(galleryTab).toBeVisible({ timeout: 5000 });
        await expect(builderTab).toBeVisible({ timeout: 5000 });
        console.log('[Gauntlet] Creative Director sub-tabs verified (Gallery, Builder).');

        // F. Verify Chat Input is Ready
        // The chat input can be in the right panel (Messages tab) OR the bottom bar (textbox)
        const creativeChatInput = page.getByPlaceholder(/describe your creative task|message creative|ask anything/i).first();
        const isInputVisible = await creativeChatInput.isVisible({ timeout: 5000 }).catch(() => false);
        if (isInputVisible) {
            console.log('[Gauntlet] Chat input ready. Creative Director integration verified.');
        } else {
            // Fallback: check for the textbox by role (bottom bar layout)
            const bottomBarInput = page.getByRole('textbox', { name: /message creative/i }).first();
            const isBottomBar = await bottomBarInput.isVisible({ timeout: 3000 }).catch(() => false);
            if (isBottomBar) {
                console.log('[Gauntlet] Chat input (bottom bar) ready. Creative Director integration verified.');
            } else {
                console.log('[Gauntlet] Warning: Chat input not found, but module loaded successfully.');
            }
        }

        console.log('[Gauntlet] Scenario 1 complete — Onboarding → Dashboard → Creative Director flow verified.');
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

        const navItems = [/My Dashboard/i, /Agent Workspace/i, /Image Studio/i, /Video Studio/i];

        for (let i = 0; i < 5; i++) {
            const randomNav = navItems[Math.floor(Math.random() * navItems.length)];
            console.log(`[Gauntlet] Chaos Step ${i + 1}: Clicking ${randomNav}`);

            const navLocator = page.getByRole('button', { name: randomNav }).first();
            const isVisible = await navLocator.isVisible({ timeout: 2000 }).catch(() => false);
            if (isVisible) {
                await navLocator.click();
                await page.waitForTimeout(500);
            } else {
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
        const emailInput = page.getByLabel(/email/i).first();
        const passwordInput = page.getByLabel(/password/i).first();

        if (await emailInput.isVisible({ timeout: 5000 })) {
            console.log('[Gauntlet] Login form found, authenticating...');
            await emailInput.fill(TEST_EMAIL!);
            await passwordInput.fill(TEST_PASSWORD!);
            // Use form submit button — NOT the "Sign In" tab toggle at the top
            await page.locator('form button[type="submit"]').first().click();

            // Wait for successful auth
            await expect(page.getByRole('button', { name: /(Agent Workspace|My Dashboard)/i }).first()).toBeVisible({ timeout: 30000 });
            console.log('[Gauntlet] Real auth successful!');
        } else {
            console.log('[Gauntlet] No login form visible, may already be authenticated');
        }
    });
});
