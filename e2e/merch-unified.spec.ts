import { test, expect } from '@playwright/test';

test.describe('Unified Merch Studio Persistence', () => {
    test('should verify the Merch Studio unified flow', async ({ page }) => {
        // 1. Navigate to the app first to ensure useStore is available
        await page.goto('http://localhost:4242');

        // 2. Mock the store state directly via evaluate
        // Since we are on localhost:4242 and in DEV mode, window.useStore is exposed
        await page.evaluate(() => {
            const mockUser = { uid: 'test-user-merch', email: 'merch-test@banana.com' };
            const mockProfile = {
                id: 'test-user-merch',
                displayName: 'Merch Tester',
                roles: ['owner'],
                orgId: 'test-org-merch'
            };

            // @ts-ignore
            if (window.useStore) {
                // @ts-ignore
                window.useStore.setState({
                    user: mockUser,
                    userProfile: mockProfile,
                    currentModule: 'merch', // CRITICAL: This determines what App.tsx renders
                    authLoading: false
                });
            }
        });

        // 3. Verify we are on the Merch Dashboard
        const dashboard = page.getByTestId('merch-dashboard-content');
        await expect(dashboard).toBeVisible({ timeout: 20000 });

        // 4. Verify Creative Health widgets
        await expect(page.getByTestId('ripeness-score-title')).toBeVisible();
        await expect(page.getByTestId('peel-performance-title')).toBeVisible();

        // 5. Click "Peel New Design" to enter Designer
        const peelBtn = page.getByRole('button', { name: /Peel New Design/i });
        await expect(peelBtn).toBeVisible();
        await peelBtn.click();

        // 6. Verify Designer is in "Design" mode by default
        await expect(page.getByRole('button', { name: 'Design', exact: true })).toBeVisible();

        // 7. Toggle to "Showroom"
        const showroomBtn = page.getByRole('button', { name: 'Showroom', exact: true });
        await showroomBtn.click();

        // Verify Showroom elements (Scenario Builder components)
        await expect(page.locator('text=The Scenario')).toBeVisible();
        await expect(page.locator('text=Scene Context')).toBeVisible();

        // 8. Verify Generate button exists in Showroom mode
        await expect(page.getByRole('button', { name: /Generate Mockup/i })).toBeVisible();

        // 9. Toggle back to Design mode
        await page.getByRole('button', { name: 'Design', exact: true }).click();

        // Verify Design tools
        await expect(page.locator('text=Stickers')).toBeVisible();
        await expect(page.locator('text=The Scenario')).not.toBeVisible();
    });
});
