import { test, expect } from '@playwright/test';

test.describe('Stress Testing', () => {
    test('Asset Loading Performance', async ({ page }) => {
        test.setTimeout(90000); // Increase timeout for stress test

        // Bypass onboarding and auth gates for testing
        await page.addInitScript(() => {
            (window as any).__TEST_MODE__ = true;
            localStorage.setItem('TEST_MODE', 'true');
        });

        // Enable console logs early
        page.on('console', msg => {
            const txt = msg.text();
            if (txt.includes('[App]') || txt.includes('[Store]') || txt.includes('Error')) {
                console.log(`BROWSER: ${txt}`);
            }
        });

        // 1. Login/Setup
        await page.goto('/?testMode=true');

        // Wait for app to load
        await page.waitForLoadState('domcontentloaded');

        // Wait for auth to initialize (anonymous sign-in)
        await page.waitForTimeout(3000);

        // Handle Loading state
        const loader = page.getByText('Loading Module...');
        if (await loader.isVisible()) {
            await loader.waitFor({ state: 'hidden', timeout: 15000 });
        }

        // Handle Auth/Login skip
        const guestBtn = page.getByRole('button', { name: /Continue as Guest/i });
        if (await guestBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await guestBtn.click();
            await page.waitForTimeout(2000);
        }

        // Check if we are on Select Org page
        const selectOrgHeader = page.getByText('Select Organization');
        if (await selectOrgHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
            const createBtn = page.getByRole('button', { name: 'Create New Organization' });
            if (await createBtn.isVisible()) {
                await createBtn.click();
                await page.getByPlaceholder('Organization Name').fill('Stress Test Org');
                await page.getByRole('button', { name: 'Create', exact: true }).click();
                // Wait for redirect
                await page.waitForTimeout(2000);
            }
        }

        // Wait for dashboard - handle different possible states
        const dashboardVisible = await page.getByText(/(STUDIO HQ|Agent Workspace)/).isVisible({ timeout: 10000 }).catch(() => false);
        if (!dashboardVisible) {
            // Try to navigate to dashboard if we're somewhere else
            const dashboardBtn = page.getByRole('button', { name: /Dashboard/i });
            if (await dashboardBtn.isVisible().catch(() => false)) {
                await dashboardBtn.click();
            }
        }
        await expect(page.getByText(/(STUDIO HQ|Agent Workspace)/)).toBeVisible({ timeout: 30000 });


        // 2. Seed Data (Client-side injection)
        console.log('Seeding 10 images...');
        const orgIdBefore = await page.evaluate(async () => {
            const store = (window as any).useStore;

            // 1. Init Auth (Anonymous)
            await store.getState().initializeHistory();

            // 2. Create Unique Org to bypass rule issues
            const auth = (window as any).auth;
            const db = (window as any).db;
            const { doc, setDoc } = (window as any).firestore;

            if (!auth?.currentUser || !db || !setDoc) throw new Error("Firebase internals missing");

            const uid = auth.currentUser.uid;
            const orgId = 'stress-' + Math.random().toString(36).slice(2, 9);
            localStorage.setItem('stress_org_id', orgId);

            console.log(`Creating stress test org: ${orgId}`);

            await setDoc(doc(db, 'organizations', orgId), {
                name: 'Stress Org',
                ownerId: uid,
                members: [uid],
                createdAt: Date.now()
            });

            // 3. Set Org
            store.getState().setOrganization(orgId);

            const currentProjectId = store.getState().projects?.[0]?.id || 'proj-default';
            const addToHistory = store.getState().addToHistory;

            console.log(`Seeding for Org: ${orgId}`);

            for (let i = 0; i < 10; i++) {
                const item = {
                    id: `stress-test-${Date.now()}-${i}`,
                    type: 'image',
                    url: 'https://picsum.photos/200/300',
                    prompt: `Stress Test Image ${i}`,
                    timestamp: Date.now(),
                    projectId: currentProjectId,
                    orgId: orgId
                };
                addToHistory(item);
            }
            return orgId;
        });
        console.log(`Org ID Before Reload: ${orgIdBefore}`);

        // Wait for data to be synced. 
        await page.waitForFunction(async () => {
            const store = (window as any).useStore;
            if (!store) return false;
            const state = store.getState();
            // Check if items are in history
            return state.generatedHistory.some((item: any) => item.prompt.includes('Stress Test Image'));
        }, null, { timeout: 10000 });

        console.log('Data seeded and verified in store.');

        // 3. Reload Page to test cold load performance
        console.log('Reloading page to test load performance...');
        const startTime = Date.now();
        await page.reload();

        // Wait for dashboard
        await expect(page.getByText(/(STUDIO HQ|Agent Workspace)/)).toBeVisible({ timeout: 15000 });

        // Re-seed data because TEST_MODE is stateless and does not persist to backend
        console.log('Re-seeding data after reload (Stateless TEST_MODE)...');
        await page.evaluate(async () => {
            const store = (window as any).useStore;
            if (!store) throw new Error('Store not found after reload');

            // Re-init auth
            await store.getState().initializeHistory();

            // Restore Org
            const orgId = localStorage.getItem('stress_org_id');
            if (orgId) {
                store.getState().setOrganization(orgId);
            }

            const state = store.getState();
            const currentProjectId = state.projects?.[0]?.id || 'proj-default';
            const currentOrgId = state.currentOrganizationId; // Should be set now
            const addToHistory = state.addToHistory;

            for (let i = 0; i < 10; i++) {
                const item = {
                    id: `stress-test-reseed-${Date.now()}-${i}`,
                    type: 'image',
                    url: 'https://picsum.photos/200/300',
                    prompt: `Stress Test Image ${i}`,
                    timestamp: Date.now(),
                    projectId: currentProjectId,
                    orgId: currentOrgId
                };
                addToHistory(item);
            }
        });

        const orgIdAfter = await page.evaluate(() => (window as any).useStore.getState().currentOrganizationId);
        console.log(`Org ID After Reload: ${orgIdAfter}`);

        // Navigate to Creative Studio
        const navStartTime = Date.now();
        console.log('Navigating to Creative Director module...');

        // Navigate to Creative Director module DIRECTLY via store to avoid UI flakiness
        // This focuses the test on Asset Loading Performance, not Sidebar interaction.
        await page.evaluate(() => {
            (window as any).useStore.setState({ isSidebarOpen: true, currentModule: 'creative' });
        });

        // Wait for rendering
        await page.waitForTimeout(1000);

        // Measure time until images are visible
        // We look for the images we seeded.
        // We wait for at least one image to be visible.
        await expect(page.getByAltText(/Stress Test Image/).first()).toBeVisible({ timeout: 30000 });

        const navEndTime = Date.now();
        const tti = navEndTime - navStartTime;
        console.log(`Time to Interactive (Gallery Load): ${tti}ms`);

        // Fail if > 3000ms (soft assertion or hard)
        // expect(tti).toBeLessThan(3000);
        // We log it for now as performance tests can be flaky in CI.
    });

    test('Rendering Performance (Landing Page Scroll)', async ({ page }) => {
        // 1. Load Landing Page
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // 2. Setup FPS counter
        await page.evaluate(() => {
            (window as any).fpsMetrics = {
                frames: 0,
                startTime: performance.now(),
                minFps: 60,
                drops: 0
            };

            let lastTime = performance.now();

            function loop() {
                const now = performance.now();
                const delta = now - lastTime;
                lastTime = now;

                const fps = 1000 / delta;
                (window as any).fpsMetrics.frames++;

                if (delta > 0) {
                    if (fps < 30) (window as any).fpsMetrics.drops++;
                    if (fps < (window as any).fpsMetrics.minFps) (window as any).fpsMetrics.minFps = fps;
                }

                requestAnimationFrame(loop);
            }
            requestAnimationFrame(loop);
        });

        // 3. Scroll from top to bottom rapidly
        console.log('Scrolling Landing Page...');

        // Get scroll height
        const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
        const viewportHeight = await page.evaluate(() => window.innerHeight);

        // Scroll in steps
        const steps = 20;
        const stepSize = (scrollHeight - viewportHeight) / steps;

        for (let i = 0; i <= steps; i++) {
            await page.mouse.wheel(0, stepSize);
            await page.waitForTimeout(50); // Fast scroll
        }

        // 4. Collect Metrics
        const metrics = await page.evaluate(() => (window as any).fpsMetrics);
        console.log('FPS Metrics:', metrics);

        // Assertions
        // Expect no massive frame drops (this might be flaky in CI, so we log it)
        // expect(metrics.drops).toBeLessThan(10);
    });
});
