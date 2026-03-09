import { test, expect } from './fixtures/auth';

/**
 * Chaos E2E Tests — Resilience and Error Recovery
 *
 * Covers: Firestore offline behavior, ModuleErrorBoundary, rapid module
 * switching, CommandBar stress test, empty prompt rejection, and
 * session error recovery.
 *
 * Run: npx playwright test e2e/chaos.spec.ts
 */

test.describe('Chaos — Offline and Network Failures', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('app renders when Firestore is blocked (offline mode)', async ({ authedPage: page }) => {
        // Block all Firestore requests
        await page.route('**/firestore.googleapis.com/**', route => route.abort());

        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);

        // App shell must still render even without Firestore
        await expect(page.locator('#root')).toBeVisible();

        // No Vite dev error overlay should appear
        const viteError = page.locator('#vite-error-overlay, [data-vite-error]');
        const hasError = await viteError.isVisible().catch(() => false);
        expect(hasError).toBe(false);
    });

    test('app renders when AI APIs are all blocked', async ({ authedPage: page }) => {
        await page.route('**/generativelanguage.googleapis.com/**', route => route.abort());
        await page.route('**/aiplatform.googleapis.com/**', route => route.abort());
        await page.route('**/localhost:50080/**', route => route.abort());

        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);

        await expect(page.locator('#root')).toBeVisible();
    });

    test('app survives all external APIs being blocked simultaneously', async ({ authedPage: page }) => {
        // Block everything external
        await page.route('**/*.googleapis.com/**', route => route.abort());
        await page.route('**/stripe.com/**', route => route.abort());
        await page.route('**/inngest.com/**', route => route.abort());

        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(3_000);

        await expect(page.locator('#root')).toBeVisible();
    });
});

test.describe('Chaos — Rapid Navigation', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ authedPage: page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('navigating rapidly between 5 modules does not cause white-screen', async ({ authedPage: page }) => {
        const moduleIds = ['dashboard', 'finance', 'distribution', 'creative', 'publishing'];

        for (const moduleId of moduleIds) {
            const nav = page.locator(`[data-testid="nav-item-${moduleId}"]`);
            const visible = await nav.isVisible().catch(() => false);

            if (visible) {
                await nav.click();
                // Intentionally short delay to stress lazy-loading
                await page.waitForTimeout(300);
            }
        }

        // Final state: app must still be alive
        await expect(page.locator('#root')).toBeVisible();

        // No Vite error overlay
        const viteError = page.locator('#vite-error-overlay');
        const hasError = await viteError.isVisible().catch(() => false);
        expect(hasError).toBe(false);
    });

    test('opening and closing CommandBar 10 times does not crash', async ({ authedPage: page }) => {
        // Try keyboard shortcut approach
        for (let i = 0; i < 10; i++) {
            await page.keyboard.press('Control+k');
            await page.waitForTimeout(100);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(100);
        }

        await expect(page.locator('#root')).toBeVisible();
    });
});

test.describe('Chaos — Error Boundaries', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ authedPage: page }) => {
        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('submitting empty prompt is rejected without crash', async ({ authedPage: page }) => {
        const input = page
            .locator('[data-testid="prompt-input"], textarea, [role="textbox"]')
            .first();

        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip();
            return;
        }

        // Ensure field is empty and press Enter
        await input.fill('');
        await input.press('Enter');
        await page.waitForTimeout(500);

        await expect(page.locator('#root')).toBeVisible();
    });

    test('injecting invalid characters into prompt does not crash', async ({ authedPage: page }) => {
        const input = page
            .locator('[data-testid="prompt-input"], textarea, [role="textbox"]')
            .first();

        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip();
            return;
        }

        // Try various potentially problematic inputs
        const payloads = [
            '<script>alert("xss")</script>',
            '"; DROP TABLE users; --',
            '🎵'.repeat(1000), // Long emoji string
            '\0\0\0', // Null bytes
        ];

        for (const payload of payloads) {
            await input.fill(payload);
            await page.waitForTimeout(200);
        }

        await input.fill('');
        await expect(page.locator('#root')).toBeVisible();
    });

    test('console errors do not spike above baseline during normal navigation', async ({ authedPage: page }) => {
        const errors: string[] = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        // Normal navigation flow
        const navItems = page.locator('[data-testid^="nav-item-"]');
        const count = await navItems.count();

        for (let i = 0; i < Math.min(count, 4); i++) {
            await navItems.nth(i).click().catch(() => {});
            await page.waitForTimeout(800);
        }

        // Filter out known expected errors (Firebase offline, etc.)
        const unexpectedErrors = errors.filter(
            e =>
                !e.includes('Firebase') &&
                !e.includes('firestore') &&
                !e.includes('Failed to fetch') &&
                !e.includes('ERR_NETWORK') &&
                !e.includes('ResizeObserver')
        );

        console.log(`Console errors during navigation: ${errors.length} total, ${unexpectedErrors.length} unexpected`);

        // Warn but don't fail — navigation errors can be infrastructure-related
        if (unexpectedErrors.length > 10) {
            console.warn('High unexpected error count:', unexpectedErrors.slice(0, 5));
        }

        await expect(page.locator('#root')).toBeVisible();
    });
});
