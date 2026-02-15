import { test, expect } from '@playwright/test';

// Mock state injector
const injectMockState = async (page: any) => {
    await page.evaluate(() => {
        const mockUser = {
            uid: 'maestro-user-id',
            email: 'maestro@example.com',
            displayName: 'Maestro Test User',
            emailVerified: true,
            isAnonymous: false,
            // ... other props
            getIdToken: async () => 'mock-token',
            getIdTokenResult: async () => ({ token: 'mock-token' } as any),
        };

        if ((window as any).useStore) {
            window.useStore.setState({
                user: mockUser,
                userProfile: {
                    uid: 'maestro-user-id',
                    role: 'admin',
                    onboardingStatus: 'completed',
                    preferences: { theme: 'dark' }
                },
                authLoading: false,
                isSidebarOpen: true,
                currentModule: 'dashboard',
            });
        }
    });
};

test.describe('Dual-View Image Debug', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Enable console logging from browser
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

        await page.goto('http://localhost:4242/');
        await injectMockState(page);
    });

    test('Debug Navigation', async ({ page }) => {
        console.log('--- Debug: Navigating to Video ---');
        await page.click('[data-testid="nav-item-video"]');

        // Check if director-view-btn appears (part of video navbar)
        try {
            await expect(page.locator('[data-testid="director-view-btn"]')).toBeVisible({ timeout: 10000 });
            console.log('SUCCESS: Video Module Loaded');
        } catch (e) {
            console.log('FAIL: Video Module Not Loaded');
            // Dump HTML
            const body = await page.innerHTML('body');
            console.log('BODY HTML:', body.slice(0, 1000)); // First 1k chars
        }

        console.log('--- Debug: Navigating to Creative ---');
        await page.click('[data-testid="nav-item-creative"]');

        try {
            await expect(page.locator('[data-testid="creative-navbar"]')).toBeVisible({ timeout: 10000 });
            console.log('SUCCESS: Creative Module Loaded');
        } catch (e) {
            console.log('FAIL: Creative Module Not Loaded');
            const body = await page.innerHTML('body');
            console.log('BODY HTML on fail:', body.slice(0, 2000));
        }
    });
});
