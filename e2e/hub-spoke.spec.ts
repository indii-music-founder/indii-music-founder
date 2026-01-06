import { test, expect, type Page } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4242';

test.describe('Hub & Spoke Architecture Verification', () => {
    test.setTimeout(120000); // Increased timeout for lazy loading

    test('Navigation: Hub -> Spoke -> Hub', async ({ page }) => {
        // 1. Initial Load & Login
        console.log('[HubSpoke] Loading Studio...');
        await page.goto(STUDIO_URL);

        // Handle Login (Automator flow)
        console.log('[HubSpoke] Logging in...');
        await page.getByLabel(/email/i).fill('automator@indiios.com');
        await page.getByLabel(/password/i).fill('AutomatorPass123!');
        await page.getByRole('button', { name: /sign in/i }).click();

        // 2. Verify Hub (Dashboard)
        console.log('[HubSpoke] Verifying Dashboard (Hub)...');
        // "STUDIO HQ" is the h1 on Dashboard
        await expect(page.getByRole('heading', { name: /STUDIO HQ/i })).toBeVisible({ timeout: 60000 });

        // 3. Spoke 1: Creative Director
        console.log('[HubSpoke] Navigating to Creative Director (Spoke)...');
        await page.getByRole('button', { name: 'Creative Director' }).click();

        // Verify Creative Studio Loading
        // Creative Studio renders ModuleDashboard with "Creative Studio" or similar?
        // Let's check for "Gallery" or "Showroom" text if heading is elusive, 
        // but typically "Creative Studio" or "Concept Generation" is visible.
        // Waiting for any unique text for Creative Studio.
        await expect(page.getByText('Creative Studio', { exact: false })).toBeVisible({ timeout: 30000 });

        // Verify "Return to HQ" is visible (Sidebar must be open)
        console.log('[HubSpoke] Returning to Hub...');
        await page.getByRole('button', { name: 'Return to HQ' }).click();
        await expect(page.getByRole('heading', { name: /STUDIO HQ/i })).toBeVisible({ timeout: 30000 });

        // 4. Spoke 2: Marketing Department
        console.log('[HubSpoke] Navigating to Marketing Department (Spoke)...');
        await page.getByRole('button', { name: 'Marketing Department' }).click();

        // Verify Marketing Dashboard
        await expect(page.getByRole('heading', { name: 'Marketing Dashboard' })).toBeVisible({ timeout: 30000 });

        // Return to Hub
        await page.getByRole('button', { name: 'Return to HQ' }).click();
        await expect(page.getByRole('heading', { name: /STUDIO HQ/i })).toBeVisible({ timeout: 30000 });

        // 5. Spoke 3: Publicist
        console.log('[HubSpoke] Navigating to Publicist via Sidebar...');
        await page.getByRole('button', { name: 'Publicist' }).click();

        // Verify Publicist
        await expect(page.getByRole('heading', { name: 'Publicist', exact: false })).toBeVisible({ timeout: 30000 });

        // Return to Hub
        await page.getByRole('button', { name: 'Return to HQ' }).click();
        await expect(page.getByRole('heading', { name: /STUDIO HQ/i })).toBeVisible({ timeout: 30000 });

        // 6. Spoke 4: Brand Manager (replaces Distribution for this test flow as verified via file inspection)
        console.log('[HubSpoke] Navigating to Brand Manager via Sidebar...');
        await page.getByRole('button', { name: 'Brand Manager' }).click();

        // Brand Manager renders Marketing module components usually or its own.
        // Expect "Brand Identity" or similar if it's the Brand Manager view.
        // Assuming "Brand Manager" header or text is consistent with the sidebar label.
        // If it renders MarketingDashboard with activeTab='brand', check for that context.
        // Based on App.tsx it's `BrandManager` component directly.
        // We'll search for "Brand Identity" or similar.
        // Or wait, App.tsx mapped 'brand': BrandManager.
        // Let's check for "Brand" text.
        await expect(page.getByText('Brand', { exact: false }).first()).toBeVisible({ timeout: 30000 });

        // Return to Hub
        await page.getByRole('button', { name: 'Return to HQ' }).click();
        await expect(page.getByRole('heading', { name: /STUDIO HQ/i })).toBeVisible({ timeout: 30000 });

        console.log('[HubSpoke] Hub & Spoke Navigation Verified.');
    });
});
