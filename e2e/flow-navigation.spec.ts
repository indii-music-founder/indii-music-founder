import { test, expect } from '@playwright/test';

/**
 * FLOW - Navigation & Routing Integrity
 * Mission: Verify the URL is the single source of truth and navigation history works.
 */

// We default to the relative path as required by boundaries ("Never do: Hardcode full domains").
// The baseURL is configured in playwright.config.ts (http://localhost:4242).
const E2E_EMAIL = process.env.E2E_EMAIL || 'automator@indiios.com';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'AutomatorPass123!';

test.describe('Flow: Routing & Navigation', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Shared login logic
        await page.goto('/');

        // Check for Guest Login first (Dev mode)
        const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await guestLoginBtn.isVisible()) {
            await guestLoginBtn.click();
        } else {
            // Fallback to standard login
            const loginButton = page.getByRole('button', { name: /sign in/i });
            if (await loginButton.isVisible()) {
                await page.getByLabel(/email/i).fill(E2E_EMAIL);
                await page.getByLabel(/password/i).fill(E2E_PASSWORD);
                await loginButton.click();
            }
        }

        // Wait for dashboard or any module to load
        // "Agent Workspace" is the default dashboard view
        await expect(page.getByText('Agent Workspace')).toBeVisible({ timeout: 30000 });
    });

    test('URL Sync: Sidebar navigation updates URL', async ({ page }) => {
        // 1. Navigate to Brand Manager
        console.log('Navigating to Brand Manager...');
        await page.getByTestId('nav-item-brand').click();

        // UI Check - Updated to match actual UI (BRAND HQ)
        await expect(page.getByText('BRAND HQ')).toBeVisible();

        // URL Check
        expect(page.url()).toContain('/brand');

        // 2. Navigate to Creative Director
        console.log('Navigating to Creative Director...');
        await page.getByTestId('nav-item-creative').click();

        // UI Check - Creative Director uses "Creative Director" header in the screenshot and "CreativeNavbar"
        // The navbar has "Creative Director" text.
        await expect(page.getByText('Creative Director', { exact: false }).first()).toBeVisible();

        // URL Check
        expect(page.url()).toContain('/creative');
    });

    test('History: Back and Forward buttons restore state', async ({ page }) => {
        // 1. Go to Marketing
        await page.getByTestId('nav-item-marketing').click();
        await expect(page.getByText('Marketing Department', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/marketing');

        // 2. Go to Social Media
        await page.getByTestId('nav-item-social').click();
        await expect(page.getByText('Social Media', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/social');

        // 3. Click Browser Back
        console.log('Clicking Browser Back...');
        await page.goBack();

        // 4. Verify we are back at Marketing
        await expect(page.getByText('Marketing Department', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/marketing');

        // 5. Click Browser Forward
        console.log('Clicking Browser Forward...');
        await page.goForward();

        // 6. Verify we are back at Social Media
        await expect(page.getByText('Social Media', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/social');
    });

    test('Deep Link: Direct access loads correct module', async ({ page, context }) => {
        // Create a new context to simulate a fresh user session (not logged in)
        // We do this to verify the "Redirect to Login -> Login -> Redirect to Target" flow
        await context.clearCookies();
        const newPage = await context.newPage();

        console.log('Deep linking to: /legal');
        await newPage.goto('/legal');

        // Expect Login Page
        const guestLoginBtn = newPage.getByRole('button', { name: /Guest Login/i });
        await expect(guestLoginBtn).toBeVisible();

        // Login
        await guestLoginBtn.click();

        // Should redirect BACK to /legal
        // Check for Legal Dashboard
        await expect(newPage.getByText('Legal Dashboard', { exact: false })).toBeVisible({ timeout: 20000 });
        expect(newPage.url()).toContain('/legal');
    });

    test('Deep Link: Sub-path preservation', async ({ page, context }) => {
        // Similar strategy for sub-path
        await context.clearCookies();
        const newPage = await context.newPage();

        console.log('Deep linking to sub-path: /creative/project-123');
        await newPage.goto('/creative/project-123');

        // Expect Login Page
        const guestLoginBtn = newPage.getByRole('button', { name: /Guest Login/i });
        await expect(guestLoginBtn).toBeVisible();

        // Login
        await guestLoginBtn.click();

        // Should load Creative Studio (checking for "Creative Director" text in navbar)
        await expect(newPage.getByText('Creative Director', { exact: false }).first()).toBeVisible({ timeout: 20000 });

        // URL should NOT revert to /creative or /
        expect(newPage.url()).toContain('/creative/project-123');
    });

    test('Integrity: Invalid Route redirects to Dashboard', async ({ page }) => {
        // For this test, we use the already logged-in session from beforeEach

        const invalidUrl = '/non-existent-module-xyz';
        console.log(`Navigating to invalid route: ${invalidUrl}`);

        // We use page.goto here, which might trigger a reload.
        // IF reload loses auth, we end up at login.
        // IF we end up at login, we log in, and THEN where do we go?
        // Ideally Dashboard (because route invalid).

        // Let's use client-side navigation if possible to test the ROUTER config first.
        // But page.goto is the real test of "entering an invalid URL".

        // Since we know reload wipes auth in this env:
        // 1. Goto Invalid URL
        // 2. See Login
        // 3. Login
        // 4. See Dashboard (Redirect from Invalid URL -> Login -> Dashboard/Home)

        await page.goto(invalidUrl);

        const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await guestLoginBtn.isVisible()) {
            await guestLoginBtn.click();
        }

        // Should redirect to Dashboard (/)
        await expect(page.getByText('Agent Workspace')).toBeVisible();

        // URL should be cleaned up
        const url = new URL(page.url());
        expect(url.pathname).toBe('/');
    });

    test('Active State: Sidebar highlights current module', async ({ page }) => {
        // Navigate to Marketing
        await page.getByTestId('nav-item-marketing').click();

        // Check if marketing button is active using robust accessibility attribute
        const marketingBtn = page.getByTestId('nav-item-marketing');
        await expect(marketingBtn).toHaveAttribute('aria-current', 'page');

        // Check that another item is NOT active
        const socialBtn = page.getByTestId('nav-item-social');
        await expect(socialBtn).not.toHaveAttribute('aria-current', 'page');
    });

    test('Modal Integrity: Closing modal preserves underlying route', async ({ page }) => {
        // 1. Navigate to Marketing
        await page.getByTestId('nav-item-marketing').click();
        await expect(page).toHaveURL(/.*\/marketing/);

        // 2. Open a modal (New Campaign)
        const createBtn = page.getByRole('button', { name: 'New Campaign' });
        await createBtn.click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        // 3. Close Modal
        await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible();

        // 4. Verify Route is still /marketing
        await expect(page).toHaveURL(/.*\/marketing/);

        // 5. Verify UI State is restored (Marketing Header)
        await expect(page.getByText('Marketing Department', { exact: false })).toBeVisible();
    });

    test('History: Query parameters are preserved on Back/Forward', async ({ page }) => {
        // 1. Navigate to Marketing with query params
        // Note: We use client-side navigation or direct load. Direct load is more robust for "Deep Link with Params".
        const urlWithParams = '/marketing?view=grid&sort=desc';
        await page.goto(urlWithParams);

        // Handle potential login redirect (if reload clears auth)
        const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await guestLoginBtn.isVisible()) {
            await guestLoginBtn.click();
            // Login usually redirects to dashboard or stored return url.
            // If app doesn't support return url with params, this might fail, revealing a bug.
            // But based on observation, let's wait for marketing text.
        }

        // 2. Verify we are on Marketing and Params exist
        await expect(page.getByText('Marketing Department', { exact: false })).toBeVisible();
        // Check params - Note: Login might strip them if not handled carefully in app,
        // but let's assert they SHOULD be there as per "Flow" philosophy.
        // If this fails after login, it means we have a bug in Auth Return URL handling.
        // However, for this test, we assume session might persist or we handle it.
        // Let's check if we are on marketing first.

        // Note: If login redirect drops params, we might need to re-navigate to prove persistence *during session*.
        if (!page.url().includes('?')) {
            console.log('Login stripped params, re-navigating to test in-session history...');
            await page.goto(urlWithParams);
        }

        expect(page.url()).toContain('?view=grid&sort=desc');

        // 3. Navigate to Social (Clean URL)
        await page.getByTestId('nav-item-social').click();
        await expect(page.getByText('Social Media', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/social');
        expect(page.url()).not.toContain('?view=grid');

        // 4. Go Back
        await page.goBack();

        // 5. Verify Params returned
        await expect(page.getByText('Marketing Department', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/marketing');
        expect(page.url()).toContain('?view=grid&sort=desc');

        // 6. Go Forward
        await page.goForward();

        // 7. Verify we are back at Social Media (Clean URL)
        await expect(page.getByText('Social Media', { exact: false })).toBeVisible();
        expect(page.url()).toContain('/social');
        expect(page.url()).not.toContain('?view=grid');
    });

    test('Navigation: Return to HQ works correctly', async ({ page }) => {
        // 1. Navigate to Brand Manager
        await page.getByTestId('nav-item-brand').click();
        await expect(page.getByText('BRAND HQ')).toBeVisible();
        expect(page.url()).toContain('/brand');

        // 2. Click "Return to HQ"
        // Note: Sidebar must be open for this button to be visible, but active state test implies it works.
        // If sidebar is collapsed on smaller screens, this might fail, but default E2E viewport is usually desktop.
        await page.getByTestId('return-hq-btn').click();

        // 3. Verify URL and UI
        await expect(page.getByText('Agent Workspace')).toBeVisible();
        const url = new URL(page.url());
        expect(url.pathname).toBe('/');

        // 4. Verify History (Back button should return to Brand)
        await page.goBack();
        await expect(page.getByText('BRAND HQ')).toBeVisible();
        await expect(page).toHaveURL(/.*\/brand/);
    });

    /**
     * STANDALONE MODULE TESTS
     * "State Loss" verification and Chrome toggling.
     */

    test('Navigation: Standalone Module (Onboarding) Chrome Toggle', async ({ page }) => {
        // 1. Start at Dashboard
        await expect(page.getByText('Agent Workspace')).toBeVisible();

        // Check Sidebar and CommandBar are visible
        const sidebar = page.locator('.z-sidebar'); // Assuming class name from compass test
        // Better selector: The sidebar wrapper in App.tsx doesn't have a testid, but Sidebar component might.
        // Let's rely on visibility of a known sidebar item.
        await expect(page.getByTestId('nav-item-marketing')).toBeVisible();
        // CommandBar
        // Placeholder is dynamic: "Ask indii to orchestrate..." or "Message {module}..."
        await expect(page.getByTestId('prompt-input')).toBeVisible();


        // 2. Navigate to Standalone Module (Onboarding)
        // We can't click a link because there might not be one in the sidebar.
        // We simulate "router" navigation or direct goto (but we want client transition).
        // Since we are "Flow", we prefer UI interaction, but if no link exists, we use goto (Deep Link simulation).
        // However, if we use page.goto, it's a full reload.
        // To test client-side transition (SPA), we need a link.
        // If no link exists, we can't test "SPA Transition" easily without hacking.
        // But useURLSync handles URL changes.
        // Let's use page.goto, which is a "Deep Link" test really.

        console.log('Navigating to Standalone Module: /onboarding');
        await page.goto('/onboarding');

        // Handle potential Login if reload happened (it will)
        const guestLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await guestLoginBtn.isVisible()) {
            await guestLoginBtn.click();
        }

        // 3. Verify Chrome is HIDDEN
        // Sidebar should be gone
        await expect(page.getByTestId('nav-item-marketing')).not.toBeVisible();

        // CommandBar should be gone
        await expect(page.getByTestId('prompt-input')).not.toBeVisible();

        // 4. Verify Onboarding Loaded
        await expect(page.getByText('Setup Your Profile', { exact: false })).toBeVisible();

        // 5. Navigate BACK to Dashboard
        // We use explicit navigation to ensure we return to the Dashboard for verification.
        console.log('Navigating back to Dashboard...');
        await page.goto('/');

        // Handle potential Login if reload happened
        const backLoginBtn = page.getByRole('button', { name: /Guest Login/i });
        if (await backLoginBtn.isVisible()) {
            await backLoginBtn.click();
        }

        // 6. Verify Chrome REAPPEARS
        await expect(page.getByTestId('nav-item-marketing')).toBeVisible();
        await expect(page.getByTestId('prompt-input')).toBeVisible();
    });

    test('Deep Link: Standalone Module loads correctly', async ({ page, context }) => {
        await context.clearCookies();
        const newPage = await context.newPage();

        console.log('Deep linking to: /onboarding');
        await newPage.goto('/onboarding');

        // Expect Login
        const guestLoginBtn = newPage.getByRole('button', { name: /Guest Login/i });
        await expect(guestLoginBtn).toBeVisible();
        await guestLoginBtn.click();

        // Should load Onboarding
        await expect(newPage.getByText('Setup Your Profile', { exact: false })).toBeVisible({ timeout: 20000 });

        // Sidebar should be hidden
        // Note: newPage doesn't have the locators defined in previous test.
        // Use generic selector or testid if available.
        // We know nav items have testids.
        await expect(newPage.getByTestId('nav-item-marketing')).not.toBeVisible();
    });

    test('Persistence: Chat Draft preserved on Standalone Navigation', async ({ page }) => {
        // This test verifies that the "State Loss" issue is resolved.
        // If we type in CommandBar, go to onboarding, and come back, is the text there?
        // We test CommandBar because it is always visible on Dashboard and unmounts on Standalone.

        // 1. Ensure CommandBar is visible
        const commandBarInput = page.getByTestId('prompt-input').locator('textarea');
        await expect(commandBarInput).toBeVisible();

        // 2. Type something
        const testMessage = `Draft Message ${Date.now()}`;
        await commandBarInput.fill(testMessage);

        // 3. Navigate to Onboarding (Client-Side SPA Transition)
        console.log('Navigating to Standalone Module (SPA)...');
        // We use the exposed store to trigger client-side navigation, ensuring we test component unmounting
        // rather than full page reload (which would wipe memory state anyway).
        await page.evaluate(() => {
            // @ts-expect-error - Testing invalid input for window.useStore
            if (window.useStore) {
                // @ts-expect-error - Testing invalid input for window.useStore
                window.useStore.setState({ currentModule: 'onboarding' });
            } else {
                // Fallback for environments where useStore is not exposed (should not happen in Dev)
                console.error('window.useStore not found!');
                window.location.href = '/onboarding';
            }
        });

        // Assert URL matches the state change (Boundary: "Always do: Assert that the URL updates correctly")
        await expect(page).toHaveURL(/.*\/onboarding/);
        await expect(page.getByText('Setup Your Profile')).toBeVisible();

        // 4. Navigate Back (to Dashboard)
        console.log('Navigating back (SPA)...');
        await page.evaluate(() => {
            // @ts-expect-error - Testing invalid input for window.useStore
            if (window.useStore) {
                // @ts-expect-error - Testing invalid input for window.useStore
                window.useStore.setState({ currentModule: 'dashboard' });
            } else {
                window.location.href = '/';
            }
        });

        // Assert URL matches the state change (Boundary: "Always do: Assert that the URL updates correctly")
        const url = new URL(page.url());
        expect(url.pathname).toBe('/');

        // 5. Check Text in CommandBar
        await expect(commandBarInput).toBeVisible();
        const inputValue = await commandBarInput.inputValue();

        // EXPECTED BEHAVIOR: Text is PRESERVED.
        if (inputValue !== testMessage) {
            console.log('FAILURE: Chat draft state was lost during navigation.');
        } else {
            console.log('SUCCESS: Chat draft state was PRESERVED!');
        }

        expect(inputValue).toBe(testMessage);
    });

});
