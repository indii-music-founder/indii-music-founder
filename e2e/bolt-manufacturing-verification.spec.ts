import { test, expect } from '@playwright/test';

test.describe('Bolt: Manufacturing Panel Verification', () => {
    test.use({ viewport: { width: 1280, height: 720 } }); // Force desktop

    test('should verify the Order Sample flow', async ({ page }) => {
        // Mock canvas export to avoid browser instability
        await page.addInitScript(() => {
            HTMLCanvasElement.prototype.toDataURL = () => {
                return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
            };
        });

        // Listen for console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`BROWSER ERROR: ${msg.text()}`);
            }
        });

        // 1. Navigate to the app
        await page.goto('http://localhost:4242');

        // Clear storage to prevent persistent state issues
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.reload();

        // 2. Inject Merch Store State
        await page.evaluate(() => {
            const mockUser = { uid: 'bolt-tester', email: 'bolt@indii.com' };
             // @ts-expect-error - Checking for exposed store
            if (window.useStore) {
                 // @ts-expect-error - Directly manipulating window store
                window.useStore.setState({
                    user: mockUser,
                    userProfile: { id: 'bolt-tester', displayName: 'Bolt', roles: ['owner'], orgId: 'bolt-org' },
                    currentModule: 'merch',
                    authLoading: false
                });
            }
        });

        // 3. Wait for Merch Dashboard
        await expect(page.getByTestId('merch-dashboard-content')).toBeVisible({ timeout: 15000 });

        // 4. Click "New Design"
        await page.getByTestId('new-design-btn').click();

        // 5. Switch to Showroom
        // The Showroom button triggers an Export Dialog first!

        const showroomBtn = page.getByRole('button', { name: 'Showroom', exact: true });
        await expect(showroomBtn).toBeVisible();
        await showroomBtn.click();

        // Handle Export Dialog
        console.log('Waiting for Export Dialog...');
        const exportHeading = page.getByText('Export Design');
        await expect(exportHeading.first()).toBeVisible();

        // Click Export (yellow button) to proceed to Showroom
        // Note: The button might be labelled "Export" or similar.
        const exportBtn = page.getByRole('button', { name: 'Export', exact: false }).filter({ hasText: 'Export' }).last();
        await expect(exportBtn).toBeVisible();
        await exportBtn.click();

        // Wait for view change (modal closes, view switches)
        await page.waitForTimeout(2000);

        // 6. Verify "Production" column is visible
        // Look for "Production" header in the panel
        // There are multiple "Production" texts (header, button text).
        // The header is inside the panel: <h2 ...>Production</h2>
        await expect(page.getByRole('heading', { name: 'Production', level: 2 }).last()).toBeVisible();

        // 7. Find "Order Sample" button
        const orderSampleBtn = page.getByRole('button', { name: 'Order Sample' });
        await expect(orderSampleBtn).toBeVisible();

        // 8. Click "Order Sample"
        console.log('Clicking Order Sample...');
        await orderSampleBtn.click({ force: true });

        // 9. Verify Success Toast (Skip loading check as it might be too fast)
        // The toast message is "Sample request sent! ID: ..."
        // Or check for error
        try {
            await expect(page.getByText('Sample request sent!')).toBeVisible({ timeout: 10000 });
        } catch (e) {
            // If success not found, look for error toast
            console.log('Success toast not found, checking for errors...');
            await page.screenshot({ path: 'test-results/order_sample_fail.png' });
            const errorToast = page.locator('.toast-viewport').getByText(/Failed|Error/);
            if (await errorToast.isVisible()) {
                console.log('Error Toast Found:', await errorToast.innerText());
            }
            throw e;
        }

        // 11. Verify button resets
        await expect(page.getByRole('button', { name: 'Order Sample' })).toBeVisible();
    });
});
