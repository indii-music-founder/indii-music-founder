import { type Page, expect } from '@playwright/test';

// --- Test Configuration ---
const STUDIO_URL = 'http://localhost:4242'; // Assuming the studio runs here
const TEST_USER_EMAIL = 'the.walking.agency.det@gmail.com'; // Use a dedicated test user
const TEST_USER_PASSWORD = 'qwertyuiop';

export async function login(page: Page) {
    console.log('[E2E-AUTH] Logging in...');
    await page.goto(STUDIO_URL);

    // Check if already logged in by looking for a dashboard element
    const dashboardHeader = page.getByRole('heading', { name: /Studio Headquarters|Welcome back/i });
    if (await dashboardHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('[E2E-AUTH] Already logged in. Proceeding.');
        return;
    }

    // If not logged in, perform login
    await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_USER_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(dashboardHeader).toBeVisible({ timeout: 30000 });
    console.log('[E2E-AUTH] Login successful.');
}