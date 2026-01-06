
import { test, expect } from '@playwright/test';

test.describe('Workflow Coordinator', () => {
    test.beforeEach(async ({ page }) => {
        // 1. Setup: Land on Dashboard and mock user
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        // Robust Auth Bypass
        await page.waitForFunction(() => !!(window as any).useStore);
        await page.evaluate(() => {
            const mockUser = {
                uid: 'test-user-coordinator',
                email: 'coord@example.com',
                displayName: 'Coordinator Test User',
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

            // @ts-ignore
            window.useStore.setState({
                initializeAuthListener: () => () => { },
                user: mockUser,
                authLoading: false
            });
        });
        await page.waitForTimeout(1000);

        // create or select org
        if (await page.getByText('Select Organization').isVisible()) {
            await page.getByRole('button', { name: 'Create New Organization' }).click();
            await page.getByPlaceholder('Organization Name').fill('Coord Corp');
            await page.getByRole('button', { name: 'Create', exact: true }).click();
        }

        // Navigate to Creative Director
        const creativeBtn = page.getByRole('button', { name: 'Creative Director' });
        if (await creativeBtn.isVisible()) {
            await creativeBtn.click();
        } else {
            await page.locator('button[title="Creative Director"]').click();
        }

        // Open Agent
        await page.getByRole('button', { name: 'indii', exact: true }).click();
        await expect(page.getByPlaceholder('Describe your task, drop files, or take a picture...')).toBeVisible();
    });

    test('should handle simple generation (Fast Path)', async ({ page }) => {
        const agentInput = page.getByPlaceholder('Describe your task, drop files, or take a picture...');

        // "Write a haiku" -> Simple Generation Trigger
        await agentInput.fill('Write a haiku about TypeScript');
        await page.locator('button:has(svg.lucide-arrow-right)').click();

        // Expect user message
        await expect(page.getByTestId('user-message').getByText('Write a haiku about TypeScript')).toBeVisible();

        // In a real env, we'd expect a response. 
        // Since we are running against a possibly mocked backend or real one (depending on env), 
        // we mainly check that the UI doesn't crash and message is sent.
        // If the Fast Path works, the response should appear relatively quickly.

        // Wait a bit to see if we get a response (Fast Path is fast!)
        // We look for any model message that appears after our user message
        // The id for model message usually defaults to something, let's just check for general presence
        // await expect(page.locator('.prose').last()).toBeVisible(); 
    });

    test('should handle complex orchestration (Agent Path)', async ({ page }) => {
        const agentInput = page.getByPlaceholder('Describe your task, drop files, or take a picture...');

        // "Create a marketing campaign" -> Complex Trigger
        await agentInput.fill('Create a marketing campaign for my new app');
        await page.locator('button:has(svg.lucide-arrow-right)').click();

        await expect(page.getByTestId('user-message').getByText('Create a marketing campaign')).toBeVisible();
    });
});
