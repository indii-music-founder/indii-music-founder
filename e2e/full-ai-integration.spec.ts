
import { test, expect } from '@playwright/test';

test.describe('Full AI Integration E2E', () => {

    test.beforeEach(async ({ page }) => {
        // 1. Setup

        // Listen for console logs
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error(`[BROWSER ERROR] ${msg.text()}`);
            } else {
                console.log(`[BROWSER LOG] ${msg.text()}`);
            }
        });

        page.on('pageerror', err => {
            console.error(`[BROWSER UNCAUGHT EXCEPTION] ${err.message}`);
        });

        await page.goto('/');

        // Wait for potential redirect or load
        await page.waitForLoadState('domcontentloaded');

        // Check where we are.
        try {
            // Robust Auth Bypass: Wait for store and inject user immediately
            await page.waitForFunction(() => !!(window as any).useStore);
            await page.evaluate(() => {
                const mockUser = {
                    uid: 'test-user',
                    email: 'test@example.com',
                    displayName: 'Test User',
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

                // Override listener to prevent Firebase from clearing our mock
                // And inject user
                // @ts-expect-error - Directly manipulating window store for test environment
                window.useStore.setState({
                    initializeAuthListener: () => () => { }, // No-op
                    user: mockUser,
                    authLoading: false
                });
            });
            await page.waitForTimeout(1000); // Allow React to re-render

            const selectOrg = page.getByText('Select Organization');
            try {
                await selectOrg.waitFor({ state: 'visible', timeout: 5000 });
                if (await selectOrg.isVisible()) {
                    console.log('Select Organization found, clicking first org...');
                    await page.locator('.org-card').first().click();
                }
            } catch (e) {
                // Ignore timeout
            }
        } catch (e) {
            console.log('Auth check failed.', e);
        }

        // Verify Sidebar is present (Dashboard loaded)
        try {
            // Check for a key navigation element instead of the collapsible header
            const navItem = page.locator('button[title="Creative Director"]').or(page.getByRole('button', { name: "Creative Director" }));
            await expect(navItem.first()).toBeVisible({ timeout: 10000 });
        } catch (e) {
            console.log('Dashboard navigation not found. Dumping content:', await page.content());
            throw e;
        }
    });

    test('Creative Director: Generate Image Flow', async ({ page }) => {
        // Navigate
        const btn = page.locator('button').filter({ hasText: 'Creative Director' }).first();
        const btnByTitle = page.locator('button[title="Creative Director"]');

        if (await btn.isVisible()) {
            await btn.click();
        } else {
            await btnByTitle.click();
        }

        // Open Agent (Command Bar is always visible, but Agent Overlay needs toggle)
        const agentBtn = page.locator('button').filter({ hasText: /indii|Agent/ }).first();
        if (await agentBtn.isVisible()) {
            await agentBtn.click();
        }

        // Command Bar Input
        const placeholder = "Describe your task, drop files, or take a picture...";
        const agentInput = page.getByPlaceholder(placeholder);
        await expect(agentInput).toBeVisible();

        // Send Command
        await agentInput.fill('Generate a cinematic poster for a sci-fi movie.');
        await page.locator('button:has(svg.lucide-arrow-right)').click(); // ArrowRight icon name

        // Verification
        await expect(page.getByTestId('user-message').getByText('Generate a cinematic poster')).toBeVisible();
        // Wait for Agent Response (using testid)
        await expect(page.locator('[data-testid="agent-message"]').last()).toBeVisible({ timeout: 60000 });
    });

    test('Road Manager: Route Planning Flow', async ({ page }) => {
        const btn = page.locator('button').filter({ hasText: 'Road Manager' }).first();
        const btnByTitle = page.locator('button[title="Road Manager"]');
        if (await btn.isVisible()) await btn.click(); else await btnByTitle.click();

        // Open Agent
        const agentBtn = page.locator('button').filter({ hasText: /indii|Agent/ }).first();
        if (await agentBtn.isVisible()) {
            await agentBtn.click();
        }

        const placeholder = "Describe your task, drop files, or take a picture...";
        const agentInput = page.getByPlaceholder(placeholder);
        await agentInput.fill('Plan a tour route from Detroit to Chicago.');
        await page.locator('button:has(svg.lucide-arrow-right)').click();

        await expect(page.getByTestId('user-message').getByText('Plan a tour route')).toBeVisible();
        await expect(page.locator('[data-testid="agent-message"]').last()).toBeVisible({ timeout: 45000 });
    });

    test('Marketing Manager: Campaign Brief Flow', async ({ page }) => {
        const btn = page.locator('button').filter({ hasText: 'Marketing Department' }).first();
        const btnByTitle = page.locator('button[title="Marketing Department"]');
        if (await btn.isVisible()) await btn.click(); else await btnByTitle.click();

        // Open Agent
        const agentBtn = page.locator('button').filter({ hasText: /indii|Agent/ }).first();
        if (await agentBtn.isVisible()) {
            await agentBtn.click();
        }

        const placeholder = "Describe your task, drop files, or take a picture...";
        const agentInput = page.getByPlaceholder(placeholder);
        await agentInput.fill('Create a campaign brief for a new summer single "Sunburn".');
        await page.locator('button:has(svg.lucide-arrow-right)').click();

        await expect(page.getByTestId('user-message').getByText('Create a campaign brief')).toBeVisible();
        await expect(page.locator('[data-testid="agent-message"]').last()).toBeVisible({ timeout: 30000 });
    });

});
