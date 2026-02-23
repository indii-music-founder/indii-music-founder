import { test, expect } from '@playwright/test';

/**
 * Autonomous Distribution Loop Interaction Test
 * 
 * Verifies:
 * 1. Proactive detection of finalized assets by AssetObserver.
 * 2. Agent Zero's proactive suggestion for distribution.
 * 3. Multi-agent relay trigger (Legal -> Brand -> Distribution).
 */
test.describe('Autonomous Distribution Loop', () => {
    test('should trigger proactive distribution handover on asset finalization', async ({ page }) => {
        // 1. Setup: Land on Dashboard and Mock Auth
        await page.waitForTimeout(2000); // Wait for Vite server to be stable
        await page.goto('http://localhost:4242/', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForLoadState('domcontentloaded');

        // Robust Auth Bypass
        await page.waitForFunction(() => !!(window as any).useStore);
        await page.evaluate(() => {
            const mockUser = {
                uid: 'test-user-dist',
                email: 'dist-test@example.com',
                displayName: 'Dist Tester',
                emailVerified: true,
                isAnonymous: false,
                metadata: {},
                providerData: [],
                refreshToken: '',
                tenantId: null,
                delete: async () => { },
                getIdToken: async () => 'mock-token',
                getIdTokenResult: async () => ({ token: 'mock-token' } as any),
                reload: async () => { },
                toJSON: () => ({}),
                phoneNumber: null,
                photoURL: null
            };

            // @ts-expect-error - Direct state manipulation
            window.useStore.setState({
                initializeAuthListener: () => () => { },
                user: mockUser,
                authLoading: false,
                currentOrganizationId: 'test-org-1'
            });
        });
        await page.waitForTimeout(1000);

        // 2. Navigate to Creative Studio
        const creativeBtn = page.getByRole('button', { name: 'Creative Director' });
        if (await creativeBtn.isVisible()) {
            await creativeBtn.click();
        } else {
            await page.locator('button[title="Creative Director"]').click();
        }

        // 3. Simulate an ASSET_FINALIZED event
        // This simulates AssetObserver detecting a new asset in history
        await page.evaluate(() => {
            // First, ensure events are available
            if ((window as any).events) {
                const mockAsset = {
                    id: 'finalized-asset-' + Date.now(),
                    type: 'image',
                    url: 'https://firebasestorage.googleapis.com/v0/b/mock-bucket/o/assets%2Ftest.jpg?alt=media',
                    prompt: 'A futuristic distribution hub, high-tech, neon lights',
                    timestamp: Date.now(),
                    origin: 'generated',
                    orgId: 'test-org-1'
                };
                (window as any).events.emit('ASSET_FINALIZED', { item: mockAsset });
            }
        });

        // 4. Open Agent Window and wait for proactive suggestion
        await page.getByRole('button', { name: 'indii', exact: true }).click();

        // Wait for Agent Zero to respond to the finalized asset
        // It should suggest moving to Distribution/Publishing
        const agentMessage = page.getByTestId('agent-message');
        await expect(agentMessage.last()).toContainText(/distribution|package|DDEX/i);

        // 5. User confirms with "Ship It"
        const agentInput = page.getByPlaceholder('Describe your task, drop files, or take a picture...');
        await agentInput.fill('Ship it!');
        await page.locator('button:has(svg.lucide-arrow-right)').click();

        // 6. Verify Relay Triggers
        // Agent Zero should now announce the relay status (Legal OK, Brand OK, etc.)
        // This is handled by triggerDistributionRelay in AgentZeroService
        await expect(agentMessage.last()).toContainText(/Relay Status/i);
        await expect(agentMessage.last()).toContainText(/Legal/i);
        await expect(agentMessage.last()).toContainText(/Brand/i);
    });
});
