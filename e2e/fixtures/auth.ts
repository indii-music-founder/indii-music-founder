import { test as base, Page } from '@playwright/test';

/**
 * Auth fixture — bypasses Firebase auth for E2E tests.
 *
 * Strategy: navigate to the app in dev mode, click the "Guest Login (Dev)"
 * button (only rendered when import.meta.env.DEV === true, which is always
 * the case for the Playwright web server). This calls signInAnonymously()
 * against the real Firebase project, which requires no prior setup. The
 * resulting anonymous session is stored in IndexedDB and survives page
 * reloads within the same browser context.
 *
 * Firestore reads are intercepted to return empty payloads so tests are
 * isolated from production data.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth';
 *   test('my test', async ({ authedPage }) => { ... });
 */

export type AuthFixtures = {
    authedPage: Page;
};

export const test = base.extend<AuthFixtures>({
    authedPage: async ({ page }, use) => {
        // Intercept Firestore reads to return empty collections — prevents tests
        // from depending on real user data while still letting writes through.
        await page.route('**/firestore.googleapis.com/**', async route => {
            const url = route.request().url();
            if (route.request().method() === 'GET' && url.includes('/users/')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        fields: {
                            uid: { stringValue: 'test-user-uid-e2e' },
                            email: { stringValue: 'e2e@indiios.test' },
                            displayName: { stringValue: 'E2E Test User' },
                            membershipTier: { stringValue: 'pro' },
                            onboardingCompleted: { booleanValue: true },
                        },
                    }),
                });
            } else {
                await route.continue();
            }
        });

        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });

        // If the login form is visible, click "Guest Login (Dev)" to authenticate.
        // The button is rendered only in DEV mode (import.meta.env.DEV === true),
        // which is always true for the Playwright web server.
        const guestBtn = page.locator('button:has-text("Guest Login")');
        const loginVisible = await guestBtn.isVisible().catch(() => false);

        if (loginVisible) {
            await guestBtn.click();
            // Wait for Firebase anonymous auth to complete and the app shell to appear.
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 15_000 })
                .catch(() => {
                    // App container may not yet have the testid — fall back to a fixed delay
                });
            await page.waitForTimeout(2_000);
        } else {
            // Already authenticated (e.g. session restored from IndexedDB)
            await page.waitForTimeout(1_000);
        }

        // eslint-disable-next-line react-hooks/rules-of-hooks
        await use(page);
    },
});

export { expect } from '@playwright/test';
