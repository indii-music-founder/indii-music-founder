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
        const header = page.locator('h1:has-text("indii")').first();
        await expect(header).toBeVisible({ timeout: 10_000 });

        // Verify the secure cloud relay version is displayed
        const versionLabel = page.locator('text=/secure cloud relay/i').first();
        await expect(versionLabel).toBeVisible({ timeout: 10_000 });
    });

    test('mobile remote renders link code button when disconnected', async ({ authedPage: page }) => {
        await page.goto('/mobile-remote', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#root', { state: 'visible', timeout: 15_000 });

        // When disconnected (mock user has no active desktop state), it should show "Link" or "Pairing" button or qr code trigger
        const linkBtn = page.locator('button:has-text("Link"), button:has-text("Pairing"), button:has-text("Show Pairing Code")').first();
        await expect(linkBtn).toBeVisible({ timeout: 10_000 });
        
        // Tap "Show Pairing Code" or "Link"
        await linkBtn.click();
        
        // Check that the QR code pairing modal opens
        const closeBtn = page.locator('button:has-text("Close")').first();
        await expect(closeBtn).toBeVisible({ timeout: 10_000 });
        
        // Close modal
        await closeBtn.click();
        await expect(closeBtn).not.toBeVisible();
    });
});
