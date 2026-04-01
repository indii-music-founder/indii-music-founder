import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration — indiiOS E2E Tests
 *
 * Run:           npx playwright test
 * A11y only:     npx playwright test e2e/a11y.spec.ts
 * Mobile only:   npx playwright test --project=mobile-chrome
 * Single spec:   npx playwright test e2e/navigation.spec.ts
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4242';
const isLocalhost = baseURL.startsWith('http://localhost') || baseURL.startsWith('http://127.0.0.1');

process.env.VITE_SKIP_ONBOARDING = 'true';

export default defineConfig({
    testDir: './e2e',
    // DISABLE parallel execution to prevent E2E auth mock cross-contamination 
    // inside the shared browser context / dev server environment.
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    // Enforce serial worker execution for stable mocked tests
    workers: 1,
    reporter: [['html'], ['list']],
    timeout: 60_000,
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        serviceWorkers: 'block',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile-chrome',
            use: { ...devices['Pixel 7'] },
        },
        {
            name: 'mobile-safari',
            use: { ...devices['iPhone 14'] },
        },
    ],
    ...(isLocalhost ? {
        webServer: {
            command: 'npm run dev',
            url: 'http://localhost:4242',
            reuseExistingServer: !process.env.CI,
            timeout: 60_000,
        },
    } : {}),
});
