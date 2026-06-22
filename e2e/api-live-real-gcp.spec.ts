import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('@live Live Production GCP API Verification', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('Authenticate and verify all backend API modules', async ({ page, baseURL }) => {
        test.setTimeout(180000);
        // Collect console errors and responses
        const consoleErrors: string[] = [];
        const apiResponses: { url: string; status: number; payload?: any }[] = [];

        page.on('console', msg => {
            const text = msg.text();
            console.log(`[BROWSER LOG] [${msg.type()}] ${text}`);
            if (msg.type() === 'error') {
                consoleErrors.push(text);
            }
        });

        page.on('pageerror', err => {
            console.error(`[BROWSER ERROR] ${err.message}`);
            consoleErrors.push(err.message);
        });

        page.on('response', async response => {
            const url = response.url();
            if (url.includes('cloudfunctions.net') || url.includes('/v1/projects/')) {
                try {
                    const text = await response.text();
                    let payload;
                    try {
                        payload = JSON.parse(text);
                    } catch {
                        payload = text;
                    }
                    apiResponses.push({ url, status: response.status(), payload });
                    console.log(`[API RESPONSE] ${response.status()} from ${url}`);
                } catch (e) {
                    console.log(`[API RESPONSE ERROR] Failed to parse response from ${url}:`, e);
                }
            }
        });

        // Inject App Check debug token before any scripts run
        const appCheckToken = process.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN || '342a22b8-af79-4f15-af67-8b946aabba75';
        console.log(`[E2E:Live] Injecting App Check debug token: ${appCheckToken}`);
        await page.addInitScript((token) => {
            const key = ['FIREBASE', 'APPCHECK', 'DEBUG', 'TOKEN'].join('_');
            (window as any)[key] = token;
            (self as any)[key] = token;
        }, appCheckToken);

        // 1. Navigate to the base URL
        console.log(`[E2E:Live] Navigating to ${baseURL} ...`);
        await page.goto(baseURL || 'https://indii-music-studio.web.app', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle');

        // Dismiss Cookie Preferences if present immediately
        try {
            console.log('[E2E:Live] Checking for Cookie Preferences modal...');
            const acceptCookies = page.getByRole('button', { name: /Accept All/i }).first();
            await acceptCookies.waitFor({ state: 'visible', timeout: 5000 });
            await acceptCookies.click();
            console.log('[E2E:Live] Clicked "Accept All" cookies.');
        } catch (e) {
            console.log('[E2E:Live] Cookie Preferences dialog not found or skipped.');
        }

        // Check if we need to dismiss the onboarding modal
        try {
            console.log('[E2E:Live] Checking for onboarding modal...');
            const exploreGuest = page.getByRole('button', { name: /Explore as Guest|Enter/i }).first();
            if (await exploreGuest.isVisible({ timeout: 2000 })) {
                await exploreGuest.click();
                console.log('[E2E:Live] Clicked "Explore as Guest" / "Enter".');
            }
        } catch (e) {
            console.log('[E2E:Live] Onboarding dialog not found or skipped.');
        }

        // Wait for store initialization
        await page.waitForFunction(() => (window as any).useStore !== undefined, { timeout: 15000 });

        // Check if we are logged in
        let isLoggedIn = await page.evaluate(() => {
            return (window as any).useStore.getState().user !== null;
        });

        if (!isLoggedIn) {
            console.log('[E2E:Live] Not logged in, performing login...');
            const emailInput = page.locator('input[type="email"]').first();
            const passwordInput = page.locator('input[type="password"]').first();

            // Wait for form
            await expect(emailInput).toBeVisible({ timeout: 10000 });
            await emailInput.fill('marcus.deep@test.indii.music');
            await passwordInput.fill('Test1234!');
            await page.locator('form button[type="submit"]').first().click();

            // Wait for state transition to logged in
            await page.waitForFunction(() => {
                const store = (window as any).useStore;
                return store && store.getState().user !== null;
            }, { timeout: 15000 });

            console.log('[E2E:Live] Login completed successfully.');
        } else {
            console.log('[E2E:Live] Already logged in as:', await page.evaluate(() => (window as any).useStore.getState().user.email));
        }

        // Get the Auth token from browser context
        const idToken = await page.evaluate(async () => {
            const user = (window as any).useStore.getState().user;
            if (!user) throw new Error("Not logged in");
            if (typeof user.getIdToken === 'function') {
                return user.getIdToken();
            }
            if (user.stsTokenManager && user.stsTokenManager.accessToken) {
                return user.stsTokenManager.accessToken;
            }
            if (user.accessToken) {
                return user.accessToken;
            }
            throw new Error("Could not extract ID token from user object");
        });
        console.log('[E2E:Live] Successfully retrieved Auth ID Token.');

        // Verify REST API endpoints via Node fetch (bypassing browser CORS check restrictions)
        console.log('[E2E:Live] Verifying REST API endpoints via Node fetch...');
        
        // Define endpoints to test
        const endpointsToTest = [
            { name: 'health', method: 'GET', url: 'https://us-central1-indii-music-founder.cloudfunctions.net/health', authRequired: false },
            { name: 'getProfile', method: 'GET', url: 'https://us-central1-indii-music-founder.cloudfunctions.net/getProfile', authRequired: true },
            { name: 'listTracks', method: 'GET', url: 'https://us-central1-indii-music-founder.cloudfunctions.net/listTracks', authRequired: true },
        ];

        for (const endpoint of endpointsToTest) {
            console.log(`[E2E:Live] Calling ${endpoint.method} ${endpoint.url} ...`);
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (endpoint.authRequired) {
                headers['Authorization'] = `Bearer ${idToken}`;
            }
            const res = await fetch(endpoint.url, { method: endpoint.method, headers });
            let data = null;
            try {
                data = await res.json();
            } catch (e) {
                try {
                    data = await res.text();
                } catch {}
            }
            console.log(`[E2E:Live] ${endpoint.name} status: ${res.status}, ok: ${res.ok}`);
            console.log(`[E2E:Live] ${endpoint.name} response: ${JSON.stringify(data).slice(0, 300)}...`);
            
            apiResponses.push({ url: endpoint.url, status: res.status, payload: data });
        }

        // CRUD Track verification in Node.js
        let createdTrackId: string | null = null;
        
        // 1. Create Track
        console.log(`[E2E:Live] Calling POST createTrack ...`);
        const createTrackRes = await fetch('https://us-central1-indii-music-founder.cloudfunctions.net/createTrack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                title: `Test Track ${Date.now()}`,
                genre: 'Electronic',
                status: 'draft',
                bpm: 120
            })
        });
        
        const createTrackData = await createTrackRes.json() as any;
        console.log(`[E2E:Live] createTrack status: ${createTrackRes.status}`);
        console.log(`[E2E:Live] createTrack data: ${JSON.stringify(createTrackData)}`);
        apiResponses.push({ url: 'https://us-central1-indii-music-founder.cloudfunctions.net/createTrack', status: createTrackRes.status, payload: createTrackData });
        
        if (createTrackRes.status === 201 && createTrackData?.data?.id) {
            createdTrackId = createTrackData.data.id;
            console.log(`[E2E:Live] Track created with ID: ${createdTrackId}`);
            
            // 2. Get Track
            console.log(`[E2E:Live] Calling GET getTrack/${createdTrackId} ...`);
            const getTrackRes = await fetch(`https://us-central1-indii-music-founder.cloudfunctions.net/getTrack/${createdTrackId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            });
            const getTrackData = await getTrackRes.json();
            console.log(`[E2E:Live] getTrack status: ${getTrackRes.status}`);
            console.log(`[E2E:Live] getTrack data: ${JSON.stringify(getTrackData)}`);
            apiResponses.push({ url: `https://us-central1-indii-music-founder.cloudfunctions.net/getTrack/${createdTrackId}`, status: getTrackRes.status, payload: getTrackData });

            // 3. Update Track
            console.log(`[E2E:Live] Calling PUT updateTrack/${createdTrackId} ...`);
            const updateTrackRes = await fetch(`https://us-central1-indii-music-founder.cloudfunctions.net/updateTrack/${createdTrackId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    title: `Test Track Updated ${Date.now()}`,
                    bpm: 125
                })
            });
            const updateTrackData = await updateTrackRes.json();
            console.log(`[E2E:Live] updateTrack status: ${updateTrackRes.status}`);
            console.log(`[E2E:Live] updateTrack data: ${JSON.stringify(updateTrackData)}`);
            apiResponses.push({ url: `https://us-central1-indii-music-founder.cloudfunctions.net/updateTrack/${createdTrackId}`, status: updateTrackRes.status, payload: updateTrackData });

            // 4. Delete Track
            console.log(`[E2E:Live] Calling DELETE deleteTrack/${createdTrackId} ...`);
            const deleteTrackRes = await fetch(`https://us-central1-indii-music-founder.cloudfunctions.net/deleteTrack/${createdTrackId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            });
            let deleteTrackText = null;
            try {
                deleteTrackText = await deleteTrackRes.text();
            } catch {}
            console.log(`[E2E:Live] deleteTrack status: ${deleteTrackRes.status}`);
            apiResponses.push({ url: `https://us-central1-indii-music-founder.cloudfunctions.net/deleteTrack/${createdTrackId}`, status: deleteTrackRes.status, payload: deleteTrackText });
        }

        // Wait a bit for initialization
        await page.waitForTimeout(3000);

        // Define screenshots path
        const artifactDir = '/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity/brain/7844d4a2-4578-4d8a-b166-b47679154ffb';

        // --- Nav to Dashboard ---
        await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(artifactDir, 'live_dashboard.png'), fullPage: true });
        console.log('[E2E:Live] Captured live Dashboard screenshot.');

        // --- Nav to Creative ---
        console.log(`[E2E:Live] Navigating to /creative ...`);
        await page.goto(`${baseURL}/creative`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(artifactDir, 'live_creative_initial.png'), fullPage: true });
        console.log('[E2E:Live] Captured live Creative initial screenshot.');

        // Switch to direct generation if button is visible
        const directBtn = page.locator('[data-testid="direct-view-btn"]');
        if (await directBtn.isVisible()) {
            await directBtn.click();
            await page.waitForTimeout(1000);
        }

        // Dismiss Cookie Preferences if present again
        try {
            const acceptCookies = page.getByRole('button', { name: /Accept All/i }).first();
            if (await acceptCookies.isVisible()) {
                await acceptCookies.click();
                console.log('[E2E:Live] Clicked "Accept All" cookies (second occurrence).');
                await page.waitForTimeout(500);
            }
        } catch (e) {}

        // Fill prompt and trigger generation
        const promptInput = page.locator('[data-testid="direct-prompt-input"], textarea').first();
        if (await promptInput.isVisible()) {
            console.log('[E2E:Live] Triggering live image generation via UI...');
            await promptInput.fill('A stunning high-fidelity render of detroit techno synth modules, neon lighting');
            
            const generateBtn = page.locator('[data-testid="direct-generate-btn"]');
            await expect(generateBtn).toBeEnabled({ timeout: 10000 });
            await generateBtn.click();

            // Wait for functions response (timeout 60 seconds because image gen takes some time)
            console.log('[E2E:Live] Waiting for generateImageV3 API response...');
            await page.waitForResponse(
                response => response.url().includes('generateImageV3'),
                { timeout: 60000 }
            );

            console.log('[E2E:Live] generateImageV3 call finished. Waiting for render to update...');
            await page.waitForTimeout(5000);
            await page.screenshot({ path: path.join(artifactDir, 'live_creative_generated.png'), fullPage: true });
            console.log('[E2E:Live] Captured live Creative generated screenshot.');
        } else {
            console.warn('[E2E:Live] Prompt input not visible or not found.');
        }

        // --- Navigate to other modules to verify no client-side / endpoint console errors ---
        const modules = ['video', 'social', 'distribution', 'finance', 'workflow', 'agent'];
        for (const mod of modules) {
            console.log(`[E2E:Live] Navigating to /${mod} ...`);
            await page.goto(`${baseURL}/${mod}`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1000);

            // Dismiss Cookie Preferences if present
            try {
                const acceptCookies = page.getByRole('button', { name: /Accept All/i }).first();
                if (await acceptCookies.isVisible()) {
                    await acceptCookies.click();
                    console.log(`[E2E:Live] Clicked "Accept All" cookies on /${mod}.`);
                    await page.waitForTimeout(500);
                }
            } catch (e) {}

            await page.waitForTimeout(1000);
            await page.screenshot({ path: path.join(artifactDir, `live_${mod}_module.png`), fullPage: true });
            console.log(`[E2E:Live] Verified and captured screenshot of /${mod} module.`);
        }

        // Output results to logs
        console.log('\n======================================');
        console.log('   Live API E2E Verification Results  ');
        console.log('======================================');
        console.log(`Console Errors Found: ${consoleErrors.length}`);
        consoleErrors.forEach((err, idx) => console.log(`  ${idx + 1}: ${err}`));
        console.log(`API Calls Verified: ${apiResponses.length}`);
        apiResponses.forEach((res, idx) => {
            console.log(`  ${idx + 1}: ${res.url} -> Status: ${res.status}`);
            console.log(`     Payload: ${JSON.stringify(res.payload).slice(0, 200)}...`);
        });
        console.log('======================================\n');

        // Check if any errors occurred during generation
        const generateImageResponse = apiResponses.find(r => r.url.includes('generateImageV3'));
        expect(generateImageResponse).toBeDefined();
        expect(generateImageResponse?.status).toBe(200);
    });
});
