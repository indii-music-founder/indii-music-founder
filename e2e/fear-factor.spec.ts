import { test, expect } from '@playwright/test';

const BASE_URL = 'https://architexture-ai-studio.web.app';

test.describe('Fear Factor: Extreme Chaos Testing', () => {

    test.beforeEach(async ({ page }) => {
        // Console listener for debugging chaos
        page.on('console', msg => console.log('CHAOS:', msg.text()));
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');
    });

    test('Scenario 1: "The Network Nightmare" (Simulated Flakiness)', async ({ page }) => {
        // Introducing artificial chaos to network requests
        await page.route('**/*', async (route) => {
            const r = Math.random();
            const url = route.request().url();

            // 20% chance to fail API calls (excluding static assets to keep UI visible)
            if (url.includes('/api/') || url.includes('cloudfunctions') || url.includes('firestore')) {
                if (r < 0.2) {
                    console.log(`[Nightmare] Aborting request to: ${url}`);
                    await route.abort('failed');
                    return;
                }
                // 30% chance of extreme latency (1-3 seconds)
                if (r > 0.2 && r < 0.5) {
                    console.log(`[Nightmare] Delaying request to: ${url}`);
                    await new Promise(f => setTimeout(f, 1000 + Math.random() * 2000));
                }
            }
            await route.continue();
        });

        // Try to perform a standard flow WITH this chaos active
        console.log('[Nightmare] Attempting Navigation...');
        await page.getByRole('button', { name: /new project/i }).first().click({ timeout: 5000 }).catch(() => console.log('Click failed due to chaos (expected)'));

        // Resilience Check: App should not crash to white screen
        // It might show error toasts, but the Sidear/Nav should remain
        // We check for "Manager's Office" which is a static header in the Sidebar
        await expect(page.getByText("Manager's Office").first()).toBeVisible();
        await expect(page.getByText('Something went wrong')).not.toBeVisible();
        console.log('[Nightmare] App survived initial component checks.');
    });

    test('Scenario 2: "The Click Frenzy" (Monkey Testing)', async ({ page }) => {
        // Navigate to a complex page (Creative Studio)
        // If we can't create a project easily, just go to Dashboard
        await expect(page.locator('body')).toBeVisible();

        console.log('[Frenzy] Unleashing random inputs...');

        // Perform 50 random clicks in 5 seconds
        for (let i = 0; i < 50; i++) {
            const x = Math.floor(Math.random() * 800);
            const y = Math.floor(Math.random() * 600);

            // Randomly click, hover, or type
            const action = Math.random();
            try {
                if (action < 0.8) {
                    await page.mouse.click(x, y);
                } else {
                    await page.mouse.move(x, y);
                }
            } catch (e) {
                // Ignore click errors (clicking on unclickable things)
            }

            // Mild delay to allow event loop to process
            await page.waitForTimeout(50);
        }

        // Verification: App is still alive
        await expect(page.locator('body')).toBeVisible();
        console.log('[Frenzy] App survived manual chaos.');
    });

});
