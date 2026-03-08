import { test as base, Page } from '@playwright/test';

/**
 * Auth fixture — bypasses Firebase auth for E2E tests.
 *
 * Strategy: inject VITE_SKIP_ONBOARDING via the webServer env and intercept
 * Firebase auth REST calls to return a synthetic user token. This avoids
 * requiring a live Firebase project for CI runs.
 *
 * Usage:
 *   import { test } from './fixtures/auth';
 *   test('my test', async ({ authedPage }) => { ... });
 */

export type AuthFixtures = {
    authedPage: Page;
};

export const test = base.extend<AuthFixtures>({
    authedPage: async ({ page }, use) => {
        // Intercept Firebase Identity Toolkit auth calls and return a fake user
        await page.route('**/identitytoolkit.googleapis.com/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    localId: 'test-user-uid-e2e',
                    email: 'e2e@indiios.test',
                    displayName: 'E2E Test User',
                    idToken: 'fake-id-token-e2e',
                    refreshToken: 'fake-refresh-token-e2e',
                    expiresIn: '3600',
                    registered: true,
                }),
            });
        });

        // Intercept Firestore user document reads
        await page.route('**/firestore.googleapis.com/**', async route => {
            const url = route.request().url();
            if (url.includes('/users/')) {
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
        await page.waitForTimeout(2_000);

        await use(page);
    },
});

export { expect } from '@playwright/test';
