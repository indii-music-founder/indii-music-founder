import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    retries: 0,
    workers: 1, // Electron tests must run sequentially
    use: {
        trace: 'on-first-retry',
    },
    webServer: [
        {
            command: 'npm run dev -- --port 4242',
            port: 4242,
            reuseExistingServer: !process.env.CI,
        }
    ],
    projects: [
        {
            name: 'electron',
            testMatch: /.*electron.spec.ts/,
        },
        {
            name: 'web',
            use: {
                baseURL: 'http://localhost:4242',
                browserName: 'chromium',
            },
            testIgnore: /.*electron.spec.ts/,
        },
    ],
});
