
import { test, expect } from '@playwright/test';

/**
 * FLOW - Navigation & Routing Integrity
 * Mission: Verify the URL is the single source of truth and navigation history works.
 */

const STUDIO_URL = process.env.STUDIO_URL || 'http://localhost:4242';
const E2E_EMAIL = process.env.E2E_EMAIL || 'automator@indiios.com';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'AutomatorPass123!';

test.describe('Flow: Routing & Navigation', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Shared login logic
        await page.goto(STUDIO_URL);
        const loginButton = page.getByRole('button', { name: /sign in/i });
        if (await loginButton.isVisible()) {
            await page.getByLabel(/email/i).fill(E2E_EMAIL);
            await page.getByLabel(/password/i).fill(E2E_PASSWORD);
            await loginButton.click();
        }
        await expect(page.getByRole('heading', { name: /STUDIO HQ/i })).toBeVisible({ timeout: 30000 });
    });

    test('URL Sync: Sidebar navigation updates URL', async ({ page }) => {
        // Initial state should be dashboard (likely / or /dashboard)
        // We will assert loosely first as we are establishing the baseline

        // 1. Navigate to Brand Manager
        console.log('Navigating to Brand Manager...');
        await page.getByRole('button', { name: 'Brand Manager', exact: true }).click();

        // UI Check
        await expect(page.getByText('Brand Guidelines')).toBeVisible();

        // URL Check - This is the Critical Flow Requirement
        // Expect URL to contain /brand
        expect(page.url()).toContain('/brand');

        // 2. Navigate to Creative Director
        console.log('Navigating to Creative Director...');
        await page.getByRole('button', { name: 'Creative Director', exact: true }).click();

        // UI Check
        await expect(page.getByText('Creative Studio')).toBeVisible();

        // URL Check
        expect(page.url()).toContain('/creative');
    });

    test('History: Back button restores state', async ({ page }) => {
        // 1. Go to Marketing
        await page.getByRole('button', { name: 'Marketing Department', exact: true }).click();
        await expect(page.getByText('Marketing Dashboard')).toBeVisible();
        const marketingUrl = page.url();
        expect(marketingUrl).toContain('/marketing');

        // 2. Go to Music
        await page.getByRole('button', { name: 'Music Department', exact: true }).click();
        await expect(page.getByText('Music Studio')).toBeVisible();
        expect(page.url()).toContain('/music');

        // 3. Click Browser Back
        console.log('Clicking Browser Back...');
        await page.goBack();

        // 4. Verify we are back at Marketing
        await expect(page.getByText('Marketing Dashboard')).toBeVisible();
        expect(page.url()).toContain('/marketing');
    });

    test('Deep Link: Direct access loads correct module', async ({ page }) => {
        // We need to reload the page or open a new context to test deep linking
        // Let's try navigating directly
        const targetUrl = `${STUDIO_URL}/legal`;
        console.log(`Deep linking to: ${targetUrl}`);

        await page.goto(targetUrl);

        // Should bypass dashboard and go straight to Legal
        // Note: Login might persist via cookies/storage
        await expect(page.getByText('Legal Dashboard')).toBeVisible({ timeout: 20000 });
    });
});
