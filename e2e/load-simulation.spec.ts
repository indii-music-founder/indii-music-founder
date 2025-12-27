import { test, expect } from '@playwright/test';

const BASE_URL = '';
const VIRTUAL_USERS = 20; // Number of concurrent users per worker

test.describe('Load Simulation: The Flash Mob', () => {
    // We increase timeout because 20 concurrent loads might be slow
    test.setTimeout(120000);

    test('Spawn 20 Concurrent Virtual Users (Flash Mob)', async ({ browser }) => {
        console.log(`[Load] Spawning ${VIRTUAL_USERS} concurrent users...`);

        // Create an array of "user" promises
        const userSessions = Array.from({ length: VIRTUAL_USERS }).map(async (_, i) => {
            const context = await browser.newContext();
            const page = await context.newPage();
            const userId = `VU-${i + 1}`;

            try {
                // 1. Hit the Home Page
                await page.addInitScript(() => {
                    localStorage.setItem('TEST_MODE', 'true');
                    (window as any).__TEST_MODE__ = true;
                });

                const startTime = Date.now();
                await page.goto(BASE_URL + '/?testMode=true');
                await page.waitForLoadState('domcontentloaded');

                // 2. Initial resilience check (Did we get 429'd on the JS bundles?)
                const title = await page.title();
                if (!title) throw new Error(`${userId}: No title found (Possible 500/429)`);

                // 3. Perform a "Heavy" read operation (Simulated by verifying Dashboard load)
                // We race against a timeout because if 1M users hit, some WILL timeout
                await expect(page.getByText('Studio Headquarters')).toBeVisible({ timeout: 20000 });

                // 4. Random "Write" operation (Agent interaction)
                // Only 50% of users do this to vary load
                if (Math.random() > 0.5) {
                    await page.goto(`${BASE_URL}/creative`);
                    // Just loading the module triggers Firestore reads
                    await page.waitForLoadState('domcontentloaded');
                }

                console.log(`[Load] ${userId}: Success (${Date.now() - startTime}ms)`);
                return { id: userId, status: 'success' };
            } catch (e: any) {
                console.log(`[Load] ${userId}: FAILED - ${e.message}`);
                // Capture if it was a quota error
                return { id: userId, status: 'failed', error: e.message };
            } finally {
                await context.close();
            }
        });

        // Fire them all at once!
        const results = await Promise.all(userSessions);

        // Analyze Results
        const successes = results.filter(r => r.status === 'success');
        const failures = results.filter(r => r.status === 'failed');

        console.log(`\n[Load Report]`);
        console.log(`Total VUs: ${VIRTUAL_USERS}`);
        console.log(`Success: ${successes.length}`);
        console.log(`Failed: ${failures.length}`);

        // We EXPECT some failures in a true stress test, but we want to see WHAT failed.
        if (failures.length > 0) {
            console.log('Sample Errors:', failures.slice(0, 3).map(f => f.error));
        }

        // Pass if at least 50% survived (Resilience check)
        expect(successes.length / results.length).toBeGreaterThan(0.5);
    });
});
