import { test, expect } from './fixtures/auth';

test.describe('Founders Program Flow', () => {

    test.beforeEach(async ({ context }) => {
        // Mock onboarding states to prevent blocking overlays
        await context.addInitScript(() => {
            window.localStorage.setItem('TOUR_COMPLETED_dashboard', 'true');
            window.localStorage.setItem('INDII_ONBOARDING_COMPLETE', 'true');
            window.localStorage.setItem('cookie-consent', '{"analytics":false,"marketing":false}');
        });
    });

    test('should render the manual payment instructions on founders-checkout', async ({ authedPage: page }) => {
        await page.goto('/founders-checkout', { waitUntil: 'domcontentloaded' });

        // Verify the heading is visible
        const checkoutHeading = page.locator('h1:has-text("Back The")');
        await expect(checkoutHeading).toBeVisible();

        // Check for direct funding sections
        await expect(page.locator('h3:has-text("Cash App")')).toBeVisible();
        await expect(page.locator('h3:has-text("Wire Transfer")')).toBeVisible();
        await expect(page.locator('h3:has-text("Physical Check")')).toBeVisible();

        // Check for the investment price info
        await expect(page.locator('text=Investment Price: $2,500.00 USD')).toBeVisible();
    });

    test('should show Access Denied in the Founders Portal for non-founders', async ({ authedPage: page }) => {
        // Navigate directly to the portal to avoid SPA router sync issues
        await page.goto('/founders-portal', { waitUntil: 'domcontentloaded' });

        // Wait for store initialization
        await page.waitForFunction(() => (window as any).useStore !== undefined);

        // Set user to regular tier
        await page.evaluate(() => {
            if ((window as any).useStore) {
                (window as any).useStore.setState({
                    userProfile: {
                        id: 'test-user',
                        email: 'test@example.com',
                        subscriptionTier: 'free',
                        tier: 'free',
                        isFounder: false,
                        updatedAt: new Date(Date.now() + 10000000).toISOString()
                    }
                });
            }
        });

        // Verify Access Denied is shown
        const deniedHeading = page.locator('h2:has-text("Access Denied")');
        await expect(deniedHeading).toBeVisible();

        // Verify "Become a Founder" button is present
        const becomeFounderButton = page.locator('button:has-text("Become a Founder")');
        await expect(becomeFounderButton).toBeVisible();
    });

    test('should render platform download options for verified founders', async ({ authedPage: page }) => {
        // Navigate directly to the portal to avoid SPA router sync issues
        await page.goto('/founders-portal', { waitUntil: 'domcontentloaded' });

        // Wait for store initialization
        await page.waitForFunction(() => (window as any).useStore !== undefined);

        // Set user to founder tier
        await page.evaluate(() => {
            if ((window as any).useStore) {
                (window as any).useStore.setState({
                    userProfile: {
                        id: 'test-founder',
                        email: 'founder@example.com',
                        subscriptionTier: 'founder',
                        tier: 'founder',
                        isFounder: true,
                        updatedAt: new Date(Date.now() + 10000000).toISOString()
                    }
                });
            }
        });

        // Verify headings
        await expect(page.locator('h1:has-text("Download")')).toBeVisible();

        // Verify platform download panels
        await expect(page.locator('h3:has-text("macOS")')).toBeVisible();
        await expect(page.locator('h3:has-text("Windows")')).toBeVisible();

        // Verify download buttons
        await expect(page.locator('button:has-text("Download .dmg")')).toBeVisible();
        await expect(page.locator('button:has-text("Download .exe")')).toBeVisible();
    });
});
