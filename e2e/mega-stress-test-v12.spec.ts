import { test, expect } from './fixtures/auth';

const BASE_URL = process.env.E2E_STUDIO_URL || 'http://localhost:4242';

test.describe('Mega Stress Test v12.0 (Mobile and Module Stability)', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ authedPage: page }) => {
        page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));
    });

    test.use({ viewport: { width: 375, height: 812 } });

    test('Routine 124: Creative to finance navigation stays intact', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/creative`, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/.*creative/);

        await page.goto(`${BASE_URL}/finance`, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/.*finance/);
        await expect(page.locator('body')).toBeVisible();
    });

    test('Routine 125: Founders route renders without loop or crash', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/founders`, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/.*founders/);
        await expect(page.locator('body')).toBeVisible();
        await expect(page.locator('#vite-error-overlay, [data-vite-error]')).toHaveCount(0);
    });

    test('Routine 128: Mobile remote entrypoint loads on a narrow viewport', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/mobile-remote`, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(/.*mobile-remote/);
        await expect(page.locator('h1:has-text("indii")').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('body')).toBeVisible();
    });
});
