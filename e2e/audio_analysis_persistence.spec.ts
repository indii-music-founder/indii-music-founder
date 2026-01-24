import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Audio Analysis Persistence', () => {
    test.setTimeout(120000);
    let testUserId: string;

    test.beforeEach(async ({ page, context }) => {
        testUserId = `persistence-test-${Date.now()}`;
        // Clear all storage for a clean slate
        await context.clearCookies();

        // Nuking all browser storage to prevent Firebase persistence leaks
        await page.addInitScript(() => {
            window.localStorage.clear();
            window.sessionStorage.clear();
            // Try to clear IndexedDB as well (where Firebase stores cache)
            if (window.indexedDB) {
                window.indexedDB.databases().then(dbs => {
                    dbs.forEach(db => {
                        if (db.name) window.indexedDB.deleteDatabase(db.name);
                    });
                });
            }
        });

        // Initialize mock library in the browser
        await page.addInitScript(() => {
            (window as any).__MOCK_LIBRARY__ = {};
        });

        // Forward console logs to Playwright
        page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

        await page.goto('http://localhost:4242/');

        // Mock user injection (Just for store, bypass Firestore via __MOCK_LIBRARY__)
        await page.evaluate((userId) => {
            const mockUser = { uid: userId, email: 'test@example.com' };
            // @ts-expect-error - Store access
            if (window.useStore) {
                // @ts-expect-error - Mocking store
                window.useStore.setState({
                    user: mockUser,
                    userProfile: { id: userId, role: 'admin', onboardingStatus: 'completed' },
                    authLoading: false
                });
            }
        }, testUserId);
    });

    test('should cache analysis results and show CACHED badge on re-upload', async ({ page }) => {
        // 1. Navigate to Lab Console
        await page.locator('[data-testid="nav-item-audio-analyzer"]').click();

        // 2. Upload Audio File for the first time
        const filePath = path.resolve(process.cwd(), 'sample-6s.mp3');
        const fileInput = page.locator('[data-testid="import-track-input"]');
        await fileInput.setInputFiles(filePath);

        // 3. Wait for analysis to complete
        console.log("Starting initial analysis...");
        await expect(page.locator('[data-testid="bpm-stat"]')).not.toContainText('--', { timeout: 30000 });

        // Ensure NOT cached initially
        const cachedBadge = page.locator('text=CACHED');
        await expect(cachedBadge).not.toBeVisible();

        // Capture the state from __MOCK_LIBRARY__ to persist across reload
        const mockState = await page.evaluate(() => (window as any).__MOCK_LIBRARY__);
        console.log("Captured Mock Library State Keys:", Object.keys(mockState));

        // 4. Reload the page
        console.log("Reloading page to test persistence...");
        await page.reload();

        // Re-inject user AND persistent mock state
        await page.evaluate(({ userId, savedState }) => {
            const mockUser = { uid: userId };
            (window as any).__MOCK_LIBRARY__ = savedState;
            // @ts-expect-error - Store access
            if (window.useStore) {
                // @ts-expect-error - Mocking store
                window.useStore.setState({
                    user: mockUser,
                    userProfile: { id: userId, role: 'admin', onboardingStatus: 'completed' },
                    authLoading: false
                });
            }
        }, { userId: testUserId, savedState: mockState });

        // 5. Navigate back to Analyzer
        await page.locator('[data-testid="nav-item-audio-analyzer"]').click();

        // 6. Re-upload the same file
        console.log("Re-uploading same file...");
        await fileInput.setInputFiles(filePath);

        // 7. Verify CACHED badge appears quickly
        console.log("Checking for CACHED badge...");
        await expect(page.locator('text=CACHED')).toBeVisible({ timeout: 10000 });

        // Verify stats are restored
        await expect(page.locator('[data-testid="bpm-stat"]')).not.toContainText('--');

        console.log("Persistence test passed!");
    });
});
