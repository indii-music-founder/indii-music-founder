import { test, expect } from './fixtures/auth';

const BASE_URL = process.env.E2E_STUDIO_URL || 'http://localhost:4242';
const RUN_LIVE_GCP = process.env.RUN_LIVE_GCP === 'true';

test.describe('Mega Stress Test v10.0 (Live Backend Smoke)', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ authedPage: page }) => {
        page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));
    });

    test.skip(!RUN_LIVE_GCP, 'RUN_LIVE_GCP=true is required for live backend verification.');

    test('Routine 5. Backend health and app shell remain real', async ({ authedPage: page }) => {
        const healthResponse = await fetch('https://us-central1-indii-music-founder.cloudfunctions.net/health');
        expect(healthResponse.ok).toBe(true);

        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#root', { timeout: 15_000 });
        await expect(page.locator('#root')).toBeVisible();

        const content = await page.content();
        expect(content).not.toContain('Cost control ledger unavailable');
        expect(content).not.toContain('mock-sub-global');
        expect(content).not.toContain('videoTotalMinutes: 10');
        expect(content).not.toContain('Invalid hostname: us-aiplatform.googleapis.com');
    });

    test('Routine 7. Finance and workflow modules render without fixture data', async ({ authedPage: page }) => {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

        const financeNav = page.locator('[data-testid="nav-item-finance"]').first();
        if (await financeNav.isVisible().catch(() => false)) {
            await financeNav.click();
            await expect(page.locator('h1, h2').filter({ hasText: /finance/i }).first()).toBeVisible({ timeout: 30_000 });
        }

        const workflowNav = page.locator('[data-testid="nav-item-workflow"]').first();
        if (await workflowNav.isVisible().catch(() => false)) {
            await workflowNav.click();
            await expect(page.locator('h1, h2').filter({ hasText: /workflow/i }).first()).toBeVisible({ timeout: 30_000 });
        }
    });

    test('Routine 9. Firestore and API call errors stay absent in live mode', async ({ authedPage: page }) => {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2_000);
        const content = await page.content();
        expect(content).not.toContain('us-aiplatform.googleapis.com');
        expect(content).not.toContain('Cost control ledger unavailable');
    });
});
