import { test, expect } from './fixtures/auth';

const BASE_URL = process.env.E2E_STUDIO_URL || 'http://localhost:4242';

test.describe('Mega Stress Test v11.0 (Route Integrity)', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ authedPage: page }) => {
        page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));
    });

    test('Routine 111: Creative route loads actual UI controls', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/creative`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('body')).toBeVisible();
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
        // The view-mode buttons were removed; the studio's navbar and workspace are its controls.
        await expect(page.locator('[data-testid="creative-navbar"]').first()).toBeVisible({ timeout: 30_000 }); // bypass-strict: candidate element present across multiple viewport containers
        await expect(page.locator('[data-testid="creative-studio-container"]').first()).toBeVisible(); // bypass-strict: candidate element present across multiple viewport containers
    });

    test('Routine 120: Core routes render without overlay crashes', async ({ authedPage: page }) => {
        const routes = ['/', '/creative', '/merch', '/distribution', '/legal', '/finance', '/analytics', '/boardroom'];

        for (const route of routes) {
            await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('body')).toBeVisible();
            await expect(page.locator('#vite-error-overlay, [data-vite-error]')).toHaveCount(0);
        }
    });
});
