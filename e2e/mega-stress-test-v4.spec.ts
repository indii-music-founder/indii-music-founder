import { test, expect } from './fixtures/auth';

const BASE_URL = process.env.E2E_STUDIO_URL || 'http://localhost:4242';

test.describe('Mega Stress Test v4.0 (Core Shell Integrity)', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ authedPage: page }) => {
        page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));

        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#root', { timeout: 15_000 });
    });

    test('101. App shell renders without overlay crashes', async ({ authedPage: page }) => {
        await expect(page.locator('#root')).toBeVisible();
        await expect(page.locator('#vite-error-overlay, [data-vite-error]')).toHaveCount(0);
    });

    test('102. Rapid module navigation keeps the shell alive', async ({ authedPage: page }) => {
        const navTargets = [
            '[data-testid="nav-item-dashboard"]',
            '[data-testid="nav-item-creative"]',
            '[data-testid="nav-item-video"]',
            '[data-testid="nav-item-finance"]',
            '[data-testid="nav-item-boardroom"]',
        ];

        for (const selector of navTargets) {
            const nav = page.locator(selector).first();
            if (await nav.isVisible().catch(() => false)) {
                await nav.click();
                await page.waitForTimeout(300);
            }
        }

        await expect(page.locator('#root')).toBeVisible();
        await expect(page.locator('#vite-error-overlay, [data-vite-error]')).toHaveCount(0);
    });

    test('103. Creative and boardroom entrypoints load real content', async ({ authedPage: page }) => {
        const creativeNav = page.locator('[data-testid="nav-item-creative"]').first();
        if (await creativeNav.isVisible().catch(() => false)) {
            await creativeNav.click();
            await expect(page.locator('h1, h2').filter({ hasText: /creative/i }).first()).toBeVisible({ timeout: 15_000 });
        }

        const boardroomNav = page.locator('[data-testid="nav-item-boardroom"]').first();
        if (await boardroomNav.isVisible().catch(() => false)) {
            await boardroomNav.click();
            await expect(page.locator('h1, h2').filter({ hasText: /boardroom/i }).first()).toBeVisible({ timeout: 15_000 });
        }
    });

    test('104. Settings page opens and navigates away cleanly', async ({ authedPage: page }) => {
        const settingsBtn = page.locator('[data-testid="nav-item-settings"]').first();
        await expect(settingsBtn).toBeVisible({ timeout: 15_000 });
        await settingsBtn.click();

        // Verify settings page is visible
        const profileHeader = page.getByRole('heading', { name: /profile/i }).first();
        await expect(profileHeader).toBeVisible({ timeout: 5_000 });

        // Navigate back to dashboard to "close" it
        const dashboardBtn = page.locator('[data-testid="return-hq-btn"]').first();
        await expect(dashboardBtn).toBeVisible({ timeout: 5_000 });
        await dashboardBtn.click();

        await expect(profileHeader).not.toBeVisible({ timeout: 3_000 });
    });

    test('105. Mobile remote entrypoint remains accessible from the shell', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/mobile-remote`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#root', { timeout: 15_000 });
        await expect(page.locator('h1:has-text("indii")').first()).toBeVisible({ timeout: 10_000 });
    });
});
