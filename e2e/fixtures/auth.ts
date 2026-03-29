import { test as base, Page } from '@playwright/test';

/**
 * Auth fixture — bypasses Firebase auth for E2E tests using state injection.
 */

export type AuthFixtures = {
    authedPage: Page;
};

export const test = base.extend<AuthFixtures>({
    authedPage: async ({ page }, use) => {
        // Intercept Firestore to prevent hangs
        await page.route('**/firestore.googleapis.com/**', async route => {
            const url = route.request().url();
            if (url.includes('/Listen/') || url.includes('/Listen?') || url.includes('channel?') || url.includes('database=')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
                return;
            }
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
                return;
            }
            await route.continue();
        });

        // Inject Mocks BEFORE navigation
        await page.addInitScript(() => {
            (window as any).electronAPI = {
                getPlatform: () => Promise.resolve('darwin'),
                getAppVersion: () => Promise.resolve('0.1.0-e2e'),
                showNotification: () => { },
                selectFile: () => Promise.resolve('/tmp/mock-audio.wav'),
                audio: { analyze: () => Promise.resolve({ status: 'success', streams: [{ sample_rate: '44100', bits_per_sample: 16 }] }) },
                distribution: {
                    validateMetadata: () => Promise.resolve({
                        success: true,
                        report: { valid: true, errors: [], warnings: [], summary: 'Mock QC Pass' }
                    }),
                    generateISRC: () => Promise.resolve({ success: true, isrc: 'US-IND-24-00001' }),
                    generateUPC: () => Promise.resolve({ success: true, upc: '123456789012' }),
                    generateDDEX: () => Promise.resolve({ success: true, xml: '<DDEX/>' }),
                    submitRelease: () => Promise.resolve({ success: true, report: { status: 'COMPLETE', sftp_skipped: true } }),
                    onSubmitProgress: (cb: (data: any) => void) => {
                        setTimeout(() => cb({ step: 'COMPLETE', progress: 100 }), 100);
                        return () => { };
                    }
                }
            };

            // Inject mocked Firebase Auth state
            (window as any).FIREBASE_E2E_MOCK = true;
            (window as any).FIREBASE_USER = {
                uid: 'test-user-uid-e2e',
                email: 'e2e@indiios.test',
                displayName: 'E2E Test User',
                isAnonymous: true
            };
        });

        await page.goto('/');

        // Wait for the app shell to appear
        const shell = page.locator('[data-testid="app-container"], nav, .app-shell, main').first();
        await shell.waitFor({ state: 'visible', timeout: 30_000 });

        // eslint-disable-next-line react-hooks/rules-of-hooks
        await use(page);
    },
});

export { expect } from '@playwright/test';
