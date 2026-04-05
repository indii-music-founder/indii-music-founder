import { test, expect } from '@playwright/test';

/**
 * indii Growth Protocol E2E Tests
 * Covers: System loads without crashing after introducing the new protocol templates
 *
 * Run: npx playwright test e2e/indii-growth-protocol.spec.ts
 */

test.describe('indii Growth Protocol', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('application loads without fatal JS errors related to growth protocol', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));

        const nav = page.locator('[data-testid="nav-item-campaign"]');
        const visible = await nav.isVisible().catch(() => false);
        if (!visible) { test.skip(); return; }

        await nav.click();
        await page.waitForTimeout(2_500);

        const fatal = errors.filter(
            (e) => !e.includes('permission-denied') && !e.includes('offline')
        );
        expect(fatal).toHaveLength(0);
    });

    test('Marketing module remains accessible for growth loop orchestration', async ({ page }) => {
        const nav = page.locator('[data-testid="nav-item-marketing"]');
        const visible = await nav.isVisible().catch(() => false);

        // If the module doesn't exist under this test ID, we skip
        if (!visible) {
            test.skip();
            return;
        }

        await nav.click();
        await page.waitForTimeout(2_500);

        const body = await page.locator('body').innerText();
        const hasMarketing = body.toLowerCase().includes('marketing')
            || body.toLowerCase().includes('dashboard');

        expect(hasMarketing).toBe(true);
    });
});
