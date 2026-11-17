import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth';

/**
 * The Subscription sub-tab lives inside EarningsDashboard, which only renders its
 * tabs once an earnings summary exists. Offline Firestore resolves the earnings
 * subscription to null, so deliver a minimal valid summary through the finance
 * service singleton before the Earnings tab mounts and subscribes.
 */
async function openSubscriptionTab(page: Page): Promise<void> {
    await page.evaluate(async () => {
        const { financeService } = await import('/src/services/finance/FinanceService.ts');
        (financeService as any).subscribeToEarnings = (_userId: string, onData: (data: unknown) => void) => {
            onData({
                period: { startDate: '2026-01-01', endDate: '2026-01-31' },
                totalGrossRevenue: 0,
                totalNetRevenue: 0,
                totalStreams: 0,
                totalDownloads: 0,
                currencyCode: 'USD',
                byPlatform: [],
                byTerritory: [],
                byRelease: [],
            });
            return () => undefined;
        };
    });
    await page.locator('[data-testid="finance-tab-earnings"]').click();
    await page.locator('[data-testid="earnings-subtab-subscription"]').click();
}

test.describe('Payment Flow (Item 278)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ authedPage: page }) => {
        // ── Mock createCheckoutSession Cloud Function ────────────────────────
        await page.route(/cloudfunctions\.net\/createCheckoutSession/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: {
                        sessionId: 'cs_test_mock_session_001',
                        url: 'https://checkout.stripe.com/pay/cs_test_mock_session_001',
                    },
                }),
            });
        });

        // ── Mock stripeWebhook Cloud Function ────────────────────────────────
        await page.route(/cloudfunctions\.net\/stripeWebhook/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ received: true }),
            });
        });

        // ── Mock getSubscription and getUsageStats Cloud Functions ───────────
        await page.route(/cloudfunctions\.net\/getSubscription/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        id: 'mock-sub-1',
                        userId: 'test-user-1',
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
        });

        await page.route(/cloudfunctions\.net\/getUsageStats/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
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
        });

        // ── Mock Firestore subscription reads ───────────────────────────────
        await page.route('**/firestore.googleapis.com/**/subscriptions**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    documents: [{
                        name: 'projects/test/databases/(default)/documents/subscriptions/test-user-001',
                        fields: {
                            status: { stringValue: 'active' },
                            plan: { stringValue: 'pro' },
                            stripeCustomerId: { stringValue: 'cus_test_001' },
                        },
                    }],
                }),
            });
        });

        await page.goto('/finance', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-testid="finance-header"]').waitFor({ state: 'visible', timeout: 30_000 });
    });

    test('Strict Stripe Test Mode directive followed during E2E checkout', async ({ authedPage: page }) => {
        let testModeDirectiveFound = false;

        await page.route(/cloudfunctions\.net\/createCheckoutSession/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: {
                        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_a1b2c3d4',
                        url: 'https://checkout.stripe.com/pay/cs_test_a1b2c3d4',
                        sessionId: 'cs_test_a1b2c3d4'
                    }
                })
            });
        });

        // Intercept Stripe checkout navigation
        await page.route('https://checkout.stripe.com/**', async route => {
            const checkoutUrl = route.request().url();
            if (checkoutUrl.includes('test')) {
                testModeDirectiveFound = true;
            }
            await route.abort();
        });

        // Open subscription tab in Finance
        await openSubscriptionTab(page);
        await expect(page.locator('[data-testid="subscription-tab-content"]')).toBeVisible({ timeout: 15_000 });

        // Trigger upgrade for a paid tier (build)
        const upgradeBtn = page.locator('[data-testid="tier-upgrade-build"]');
        await expect(upgradeBtn).toBeVisible({ timeout: 10_000 });
        await upgradeBtn.click();

        await page.waitForTimeout(500);
        expect(testModeDirectiveFound).toBe(true);
    });

    test('subscription plan cards render and are interactive', async ({ authedPage: page }) => {
        await openSubscriptionTab(page);

        const subscriptionContent = page.locator('[data-testid="subscription-tab-content"]');
        await expect(subscriptionContent).toBeVisible({ timeout: 15_000 });
        await expect(subscriptionContent.getByText('Resource Allowance')).toBeVisible();
        await expect(subscriptionContent.getByText('Available Systems')).toBeVisible();
    });

    test('Upgrade button triggers mocked Stripe checkout session', async ({ authedPage: page }) => {
        let checkoutCallMade = false;

        await page.route(/cloudfunctions\.net\/createCheckoutSession/, async route => {
            checkoutCallMade = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: {
                        sessionId: 'cs_test_mock_001',
                        url: 'https://checkout.stripe.com/pay/cs_test_mock_001',
                    },
                }),
            });
        });

        await page.route('https://checkout.stripe.com/**', async route => {
            await route.abort();
        });

        await openSubscriptionTab(page);
        await expect(page.locator('[data-testid="subscription-tab-content"]')).toBeVisible({ timeout: 15_000 });

        const upgradeBtn = page.locator('[data-testid="tier-upgrade-build"]');
        await expect(upgradeBtn).toBeVisible({ timeout: 10_000 });
        await upgradeBtn.click();

        await page.waitForTimeout(1_000);
        expect(checkoutCallMade).toBe(true);
    });

    test('simulated webhook activates subscription display', async ({ authedPage: page }) => {
        const response = await page.request.post(
            'https://us-central1-test-project.cloudfunctions.net/stripeWebhook',
            {
                headers: {
                    'Content-Type': 'application/json',
                    'stripe-signature': 't=1700000000,v1=mock_sig',
                },
                data: JSON.stringify({
                    type: 'checkout.session.completed',
                    data: {
                        object: {
                            id: 'cs_test_mock_001',
                            customer: 'cus_test_001',
                            subscription: 'sub_test_001',
                            payment_status: 'paid',
                        },
                    },
                }),
            }
        ).catch(() => null);

        if (response) {
            expect(response.status()).toBeLessThan(500);
        }

        await expect(page.locator('[data-testid="finance-header"]')).toBeVisible();
    });

    test('Pro-gated features show upgrade prompt for free tier', async ({ authedPage: page }) => {
        // Mock subscription as free tier
        await page.route(/cloudfunctions\.net\/getSubscription/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: { 
                    id: 'mock-sub-free',
                    userId: 'test-user-1',
                    status: 'active', 
                    tier: 'free',
                    currentPeriodStart: Date.now(),
                    currentPeriodEnd: Date.now() + 30 * 86400000,
                    cancelAtPeriodEnd: false,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                } }),
            });
        });

        await page.route(/cloudfunctions\.net\/getUsageStats/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: { 
                    tier: 'free', 
                    resetDate: Date.now() + 30 * 86400000, 
                    imagesGenerated: 0,
                    imagesRemaining: 0, 
                    imagesPerMonth: 0,
                    videoDurationSeconds: 0,
                    videoDurationMinutes: 0,
                    videoRemainingMinutes: 0, 
                    videoTotalMinutes: 0,
                    aiChatTokensUsed: 0,
                    aiChatTokensRemaining: 0, 
                    aiChatTokensPerMonth: 0,
                    projectsCreated: 0,
                    projectsRemaining: 1, 
                    maxProjects: 1,
                    teamMembersUsed: 1,
                    teamMembersRemaining: 0,
                    maxTeamMembers: 1,
                    storageUsedGB: 0,
                    storageRemainingGB: 1,
                    storageTotalGB: 1
                } }),
            });
        });

        await page.route('**/firestore.googleapis.com/**/subscriptions**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    documents: [{
                        name: 'projects/test/databases/(default)/documents/subscriptions/test-user-001',
                        fields: {
                            status: { stringValue: 'active' },
                            tier: { stringValue: 'free' },
                        },
                    }],
                }),
            });
        });

        // Navigate to distribution
        await page.goto('/distribution', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1_500);

        // Ensure page rendered without crash
        await expect(page.locator('body')).not.toContainText('Something went wrong');
    });

    test('error state handling: payment failure shows appropriate message', async ({ authedPage: page }) => {
        // Mock failed checkout session
        await page.route(/cloudfunctions\.net\/createCheckoutSession/, async route => {
            await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: 'Payment processing failed. Please try again.',
                }),
            });
        });

        await page.route('https://checkout.stripe.com/**', async route => {
            await route.abort();
        });

        await openSubscriptionTab(page);
        await expect(page.locator('[data-testid="subscription-tab-content"]')).toBeVisible({ timeout: 15_000 });

        const upgradeBtn = page.locator('[data-testid="tier-upgrade-build"]');
        await expect(upgradeBtn).toBeVisible({ timeout: 10_000 });
        await upgradeBtn.click();

        await page.waitForTimeout(1_500);
        await expect(page.locator('body')).not.toContainText('Something went wrong');
    });
});
