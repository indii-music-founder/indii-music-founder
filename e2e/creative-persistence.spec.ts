import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test('Creative Studio Persistence: Upload -> Reload -> Verify', async ({ page }) => {
    // Increase global timeout for this test as reloads are slow
    test.setTimeout(90000);

    // 1. Logic
    await test.step('Login and Navigate to Creative Studio', async () => {
        // Robust Login Logic (Standardized)
        await page.goto('/');

        console.log('[Persistence] Checking login state...');

        // Check for login form or dashboard
        const emailInput = page.getByLabel(/email/i);
        const dashboard = page.getByRole('heading', { name: /STUDIO HQ/i });

        try {
            // Wait for either email input or dashboard
            // Use a shorter timeout for the check, but robust wait for the result
            await expect(emailInput.or(dashboard).first()).toBeVisible({ timeout: 15000 });

            if (await emailInput.isVisible()) {
                console.log('[Persistence] Performing explicit login...');
                await emailInput.fill('automator@indiios.com');
                await page.getByLabel(/password/i).fill('AutomatorPass123!');
                await page.getByRole('button', { name: /sign in/i }).click();
            } else {
                console.log('[Persistence] Already logged in (Dashboard visible).');
            }
        } catch (e) {
            console.log('[Persistence] Login state check failed, likely timed out waiting for UI.');
        }

        // Now dashboard MUST be visible - matching hub-spoke.spec.ts selector
        await expect(dashboard).toBeVisible({ timeout: 30000 });

        // Navigate to Creative Studio via Sidebar
        // Wait for sidebar to be interactive
        const creativeBtn = page.getByRole('button', { name: /Creative Director/i });
        await creativeBtn.waitFor({ state: 'visible', timeout: 10000 });
        await creativeBtn.click();

        await expect(page.getByText('Creative Studio', { exact: false }).first()).toBeVisible({ timeout: 15000 });

        // Ensure we are in Gallery mode or Assets are visible
        // If "Assets & Uploads" isn't visible, we might be in a different mode.
        // Let's try to find a tab to switch to Gallery implies we need to know the UI structure better.
        // For now, let's just list what we see to debug if it fails again.
        try {
            await expect(page.getByText('Assets & Uploads')).toBeVisible({ timeout: 10000 });
        } catch (e) {
            console.log('[Persistence] "Assets & Uploads" not found. Dumping visible headers...');
            const headers = await page.getByRole('heading').allInnerTexts();
            console.log('Headers:', headers);
            throw e;
        }
    });

    // 2. Upload Asset
    const testFileName = 'test-persistence-asset.txt';
    const testFileContent = 'This is assurance that data persists.';
    const testFilePath = path.join(__dirname, testFileName);

    // Create a dummy file
    fs.writeFileSync(testFilePath, testFileContent);

    await test.step('Upload Asset', async () => {
        // Determine which file input to use.
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);

        // Wait for toast or UI update - toast usually says "asset(s) uploaded"
        await expect(page.getByText('asset(s) uploaded')).toBeVisible({ timeout: 10000 });

        // Verify it is in the grid
        const assetCard = page.locator('div', { hasText: testFileName }).first();
        await expect(assetCard).toBeVisible({ timeout: 10000 });
    });

    // 3. Reload Page
    await test.step('Reload and Verify Persistence', async () => {
        console.log('Reloading page...');
        await page.reload();

        // Wait for app to re-initialize - waiting for "Active Projects" is safer than sidebar immediately
        await expect(page.getByText('Active Projects')).toBeVisible({ timeout: 30000 });

        // Navigate back to Creative Studio
        const creativeBtn = page.getByRole('button', { name: /Creative Director/i });
        await creativeBtn.waitFor({ state: 'visible', timeout: 10000 });
        await creativeBtn.click();

        await expect(page.getByText('Creative Studio', { exact: false }).first()).toBeVisible({ timeout: 15000 });

        // Verify asset is still there
        await expect(page.getByText('Assets & Uploads')).toBeVisible();
        await expect(page.getByText(testFileName)).toBeVisible({ timeout: 15000 });
    });

    // Cleanup
    fs.unlinkSync(testFilePath);
});
