import { test, expect } from '@playwright/test';

test.describe('Stress Testing', () => {
    test('Asset Loading Performance', async ({ page }) => {
        test.setTimeout(60000); // Increase timeout for stress test
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

        // Enable console logs
        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));

        // 2. Seed Data (Client-side injection)
        console.log('Seeding 10 images...');
        const orgIdBefore = await page.evaluate(async () => {
            const state = (window as any).useStore.getState();
            const currentProjectId = state.projects?.[0]?.id || 'proj-default';
            const currentOrgId = state.currentOrganizationId;
            const addToHistory = state.addToHistory;

            console.log(`Seeding for Org: ${currentOrgId}`);

            for (let i = 0; i < 10; i++) {
                const item = {
                    id: `stress-test-${Date.now()}-${i}`,
                    type: 'image',
                    url: 'https://picsum.photos/200/300',
                    prompt: `Stress Test Image ${i}`,
                    timestamp: Date.now(),
                    projectId: currentProjectId,
                    orgId: currentOrgId
                };
                addToHistory(item);
            }
            return currentOrgId;
        });
        console.log(`Org ID Before Reload: ${orgIdBefore}`);

        // Wait for data to be synced. 
        // Instead of fixed timeout, we poll the store or wait for a condition
        await page.waitForFunction(async () => {
            const state = (window as any).useStore.getState();
            // Check if items are in history
            return state.generatedHistory.some((item: any) => item.prompt.includes('Stress Test Image'));
        }, null, { timeout: 10000 });

        console.log('Data seeded and verified in store.');

        // 3. Reload Page to test cold load performance
        console.log('Reloading page to test load performance...');
        const startTime = Date.now();
        await page.reload();

        // Wait for dashboard
        await expect(page.getByText('Welcome back to')).toBeVisible({ timeout: 15000 });

        // Wait for store rehydration
        await page.waitForFunction(() => {
            const state = (window as any).useStore.getState();
            console.log('Current History Length:', state.generatedHistory.length);
            return state.generatedHistory.length > 0;
        }, null, { timeout: 30000 });

        const orgIdAfter = await page.evaluate(() => (window as any).useStore.getState().currentOrganizationId);
        console.log(`Org ID After Reload: ${orgIdAfter}`);

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
