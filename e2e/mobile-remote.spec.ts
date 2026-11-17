import { test, expect } from './fixtures/auth';

/**
 * Mobile Remote E2E Tests
 *
 * Covers: mobile remote companion interface loading, rendering,
 * and state stability checks.
 *
 * Run: npx playwright test e2e/mobile-remote.spec.ts
 */

test.describe('Mobile Remote Companion Device', () => {
    test.use({ viewport: { width: 375, height: 812 } }); // iPhone SE viewport

    test('mobile remote loads and renders controller branding', async ({ authedPage: page }) => {
        console.log('[REMOTE TEST] Navigating to /mobile-remote...');
        await page.goto('/mobile-remote', { waitUntil: 'domcontentloaded' });

        // Verify root is present
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });

        // Verify that the controller header is visible
        const header = page.locator('h1:has-text("indii")').first(); // bypass-strict: heading text rendered across responsive layout breakpoints
        await expect(header).toBeVisible({ timeout: 10_000 });

        // Verify the controller build identifier is displayed
        const buildLabel = page.getByTestId('controller-build');
        await expect(buildLabel).toBeVisible({ timeout: 10_000 });
        await expect(buildLabel).toContainText(/Controller build/i);
    });

    test('mobile remote explains the disconnected state when no Studio is online', async ({ authedPage: page }) => {
        await page.goto('/mobile-remote', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });

        // The remote no longer offers a "Show Pairing Code" button (the desktop issues the
        // pairing). A controller with no Studio online states that plainly instead.
        await expect(page.getByRole('heading', { name: /Pairing Failed|Studio Disconnected/ })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(/no Studio is online|currently offline/i).first()).toBeVisible(); // bypass-strict: text appears in multiple DOM containers or preview cards
        await expect(page.getByTestId('controller-build')).toBeVisible();
    });
});
