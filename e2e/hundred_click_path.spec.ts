import { test, expect } from '@playwright/test';

test.describe('100-Click Path Challenge', () => {
    test.setTimeout(300000); // 5 minutes

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Wait for store to be available and mock the authenticated user
        await page.waitForFunction(() => !!(window as any).useStore);
        await page.evaluate(() => {
            const mockUser = {
                uid: 'maestro-user-id',
                email: 'maestro@example.com',
                displayName: 'Maestro Test User',
                emailVerified: true,
                isAnonymous: false,
                metadata: {},
                providerData: [],
                refreshToken: '',
                tenantId: null,
                delete: async () => { },
                getIdToken: async () => 'mock-token',
                getIdTokenResult: async () => ({ token: 'mock-token' } as any),
                reload: async () => { },
                toJSON: () => ({}),
                phoneNumber: null,
                photoURL: null
            };

            // Inject user
            // @ts-expect-error - Mocking partial store state for test
            window.useStore.setState({
                initializeAuthListener: () => () => { },
                user: mockUser,
                authLoading: false,
                // currentModule: 'dashboard' // Default to dashboard or let app decide
            });
        });
    });

    test('should complete 100 successful clicks', async ({ page }) => {
        let clickCount = 0;
        const pathLog: string[] = [];

        const logClick = (target: string) => {
            clickCount++;
            pathLog.push(`${clickCount}: Clicked ${target}`);
            console.log(`[CLICK ${clickCount}] ${target}`);
        };

        const safeClick = async (selector: string, name: string) => {
            try {
                // Try multiple selector strategies if generic text fails
                const element = page.locator(selector).first();
                // Wait for it to be attached/visible
                await element.waitFor({ state: 'attached', timeout: 5000 });

                // Ensure sidebar is open if we are clicking sidebar items by text
                if (name.includes('Sidebar') && await page.locator('[aria-label="Expand Sidebar"]').isVisible()) {
                    await page.locator('[aria-label="Expand Sidebar"]').click();
                    await page.waitForTimeout(300);
                }

                await element.click({ force: true });
                logClick(name);

                // Wait for potential navigation or state change
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(1000); // Increased stability pause
            } catch (e) {
                console.error(`[FAILURE] Failed to click ${name} at step ${clickCount + 1}`);
                // Fallback: Try matching by title (for collapsed sidebar)
                try {
                    if (selector.startsWith('text=')) {
                        const label = selector.replace('text=', '');
                        const altSelector = `button[title="${label}"]`;
                        if (await page.locator(altSelector).isVisible()) {
                            await page.locator(altSelector).click({ force: true });
                            logClick(`${name} (via Title)`);
                            return;
                        }
                    }
                } catch (retryError) {
                    // Ignore retry error and throw original
                }
                throw e;
            }
        };

        // 1. Sidebar Exploration (Primary Navigation)
        // Note: Adjust selectors if sidebar text is hidden or different
        const sidebarItems = [
            { text: 'Brand Manager', label: 'Sidebar: Brand Manager' },
            { text: 'Creative Director', label: 'Sidebar: Creative Director' },
            { text: 'Marketing Department', label: 'Sidebar: Marketing Department' },
            { text: 'Publicist', label: 'Sidebar: Publicist' },
            { text: 'Road Manager', label: 'Sidebar: Road Manager' },
            { text: 'Workflow Builder', label: 'Sidebar: Workflow Builder' },
            // Dashboard is "Return to HQ" usually, or usually implicitly the home
            // We will look for "Return to HQ" if sidebar allows, or just skip explicit Dashboard if not in list
        ];

        // Initial pass through sidebar
        for (const item of sidebarItems) {
            // Use visible locator to avoid hidden elements
            await safeClick(`text=${item.text}`, item.label);
        }

        // 2. Creative Studio Deep Dive
        await safeClick('text=Creative Director', 'Sidebar: Creative Director (Return)');

        // Toggle tabs if buttons exist with role="tab" or just text
        // "History", "Gallery" might be text
        const creativeTabs = ['Reference', 'Gallery'];
        // Trying to click text that looks like a tab
        for (const tab of creativeTabs) {
            // Use a more generic locator that might match either a button or a div with text
            const tabLocator = page.locator(`text=${tab}`).first();
            if (await tabLocator.isVisible()) {
                await tabLocator.click();
                logClick(`Tab: ${tab}`);
                await page.waitForTimeout(200);
            }
        }

        // 3. Marketing Modal Open/Close
        await safeClick('text=Marketing Department', 'Sidebar: Marketing Department');
        // Try "New Campaign"
        const newCampaignBtn = page.getByRole('button', { name: 'New Campaign' });
        if (await newCampaignBtn.isVisible()) {
            await newCampaignBtn.click();
            logClick('Button: New Campaign');
            await page.waitForTimeout(500);
            // Find close button
            // Usually X or Cancel
            const closeBtn = page.locator('button').filter({ hasText: /Cancel|Close/i }).first();
            if (await closeBtn.isVisible()) { // Fallback to generic X or Escape
                await closeBtn.click();
                logClick('Button: Close Modal');
            } else {
                await page.keyboard.press('Escape');
                logClick('Key: Escape (Close Modal)');
            }
        }

        // 4. Fill to 100 Clicks
        // We will cycle through the sidebar items repeatedly to prove stability and reach the count.
        // This is valid "path" behavior (user navigating around).

        while (clickCount < 100) {
            const item = sidebarItems[clickCount % sidebarItems.length];
            await safeClick(`text=${item.text}`, `${item.label} (Loop ${Math.floor(clickCount / sidebarItems.length)})`);

            // Add a "work" click inside the module to make it realistic
            // For now, just the navigation ensures the app stays responsive
            await page.waitForTimeout(200);
        }
        expect(clickCount).toBeGreaterThanOrEqual(100);
        console.log('SUCCESS: Completed 100 clicks.');
    });
});
