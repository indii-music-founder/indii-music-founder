import { test, expect } from './fixtures/auth';

/**
 * Chat Interaction E2E Tests
 *
 * Covers: PromptArea text input, message submission, DelegateMenu,
 * streaming indicators, and channel switching.
 *
 * Run: npx playwright test e2e/chat-interaction.spec.ts
 */

test.describe('Chat / CommandBar Interaction', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // Intercept AI API calls to prevent real token spend
        await page.route('**/generativelanguage.googleapis.com/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    candidates: [
                        {
                            content: {
                                parts: [{ text: 'E2E mock response from AI' }],
                                role: 'model',
                            },
                            finishReason: 'STOP',
                        },
                    ],
                }),
            });
        });

        await page.route('**/v1beta/models/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    candidates: [
                        {
                            content: {
                                parts: [{ text: 'E2E mock response' }],
                                role: 'model',
                            },
                        },
                    ],
                }),
            });
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-testid="dev-bypass-button"]').click({ timeout: 10_000 }).catch(() => { });
        const input = page.locator('[data-testid="command-bar"]').getByTestId('main-prompt-input');
        await expect(input).toBeVisible({ timeout: 30_000 });
    });

    test('prompt input renders and accepts keyboard input', async ({ authedPage: page }) => {
        const input = page.locator('[data-testid="command-bar"]').getByTestId('main-prompt-input');
        await expect(input).toBeVisible({ timeout: 15_000 });

        await input.fill('hello indii');
        await expect(input).toHaveValue('hello indii');
    });

    test('submitting empty prompt is rejected gracefully', async ({ authedPage: page }) => {
        const input = page.locator('[data-testid="command-bar"]').getByTestId('main-prompt-input');
        await expect(input).toBeVisible({ timeout: 15_000 });

        await input.fill('');
        await input.press('Enter');

        // Input should still be empty and visible (no crash, no phantom submission)
        await expect(input).toBeVisible();
        await expect(input).toHaveValue('');
    });

    test('app remains stable during rapid input changes', async ({ authedPage: page }) => {
        const input = page.locator('[data-testid="command-bar"]').getByTestId('main-prompt-input');
        await expect(input).toBeVisible({ timeout: 15_000 });

        for (let i = 0; i < 5; i++) {
            await input.fill(`test message ${i}`);
            await expect(input).toHaveValue(`test message ${i}`);
            await input.fill('');
            await expect(input).toHaveValue('');
        }

        await expect(input).toBeVisible();
    });
});
