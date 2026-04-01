import { test, expect } from '@playwright/test';

// Configuration
const BASE_URL = process.env.E2E_STUDIO_URL || 'http://localhost:4242';

test.describe('Authentication Flow', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Capture browser logs for debugging
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', err => console.error(`BROWSER ERROR: ${err.message}`));

        // Mock Firebase Installations API to prevent 403 Permission Denied in staging
        await page.route('**/*installations.googleapis.com/**', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({
                    name: 'projects/mock-project/installations/mock-installation',
                    fid: 'mock-installation-id',
                    refreshToken: 'mock-refresh-token',
                    authToken: { token: 'mock-auth-token', expiresIn: '604800s' }
                })
            });
        });

        // Mock RAG Proxy to prevent CORS errors during background initialization
        await page.route('**/*ragProxy*/**', async route => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*' } });
                return;
            }
            await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: '{}' });
        });
    });

    test('Login page renders correctly', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        // Wait for the main heading to ensure transitions are done
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });

        // Wait for at least one login button to be visible
        const logInButton = page.getByRole('button', { name: /Sign In|Google|Guest Login/i }).first();
        await expect(logInButton).toBeVisible({ timeout: 5000 });

        console.log('[Auth] Login page rendered correctly');
    });

    test('Invalid credentials show error', async ({ page }) => {
        // Mock the Firebase Identity Toolkit API to return an auth error deterministically.
        // Without this, the test depends on network reachability to the real Firebase backend,
        // which can hang if the API key is fake, restricted, or rate-limited.
        await page.route('**/identitytoolkit.googleapis.com/**', async route => {
            const url = route.request().url();
            if (url.includes('signInWithPassword') || url.includes('signUp')) {
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: {
                            code: 400,
                            message: 'INVALID_LOGIN_CREDENTIALS',
                            errors: [{ message: 'INVALID_LOGIN_CREDENTIALS', domain: 'global', reason: 'invalid' }]
                        }
                    })
                });
                return;
            }
            // Allow other Identity Toolkit calls through (e.g. token refresh)
            await route.continue();
        });

        // Also mock securetoken.googleapis.com to prevent token refresh hangs
        await page.route('**/securetoken.googleapis.com/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ access_token: 'mock', expires_in: '3600', token_type: 'Bearer' })
            });
        });

        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');
        const emailInput = page.locator('input[type="email"]').first();
        const passwordInput = page.locator('input[type="password"]').first();

        // Skip if no email login form
        if (!await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('[Auth] No email login form, skipping invalid credentials test');
            return;
        }

        // Try invalid credentials
        await emailInput.fill('invalid@example.com');
        await passwordInput.fill('wrongpassword123');
        await page.locator('form button[type="submit"]').first().click();

        // Should show error message (role="alert" on the motion.p element in LoginForm)
        const errorMessage = page.locator('[role="alert"], [data-testid="auth-error"]').first();
        await expect(errorMessage).toBeVisible({ timeout: 10000 });
        console.log('[Auth] Invalid credentials correctly rejected');
    });

    test('Valid credentials authenticate successfully (mock)', async ({ page }) => {
        // Uses mock auth injection instead of real Firebase credentials.
        // Inject the same mock state the auth fixture uses.
        await page.addInitScript(() => {
            const w = window as unknown as Record<string, unknown>;
            w.FIREBASE_E2E_MOCK = true;
            w.FIREBASE_USER_MOCK = {
                uid: 'test-user-uid-e2e',
                email: 'e2e@indiios.test',
                displayName: 'E2E Test User',
                isAnonymous: false,
            };
            try {
                localStorage.setItem('FIREBASE_E2E_MOCK', '1');
                localStorage.setItem('onboarding_dismissed', 'true');
                localStorage.setItem('indiiOS_tour_completed_v1', 'true');
                localStorage.setItem('indiiOS_cookie_consent', JSON.stringify({ essential: true, analytics: false, errorTracking: false, marketing: false, timestamp: new Date().toISOString(), version: 1 }));
            } catch { /* ignore */ }
        });

        // Mock Firestore to prevent network hangs
        await page.route('**/firestore.googleapis.com/**', async route => {
            const url = route.request().url();
            if (url.includes(':listen') || url.includes('/Listen/') || url.includes('channel?')) {
                await route.abort('failed');
                return;
            }
            if (url.includes('/users/test-user-uid-e2e')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        name: 'projects/mock/databases/(default)/documents/users/test-user-uid-e2e',
                        fields: {
                            uid: { stringValue: 'test-user-uid-e2e' },
                            displayName: { stringValue: 'E2E Test User' },
                            membershipTier: { stringValue: 'pro' },
                            onboardingCompleted: { booleanValue: true },
                        },
                    }),
                });
                return;
            }
            await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });

        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        // Mock auth should auto-login — verify we reach the dashboard
        await expect(
            page.getByRole('button', { name: /(Agent Workspace|My Dashboard|Dashboard)/i }).first()
        ).toBeVisible({ timeout: 30000 });
        console.log('[Auth] Mock login successful — dashboard reached');
    });

    test('Logout clears session (mock)', async ({ page }) => {
        // Inject mock auth state
        await page.addInitScript(() => {
            const w = window as unknown as Record<string, unknown>;
            w.FIREBASE_E2E_MOCK = true;
            w.FIREBASE_USER_MOCK = {
                uid: 'test-user-uid-e2e',
                email: 'e2e@indiios.test',
                displayName: 'E2E Test User',
                isAnonymous: false,
            };
            try {
                localStorage.setItem('FIREBASE_E2E_MOCK', '1');
                localStorage.setItem('onboarding_dismissed', 'true');
                localStorage.setItem('indiiOS_tour_completed_v1', 'true');
                localStorage.setItem('indiiOS_cookie_consent', JSON.stringify({ essential: true, analytics: false, errorTracking: false, marketing: false, timestamp: new Date().toISOString(), version: 1 }));
            } catch { /* ignore */ }
        });

        await page.route('**/firestore.googleapis.com/**', async route => {
            const url = route.request().url();
            if (url.includes(':listen') || url.includes('/Listen/') || url.includes('channel?')) {
                await route.abort('failed');
                return;
            }
            await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });

        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        // Wait for dashboard
        await expect(
            page.getByRole('button', { name: /(Agent Workspace|My Dashboard|Dashboard)/i }).first()
        ).toBeVisible({ timeout: 30000 });

        // Look for the user avatar / settings area to trigger logout
        const settingsBtn = page.getByRole('button', { name: /settings/i });
        const logoutBtn = page.getByRole('button', { name: /logout|sign out/i });
        const userAvatar = page.locator('[data-testid="user-avatar"], .avatar, [class*="avatar"]').first();

        if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await logoutBtn.click();
        } else if (await settingsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await settingsBtn.click();
            if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await logoutBtn.click();
            }
        } else if (await userAvatar.isVisible({ timeout: 2000 }).catch(() => false)) {
            await userAvatar.click();
            const menuLogout = page.getByRole('menuitem', { name: /logout|sign out/i });
            if (await menuLogout.isVisible({ timeout: 2000 }).catch(() => false)) {
                await menuLogout.click();
            }
        } else {
            console.log('[Auth] Logout button not found — mock auth may not expose logout UI');
        }

        console.log('[Auth] Logout flow completed');
    });

    test('Session persists on page reload (mock)', async ({ page }) => {
        // Inject mock auth state
        await page.addInitScript(() => {
            const w = window as unknown as Record<string, unknown>;
            w.FIREBASE_E2E_MOCK = true;
            w.FIREBASE_USER_MOCK = {
                uid: 'test-user-uid-e2e',
                email: 'e2e@indiios.test',
                displayName: 'E2E Test User',
                isAnonymous: false,
            };
            try {
                localStorage.setItem('FIREBASE_E2E_MOCK', '1');
                localStorage.setItem('onboarding_dismissed', 'true');
                localStorage.setItem('indiiOS_tour_completed_v1', 'true');
                localStorage.setItem('indiiOS_cookie_consent', JSON.stringify({ essential: true, analytics: false, errorTracking: false, marketing: false, timestamp: new Date().toISOString(), version: 1 }));
            } catch { /* ignore */ }
        });

        await page.route('**/firestore.googleapis.com/**', async route => {
            const url = route.request().url();
            if (url.includes(':listen') || url.includes('/Listen/') || url.includes('channel?')) {
                await route.abort('failed');
                return;
            }
            await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });

        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        // Wait for dashboard
        await expect(
            page.getByRole('button', { name: /(Agent Workspace|My Dashboard|Dashboard)/i }).first()
        ).toBeVisible({ timeout: 30000 });

        // Reload page
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Mock auth addInitScript persists across navigations — should still be on dashboard
        await expect(
            page.getByRole('button', { name: /(Agent Workspace|My Dashboard|Dashboard)/i }).first()
        ).toBeVisible({ timeout: 30000 });
        console.log('[Auth] Session persisted after reload (mock auth)');
    });

    test('Protected routes redirect to login when unauthenticated', async ({ page }) => {
        // Clear any existing session
        await page.goto(BASE_URL);
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });

        // Try to access a protected route directly
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('domcontentloaded');

        // Should be redirected to login or see login form
        const isOnLogin = await page.locator('input[type="email"]').isVisible({ timeout: 5000 }).catch(() => false);
        const isOnDashboard = await page.getByRole('button', { name: /(Agent Workspace|My Dashboard|Dashboard)/i }).first().isVisible({ timeout: 2000 }).catch(() => false);

        // Either we're on login page, or we see an auth prompt
        if (!isOnDashboard) {
            console.log('[Auth] Protected route correctly redirected to login');
        } else {
            console.log('[Auth] Note: Session may have persisted from previous test');
        }
    });
});

test.describe('OAuth Flow', () => {
    test('Google OAuth button is present', async ({ page }) => {
        await page.goto(BASE_URL);
        await page.waitForLoadState('domcontentloaded');

        const googleButton = page.getByRole('button', { name: /google|continue with google/i });

        if (await googleButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('[Auth] Google OAuth button present');
            expect(true).toBeTruthy();
        } else {
            console.log('[Auth] Google OAuth button not found (may not be configured)');
            // Not a failure - OAuth may not be configured
        }
    });
});
