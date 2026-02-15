import { test, expect } from '@playwright/test';

const STUDIO_URL = 'http://localhost:4242';

test.describe('Server-Side Stitching Workflow', () => {

    test('UI reflects stitching status', async ({ page }) => {
        // 0. Mock Electron API & Test Mode
        await page.addInitScript(() => {
            // @ts-expect-error - testing utility
            window.electronAPI = {
                getPlatform: async () => 'darwin',
                getAppVersion: async () => '0.0.0',
                // @ts-expect-error - testing utility
                auth: {
                    login: async () => { },
                    logout: async () => { },
                    onUserUpdate: (cb: any) => {
                        return () => { };
                    }
                },
                openExternal: async () => { }
            };
            // @ts-expect-error - testing utility
            window.__TEST_MODE__ = true;
        });

        // 1. Visit Studio
        await page.goto(STUDIO_URL);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000); // Allow initial redirects to settle

        // 2. Mock Auth and Navigate to Video Module
        await page.evaluate(() => {
            // @ts-expect-error - testing utility
            window.useStore.setState({
                isAuthenticated: true,
                isAuthReady: true,
                user: { uid: 'test-user', email: 'test@example.com' },
                userProfile: { bio: 'Verified Tester', role: 'admin' },
                currentModule: 'video', // Force Video Module
                currentOrganizationId: 'org-1',
                activeJobId: 'job-stitch-e2e', // Pre-set job ID to ensure component mounts subscription
            });
        });

        // 3. Verify Initial State
        // Wait for the VideoWorkflow component to mount and expose the store
        await page.waitForFunction(() => {
            // @ts-expect-error - testing utility
            return !!window.useVideoEditorStore;
        });

        // 4. Update Store to Stitching State
        await page.evaluate(() => {
            // @ts-expect-error - testing utility
            const store = window.useVideoEditorStore;
            store.getState().setJobId('job-stitch-e2e');
            store.getState().setStatus('stitching'); // Manually set status
        });

        // 5. Assert UI
        await expect(page.locator('text=Stitching Masterpiece...')).toBeVisible();
        await expect(page.locator('text=Finalizing your unified video')).toBeVisible();
    });
});
