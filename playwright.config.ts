import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration — indiiOS E2E Tests
 *
 * Run:  npx playwright test
 * A11y: npx playwright test e2e/a11y.spec.ts
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:4242',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:4242',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
});
