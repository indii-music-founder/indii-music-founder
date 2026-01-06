import { test, expect } from '@playwright/test';

test.describe('Unified Merch Studio Persistence', () => {
    test('should verify the Merch Studio unified flow', async ({ page }) => {
        // 1. Initial load
        await page.goto('/');

        // 2. Setup robust auth and profile bypass
        const mockUser = {
            uid: 'test-user-merch',
            email: 'merch-test@banana.com'
        };

        const mockProfile = {
            id: 'test-user-merch',
            name: 'Merch Tester',
            roles: ['owner'],
            orgId: 'test-org-merch'
        };

        await page.evaluate(({ user, profile }) => {
            // @ts-ignore
            if (window.useStore) {
                // @ts-ignore
                window.useStore.setState({
                    initializeAuthListener: () => () => { },
                    user: user,
                    userProfile: profile,
                    authLoading: false,
                    isAuthorized: true
                });
            }
        }, { user: mockUser, profile: mockProfile });

        // 3. Navigate via internal router push to preserve store state
        await page.evaluate(() => {
            window.history.pushState({}, '', '/merchandise');
            window.dispatchEvent(new PopStateEvent('popstate'));
        });

        // 4. Check for Creative Health widgets (Ripeness Score is in an H3)
        await expect(page.locator('h3:has-text("Ripeness Score")')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('h3:has-text("Peel Performance")')).toBeVisible();

        // 5. Click "Peel New Design" to enter Designer
        const peelBtn = page.locator('button:has-text("Peel New Design")');
        // If not found, try locator by text directly
        const btn = (await peelBtn.count() > 0) ? peelBtn : page.locator('text=Peel New Design');
        await expect(btn).toBeVisible();
        await btn.click();

        // 6. Verify Designer is in "Design" mode by default
        // The button label is "Design" with specific classes when active
        await expect(page.locator('button:has-text("Design")')).toBeVisible();

        // 7. Toggle to "Showroom"
        const showroomBtn = page.locator('button:has-text("Showroom")');
        await showroomBtn.click();

        // Verify Showroom elements
        await expect(page.locator('text=The Scenario')).toBeVisible();
        await expect(page.locator('text=Scene Context')).toBeVisible();

        // 8. Verify Generate button exists 
        await expect(page.locator('button:has-text("Generate Mockup")')).toBeVisible();

        // 9. Toggle back to Design mode
        await page.click('button:has-text("Design")');
        await expect(page.locator('text=Stickers')).toBeVisible();
        await expect(page.locator('text=The Scenario')).not.toBeVisible();
    });
});
