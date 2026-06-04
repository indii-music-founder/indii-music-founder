import { test, expect } from '@playwright/test';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
};

const mockFirestoreUserDoc = async (route: any) => {
    const url = route.request().url();
    if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
    }
    if (url.includes(':listen') || url.includes('/Listen/') || url.includes('channel?') || url.includes(':write') || url.includes('/Write/')) {
        await route.abort('failed');
        return;
    }
    const postData = route.request().postData() || '';
    const isUserDoc = url.includes('/documents/users/test-user-uid-e2e') || postData.includes('test-user-uid-e2e');

    if (isUserDoc) {
        await route.fulfill({
            status: 200,
            headers: corsHeaders,
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
    await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: '{}' });
};

test('Create Account sign-up flow simulation with logout', async ({ page }) => {
    // Capture browser logs for debugging
    page.on('console', msg => console.log(`[BROWSER LOG] [${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err.message}`));

    // Mock Installations API
    await page.route('**/*installations.googleapis.com/**', async route => {
        if (route.request().method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: corsHeaders });
            return;
        }
        await route.fulfill({
            status: 200,
            headers: corsHeaders,
            contentType: 'application/json',
            body: JSON.stringify({
                name: 'projects/mock-project/installations/mock-installation',
                fid: 'mock-installation-id',
                refreshToken: 'mock-refresh-token',
                authToken: { token: 'mock-auth-token', expiresIn: '604800s' }
            })
        });
    });

    // Mock Firestore
    await page.route('**/firestore.googleapis.com/**', mockFirestoreUserDoc);

    // Mock Identity Toolkit for successful signup/login
    await page.route('**/identitytoolkit.googleapis.com/**', async route => {
        if (route.request().method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: corsHeaders });
            return;
        }
        const url = route.request().url();
        console.log(`[PLAYWRIGHT MOCK] Intercepted Identity Toolkit URL: ${url}`);
        if (url.includes('signInWithPassword') || url.includes('signUp')) {
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                contentType: 'application/json',
                body: JSON.stringify({
                    localId: "test-user-uid-e2e",
                    email: "e2e-signup@indii.test",
                    displayName: "E2E Sign Up Test User",
                    idToken: "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vaW5kaWktbXVzaWMtZm91bmRlciIsImF1ZCI6ImluZGlpLW11c2ljLWZvdW5kZXIiLCJhdXRoX3RpbWUiOjE3MDAwMDAwMDAsInVzZXJfaWQiOiJ0ZXN0LXVzZXItdWlkLWUyZSIsInN1YiI6InRlc3QtdXNlci11aWQtZTJlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE4MDAwMDAwMDAsImVtYWlsIjoiZTJlQGluZGlpLnRlc3QiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJlMmVAaW5kaWkudGVzdCJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.signature",
                    refreshToken: "mock-refresh-token-e2e",
                    expiresIn: "3600",
                })
            });
            return;
        }
        await route.fulfill({ status: 200, headers: corsHeaders, contentType: 'application/json', body: '{}' });
    });

    await page.route('**/securetoken.googleapis.com/**', async route => {
        if (route.request().method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: corsHeaders });
            return;
        }
        await route.fulfill({
            status: 200,
            headers: corsHeaders,
            contentType: 'application/json',
            body: JSON.stringify({
                access_token: 'mock-access-token',
                expires_in: '3600',
                token_type: 'Bearer',
                refresh_token: 'mock-refresh-token',
                id_token: 'mock-id-token',
                user_id: 'test-user-uid-e2e',
                project_id: 'mock-project'
            })
        });
    });

    // 1. Navigate to Studio Page
    console.log('[PLAYWRIGHT] Navigating to http://localhost:4242...');
    await page.goto('http://localhost:4242');
    await page.waitForLoadState('domcontentloaded');

    // Wait for store initialization
    await page.waitForFunction(() => (window as any).useStore !== undefined, { timeout: 10000 });

    // 2. Perform Logout via Zustand store to show LoginForm
    console.log('[PLAYWRIGHT] Performing logout via Zustand store...');
    await page.evaluate(async () => {
        const store = (window as any).useStore;
        if (store.getState().user) {
            await store.getState().logout();
        }
    });

    // Verify LoginForm is rendered (e.g. Email Address label visible)
    const emailLabel = page.locator('label:has-text("Email Address")').first();
    await expect(emailLabel).toBeVisible({ timeout: 10000 });

    // 3. Click "Create Account" tab
    console.log('[PLAYWRIGHT] Clicking "Create Account" tab...');
    const createAccountTab = page.locator('button:has-text("Create Account")');
    await expect(createAccountTab).toBeVisible({ timeout: 10000 });
    await createAccountTab.click();

    // 4. Fill in email, password, confirm password, and DOB
    console.log('[PLAYWRIGHT] Filling form details...');
    await page.locator('input[type="email"]').first().fill('e2e-signup@indii.test');
    
    // Fill in Password input (which is the first input of type password)
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('password123');
    // Fill in Confirm Password input (second password input)
    await passwordInputs.nth(1).fill('password123');
    
    // Fill Date of Birth
    await page.locator('input[type="date"]').fill('2000-01-01');

    // 5. Click Submit ("Create Account" submit button)
    console.log('[PLAYWRIGHT] Clicking submit button...');
    const submitBtn = page.locator('form button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 6. Wait to see if we navigate to dashboard/onboarding or if any errors show
    console.log('[PLAYWRIGHT] Waiting to verify authentication outcome...');
    await page.waitForTimeout(5000);

    // Verify user is logged in
    const isLoggedIn = await page.evaluate(() => {
        return (window as any).useStore.getState().user !== null;
    });
    console.log(`[PLAYWRIGHT] Authentication status after signup: ${isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);
    expect(isLoggedIn).toBe(true);
});
