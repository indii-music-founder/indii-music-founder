
import { test, expect } from '@playwright/test';

const STUDIO_URL = process.env.STUDIO_URL || 'http://localhost:4242';
const E2E_EMAIL = process.env.E2E_EMAIL || 'automator@indiios.com';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'AutomatorPass123!';

test.describe('Flow: Navigation & Deep Linking', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Set TEST_MODE to bypass Firebase Auth if needed, but existing E2E uses real login.
        // Let's stick to real login for now, but handle the case where we are already logged in.

        await page.goto(STUDIO_URL);

        // Wait for potential auto-login or login form
        try {
            await page.waitForLoadState('networkidle', { timeout: 10000 });
        } catch (e) {
            console.log('Network idle timeout, proceeding...');
        }

        const heading = page.getByRole('heading', { name: /STUDIO HQ/i });
        const loginButton = page.getByRole('button', { name: /sign in/i });

        if (await loginButton.isVisible()) {
            console.log('Logging in...');
            await page.getByLabel(/email/i).fill(E2E_EMAIL);
            await page.getByLabel(/password/i).fill(E2E_PASSWORD);
            await loginButton.click();
        }

        await expect(heading).toBeVisible({ timeout: 30000 });
        console.log('Logged in and at Dashboard.');
    });

    test('URL should update when navigating via sidebar', async ({ page }) => {
        // Sidebar is a div with class containing 'bg-[#0d1117]' or 'z-sidebar'
        await expect(page.locator('.z-sidebar')).toBeVisible();

        // Navigate to Creative Studio
        const creativeBtn = page.getByRole('button', { name: 'Creative Director' });
        await expect(creativeBtn).toBeVisible();
        await creativeBtn.click();

        // Verify URL updated - allow some time for state reflection
        await expect(page).toHaveURL(/.*\/creative/, { timeout: 15000 });

        // Now verify ANY creative content is visible
        // Try locating the prompt input "Describe the action or context..."
        await expect(page.getByPlaceholder('Describe the action or context...')).toBeVisible({ timeout: 20000 });

        // Navigate back to Dashboard via "Return to HQ" or equivalent
        const returnBtn = page.getByRole('button', { name: 'Return to HQ' });
        if (await returnBtn.isVisible()) {
             await returnBtn.click();
             await expect(page).toHaveURL(/.*\/dashboard/);
        } else {
             // Fallback: Click logo or use sidebar Dashboard link if available
             // Since we verified Back/Forward works, we can also use that,
             // but let's test explicit navigation if possible.
             // If "Return to HQ" isn't found (sidebar collapsed/hidden?), we try going to dashboard directly
             // But let's try to expand sidebar if needed? No, test assumes desktop (default viewport).

             // Try clicking Dashboard via Sidebar (if available, likely hidden/replaced by Return to HQ in sidebar header)
             // The Sidebar.tsx shows "Return to HQ" button in header if isSidebarOpen.
             // If we are in 'creative', isSidebarOpen might be false or true?
             // App.tsx: isRightPanelOpen: module === 'creative' || module === 'video'
             // Doesn't affect Sidebar open state, but `showChrome` might.
             // Creative Studio is NOT in STANDALONE_MODULES, so Chrome (Sidebar) is shown.

             console.log('Return to HQ button not found, checking sidebar state...');
        }
    });

    test('Deep linking should load correct module', async ({ page }) => {
        console.log('Testing Deep Link to /marketing');
        // Navigate directly to /marketing
        await page.goto(`${STUDIO_URL}/marketing`);

        // Verify Marketing Dashboard loaded
        await expect(page.getByRole('heading', { name: 'Marketing Dashboard' })).toBeVisible({ timeout: 30000 });

        // Verify URL persists
        await expect(page).toHaveURL(/.*\/marketing/);
    });

    test('Browser Back/Forward buttons should work', async ({ page }) => {
        // 1. Start at Dashboard.
        // Note: App.tsx now replaces '' with '/dashboard', so we expect that.
        await expect(page).toHaveURL(/.*\/dashboard/);

        // 2. Go to Video Studio
        console.log('Navigating to Video...');
        await page.getByRole('button', { name: 'Video Producer' }).click();
        await expect(page).toHaveURL(/.*\/video/);
        await expect(page.getByText('Video Studio')).toBeVisible();

        // 3. Go to Marketing (using sidebar to ensure distinct history entry)
        console.log('Navigating to Marketing...');
        await page.getByRole('button', { name: 'Marketing Department' }).click();
        await expect(page).toHaveURL(/.*\/marketing/);
        await expect(page.getByRole('heading', { name: 'Marketing Dashboard' })).toBeVisible();

        // 4. Hit Back -> Should be Video
        console.log('Going Back (should be Video)...');
        await page.goBack();
        await expect(page).toHaveURL(/.*\/video/);
        await expect(page.getByText('Video Studio')).toBeVisible();

        // 5. Hit Back -> Should be Dashboard
        console.log('Going Back (should be Dashboard)...');
        await page.goBack();
        await expect(page).toHaveURL(/.*\/dashboard/);
        await expect(page.getByRole('heading', { name: /STUDIO HQ/i })).toBeVisible();

        // 6. Hit Forward -> Should be Video
        console.log('Going Forward (should be Video)...');
        await page.goForward();
        await expect(page).toHaveURL(/.*\/video/);
    });
});
