import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration — indiiOS E2E Tests
 *
 * Run:           npx playwright test
 * A11y only:     npx playwright test e2e/a11y.spec.ts
 * Mobile only:   npx playwright test --project=mobile-chrome
 * Single spec:   npx playwright test e2e/navigation.spec.ts
 *
 * Specs:
 *   a11y.spec.ts              – WCAG 2.1 AA compliance
 *   navigation.spec.ts        – Sidebar, module routing, command bar
 *   chat-interaction.spec.ts  – Chat, prompt area, delegate menu
 *   agent-flows.spec.ts       – Agent dashboard, scout, specialist agents
 *   creative-persistence.spec.ts – Creative studio state persistence
 *   mobile-responsiveness.spec.ts – Mobile viewport behavior
 *   distribution-workflow.spec.ts – Distribution module workflows
 *   finance-workflow.spec.ts  – Finance module workflows
 *   maestro-workflows.spec.ts – Maestro batch task orchestration
 *   chaos.spec.ts             – Resilience and error recovery
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['html'], ['list']],
    use: {
        baseURL: 'http://localhost:4242',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
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
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:4242',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
});
