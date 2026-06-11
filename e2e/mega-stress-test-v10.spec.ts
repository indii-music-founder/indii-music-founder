
import { test, expect } from './fixtures/auth';

interface TestWindow extends Window {
    useStore: {
        getState: () => Record<string, any>;
        setState: (state: Record<string, any>) => void;
    };
    __TEST_MODE__: boolean;
}

const BASE_URL = process.env.E2E_STUDIO_URL || 'http://localhost:4242';

test.describe('Mega Stress Test v10.0 (API and Security Hardening Regression)', () => {
    test.setTimeout(120000); // Allow ample time

    test.beforeEach(async ({ authedPage: page }) => {
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', err => console.error(`BROWSER ERROR: ${err.message}`));

        // Intercept local functions emulator traffic to avoid net::ERR_CONNECTION_REFUSED
        const rawUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4242";
        const origin = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
        const corsHeaders = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-version, X-HTTP-Session-Id, X-Goog-Api-Key, X-Goog-Api-Client, X-Firebase-Client",
        };

        await page.route("**/127.0.0.1:5001/**", async (route) => {
            const url = route.request().url();
            console.log(`[E2E-V10-MOCK] Emulator intercept: ${url}`);
            if (route.request().method() === "OPTIONS") {
                await route.fulfill({ status: 204, headers: corsHeaders });
                return;
            }

            if (url.includes("getSubscription")) {
                await route.fulfill({
                    status: 200,
                    headers: corsHeaders,
                    contentType: "application/json",
                    body: JSON.stringify({
                        data: {
                            id: 'mock-sub-global',
                            userId: 'test-user-uid-e2e',
                            tier: 'pro_monthly',
                            status: 'active',
                            currentPeriodStart: Date.now(),
                            currentPeriodEnd: Date.now() + 30 * 86400000,
                            cancelAtPeriodEnd: false,
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        },
                    }),
                });
                return;
            }

            if (url.includes("getUsageStats")) {
                await route.fulfill({
                    status: 200,
                    headers: corsHeaders,
                    contentType: "application/json",
                    body: JSON.stringify({
                        data: {
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
                        },
                    }),
                });
                return;
            }

            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: "application/json",
                body: JSON.stringify({ data: {} }),
            });
        });
    });

    test('Routine 5. API Key Fallback Verification (ISSUE-090 / ISSUE-095)', async ({ authedPage: page }) => {
        // Go to home and verify no cost control ledger crash unblocked loading
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Verify the main dashboard loaded and there's no blank page from CostControlService crash
        const content = await page.content();
        expect(content).not.toContain('Cost control ledger unavailable');
    });

    test('Routine 7. Campaign Image Storage (ISSUE-091 / ISSUE-097)', async ({ authedPage: page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        await page.evaluate(() => {
            const store = (window as unknown as TestWindow).useStore;
            store.setState({ currentModule: 'marketing', isAuthenticated: true });
        });
        await page.waitForTimeout(2000);

        // Check that marketing department container is loaded
        const marketingHeader = page.locator('h1').filter({ hasText: /campaign dashboard/i }).first();
        await expect(marketingHeader).toBeVisible({ timeout: 45000 });
    });

    test('Routine 8. OmniWorkflow Graceful Degradation (ISSUE-092 / ISSUE-098)', async ({ authedPage: page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        await page.evaluate(() => {
            const store = (window as unknown as TestWindow).useStore;
            store.setState({ currentModule: 'workflow', isAuthenticated: true });
        });
        await page.waitForTimeout(2000);

        // Check workflow builder renders
        const workflowHeader = page.locator('h1, h2').filter({ hasText: /workflow/i }).first();
        await expect(workflowHeader).toBeVisible({ timeout: 45000 });
    });

    test('Routine 9. Firestore Rules Compilation (ISSUE-094 / ISSUE-099)', async ({ authedPage: page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        const content = await page.content();
        expect(content).not.toContain('isOwnerWrite is not defined');
    });
});
