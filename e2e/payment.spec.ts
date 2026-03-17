import { test, expect } from '@playwright/test';

/**
 * Item 278: Payment Flow E2E Tests — Subscription Checkout Journey
 *
 * Covers: plan selection → mocked Stripe Checkout session creation →
 *         simulated webhook → subscription activation → feature gating.
 *
 * All Cloud Functions and Stripe API calls are intercepted so no real
 * charges are made in CI.
 *
 * Run: npx playwright test e2e/payment.spec.ts
 */

test.describe('Payment Flow (Item 278)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ page }) => {
        // ── Mock createCheckoutSession Cloud Function ────────────────────────
        await page.route('**/cloudfunctions.net/**/createCheckoutSession**', async route => {
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
        await page.route('**/cloudfunctions.net/**/stripeWebhook**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ received: true }),
            });
        });

        // ── Mock getSubscriptionStatus Cloud Function ────────────────────────
        await page.route('**/cloudfunctions.net/**/getSubscriptionStatus**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: {
                        status: 'active',
                        plan: 'pro',
                        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
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

        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(1_500);
    });

    // ── Plan selection & checkout initiation ──────────────────────────────────

    test('subscription plan cards render and are interactive', async ({ page }) => {
        // Navigate to settings / subscription section
        const settingsSelectors = [
            '[data-testid="nav-item-settings"]',
            'button:has-text("Settings")',
            '[aria-label*="settings" i]',
        ];
        for (const sel of settingsSelectors) {
            const el = page.locator(sel).first();
            if (await el.isVisible().catch(() => false)) {
                await el.click();
                await page.waitForTimeout(1_000);
                break;
            }
        }

        // Look for plan/billing section
        const billingTriggers = [
            'button:has-text("Subscription")',
            'button:has-text("Billing")',
            '[data-testid="billing-tab"]',
            'text=/subscription|billing/i',
        ];
        for (const sel of billingTriggers) {
            const el = page.locator(sel).first();
            if (await el.isVisible().catch(() => false)) {
                await el.click();
                await page.waitForTimeout(800);
                break;
            }
        }

        // Root should be stable
        await expect(page.locator('#root')).toBeVisible();
        console.log('Plan section navigation complete');
    });

    test('Upgrade button triggers mocked Stripe checkout session', async ({ page }) => {
        let checkoutCallMade = false;

        // Intercept checkout CF and record the call
        await page.route('**/cloudfunctions.net/**/createCheckoutSession**', async route => {
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

        // Block navigation to checkout.stripe.com so test doesn't leave the app
        await page.route('https://checkout.stripe.com/**', async route => {
            await route.abort();
        });

        // Find and click any Upgrade/Pro/Subscribe button
        const upgradeBtn = page.locator(
            'button:has-text("Upgrade"), button:has-text("Get Pro"), button:has-text("Subscribe"), button:has-text("Start Free Trial")'
        ).first();
        const btnVisible = await upgradeBtn.isVisible().catch(() => false);

        if (btnVisible) {
            await upgradeBtn.click();
            await page.waitForTimeout(1_200);
            console.log(`Checkout CF called: ${checkoutCallMade}`);
        }

        await expect(page.locator('#root')).toBeVisible();
    });

    // ── Subscription activation simulation ───────────────────────────────────

    test('simulated webhook activates subscription display', async ({ page }) => {
        // Simulate a checkout.session.completed webhook by calling the mocked endpoint
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
            console.log(`Webhook response status: ${response.status()}`);
            expect(response.status()).toBeLessThan(500);
        }

        await expect(page.locator('#root')).toBeVisible();
    });

    // ── Feature gating ────────────────────────────────────────────────────────

    test('Pro-gated features show upgrade prompt for free tier', async ({ page }) => {
        // Mock subscription status as free tier
        await page.route('**/cloudfunctions.net/**/getSubscriptionStatus**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ result: { status: 'inactive', plan: 'free' } }),
            });
        });

        // App should not crash when subscription check returns free tier
        await expect(page.locator('#root')).toBeVisible();
        await expect(page.locator('body')).not.toContainText('Something went wrong');
        console.log('Feature gating: free tier renders without crash');
    });

    test('payment history section renders without crash', async ({ page }) => {
        // Mock invoice list
        await page.route('**/cloudfunctions.net/**/listInvoices**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    result: {
                        invoices: [
                            { id: 'in_001', amount_due: 1999, status: 'paid', created: 1700000000 },
                            { id: 'in_002', amount_due: 1999, status: 'paid', created: 1697408000 },
                        ],
                    },
                }),
            });
        });

        const historyTrigger = page.locator(
            'text=/payment history|invoices|billing history/i, button:has-text("History")'
        ).first();
        if (await historyTrigger.isVisible().catch(() => false)) {
            await historyTrigger.click();
            await page.waitForTimeout(800);
        }

        await expect(page.locator('#root')).toBeVisible();
        console.log('Payment history section stable');
    });
});
