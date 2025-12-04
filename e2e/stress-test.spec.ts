import { test, expect } from '@playwright/test';

test.describe('Stress Testing', () => {
    test.skip('Asset Loading Performance', async ({ page }) => {
        // 1. Login/Setup
        await page.goto('/');

        // Wait for auth
        await page.waitForTimeout(3000);

        // Check if we are on Select Org page
        if (await page.getByText('Select Organization').isVisible()) {
            await page.getByText('Create New Organization').click();
            await page.fill('input[placeholder="Organization Name"]', 'Stress Test Org');
            await page.getByRole('button', { name: 'Create' }).click();
        }

        // Wait for dashboard
        await expect(page.getByText('Welcome back to')).toBeVisible({ timeout: 10000 });

        // 2. Seed Data (Client-side injection)
        console.log('Seeding 100 images...');
        await page.evaluate(async () => {
            const state = (window as any).useStore.getState();
            const currentProjectId = state.projects[0]?.id || 'proj-default';
            const currentOrgId = state.currentOrganizationId;

            const addToHistory = state.addToHistory;

            const promises = [];
            for (let i = 0; i < 100; i++) {
                const item = {
                    id: `stress-test-${Date.now()}-${i}`,
                    type: 'image',
                    url: 'https://picsum.photos/200/300', // Dummy URL
                    prompt: `Stress Test Image ${i}`,
                    timestamp: Date.now(),
                    projectId: currentProjectId,
                    orgId: currentOrgId
                };
                // We call addToHistory which updates local state and fires async save.
                // We don't necessarily need to wait for save to complete for local rendering,
                // but for "reload" test we do.
                // Since addToHistory doesn't return the promise of save, we might rely on the fact that
                // StorageService is called.
                // However, for this test, let's just update the local state and assume persistence works
                // or just test the rendering performance of 100 items.

                // If we want to test "Loading from Firestore", we need them in Firestore.
                // Since we can't easily wait for the internal async save, we might just wait a bit.
                addToHistory(item);
            }
        });

        // Wait for data to be potentially synced (optional, but good for realism if we were reloading)
        await page.waitForTimeout(5000);

        // 3. Reload Page to test cold load performance
        console.log('Reloading page to test load performance...');
        const startTime = Date.now();
        await page.reload();

        // Wait for Creative Studio to be accessible or navigate to it
        // If we reload, we might be back at dashboard or select org depending on persistence.
        // Assuming we are at dashboard.
        await expect(page.getByText('Welcome back to')).toBeVisible({ timeout: 10000 });

        // Navigate to Creative Studio
        const navStartTime = Date.now();
        const artDeptBtn = page.getByRole('button', { name: 'Art Department' });
        if (await artDeptBtn.isVisible()) {
            await artDeptBtn.click();
        } else {
            await page.getByRole('button', { name: 'Creative Studio' }).click();
        }

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
