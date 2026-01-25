import { test, expect } from '@playwright/test';

// Viewport's Mobile Spec: History Navigation
// Device: iPhone X (375x812)
const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;

test.describe('📱 Viewport: Mobile History Navigation', () => {
    test.use({
        viewport: { width: MOBILE_WIDTH, height: MOBILE_HEIGHT },
        hasTouch: true,
        isMobile: true
    });

    test.beforeEach(async ({ page, context }) => {
        // 1. Bypass Auth (Test Mode)
        await context.addInitScript(() => {
            localStorage.setItem('TEST_MODE', 'true');
        });

        // 2. Navigate
        await page.goto('/');

        // 3. Handle Login (if needed)
        try {
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 3000 });
        } catch (e) {
            const guestLoginBtn = page.getByText('Guest Login (Dev)');
            if (await guestLoginBtn.isVisible()) {
                await guestLoginBtn.click();
            }
            await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
        }
    });

    test('should allow navigation to History module via mobile menu', async ({ page }) => {
        // 1. Open Mobile Navigation
        const openNavBtn = page.getByLabel('Open Navigation');
        await expect(openNavBtn).toBeVisible();
        await openNavBtn.click();

        // 2. Verify Menu is Open
        const menuHeader = page.getByText('Navigation', { exact: true });
        await expect(menuHeader).toBeVisible();

        // 3. Find History Item
        // This is expected to FAIL initially until we add History to MobileNav.tsx
        const historyBtn = page.getByRole('button', { name: 'History' });
        await expect(historyBtn).toBeVisible();

        // 4. Click History
        await historyBtn.click();

        // 5. Verify Mobile Menu Closed
        await expect(menuHeader).toBeHidden();

        // 6. Verify History View is Active
        // HistoryDashboard renders ConversationHistoryList.
        // We look for a unique element in ConversationHistoryList, e.g., "Conversation History" or a search bar.
        // Assuming ConversationHistoryList has a title or we can check the module state.

        // Checking for a visual indicator of the History module
        // Often History view has a "History" header or similar.
        // Based on HistoryDashboard.tsx, it renders ConversationHistoryList.
        // Let's verify if we can find text "History" or similar that is unique to that view.
        // Or we can check if the 'dashboard' (HQ) is hidden.

        // Let's wait for something likely to be in History
        // ConversationHistoryList has a header "Archives"
        const archivesHeader = page.getByText('Archives', { exact: true });
        await expect(archivesHeader).toBeVisible();
    });
});
