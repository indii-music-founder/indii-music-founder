import { test, expect } from './fixtures/auth';

// Use same setup as other tests
test.describe('Founders Program Flow', () => {

    test.beforeEach(async ({ authedPage: page, context }) => {
        // 1. Mock the auth/onboarding states to prevent blocking overlays
        await context.addInitScript(() => {
            window.localStorage.setItem('TOUR_COMPLETED_dashboard', 'true');
            window.localStorage.setItem('INDIIOS_ONBOARDING_COMPLETE', 'true');
            window.localStorage.setItem('cookie-consent', '{"analytics":false,"marketing":false}');
        });

        // 2. Intercept and mock Stripe Checkout redirect
        await page.route('**/createOneTimeCheckout', async (route) => {
            // Fake a successful checkout initiation and simulate redirecting back with session_id
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        checkoutUrl: 'http://localhost:4242/founders-checkout?payment=success&session_id=cs_test_mock123'
                    }
                }),
            });
        });

        // 3. Intercept getLatestInvoice/stripe endpoints used across the app to prevent hangs
        await page.route('**/generateInvoice', route => route.fulfill({ status: 200, body: JSON.stringify({ data: {} }) }));
    });

    test('should complete the founders checkout flow from the landing page', async ({ authedPage: page }) => {
        // Navigate to the dashboard
        await page.goto('/dashboard');

        // Ensure the page has loaded before attempting to navigate
        await expect(page).toHaveURL(/\/dashboard/);

        // Simulate user navigating to the founders checkout page
        // Normally they would arrive here from the landing page link
        await page.goto('/founders-checkout');

        // Assert we're on the pre-checkout screen
        const checkoutHeading = page.locator('h1:has-text("Claim Your Position")');
        await expect(checkoutHeading).toBeVisible();

        // Assert the checkout button is visible
        const checkoutButton = page.locator('button:has-text("Complete Payment ($2,500)")');
        await expect(checkoutButton).toBeVisible();

        // Click checkout
        await checkoutButton.click();

        // The route mock for 'createOneTimeCheckout' will redirect the page to the success URL
        await page.waitForURL('**/founders-checkout?payment=success*');

        // Assert we are on the 'Sign the Covenant' step
        const signHeading = page.locator('h1:has-text("Secure Your Seat")');
        await expect(signHeading).toBeVisible();

        // Fill out the display name
        const nameInput = page.getByPlaceholder('e.g. Satoshi Nakamoto');
        await nameInput.fill('Playwright Tester');

        // Intercept the activateFounderPass function
        await page.route('**/activateFounderPass', async (route) => {
            const requestData = route.request().postDataJSON();

            // Verify payload
            expect(requestData.data.sessionId).toBe('cs_test_mock123');
            expect(requestData.data.displayName).toBe('Playwright Tester');

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        seat: 7,
                        message: 'Your Founder #7 pass was already activated.',
                        covenantHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                        joinedAt: new Date().toISOString(),
                        githubCommitPending: true
                    }
                }),
            });
        });

        // Click Complete
        const encodeButton = page.locator('button:has-text("Encode My Seat")');
        await encodeButton.click();

        // Verify success screen
        await expect(page.locator('h2:has-text("Welcome, Founder")')).toBeVisible();
        await expect(page.locator('text=abcdef1234567890')).toBeVisible();
    });
});
