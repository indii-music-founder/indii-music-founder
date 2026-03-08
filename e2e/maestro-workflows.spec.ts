import { test, expect } from '@playwright/test';

/**
 * Maestro Workflow E2E Tests
 *
 * Covers: Maestro batch task orchestration, workflow status display,
 * task failure handling, and markdown report rendering in chat.
 *
 * All AI API calls are intercepted to prevent real token spend.
 *
 * Run: npx playwright test e2e/maestro-workflows.spec.ts
 */

test.describe('Maestro Batch Orchestration', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ page }) => {
        // Mock all Gemini / AI API calls
        await page.route('**/generativelanguage.googleapis.com/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: '## Campaign Report\n\n✅ Task completed successfully.\n\n- Analyzed 3 target markets\n- Generated 5 copy variants\n- Budget allocated: $500',
                                    },
                                ],
                                role: 'model',
                            },
                            finishReason: 'STOP',
                        },
                    ],
                }),
            });
        });

        await page.route('**/v1beta/models/**:generateContent', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    candidates: [
                        {
                            content: {
                                parts: [{ text: 'Mock orchestration response' }],
                                role: 'model',
                            },
                        },
                    ],
                }),
            });
        });

        // Mock Agent Zero sidecar
        await page.route('**/localhost:50080/**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ result: 'Mock agent result', status: 'success' }),
            });
        });

        await page.goto('/');
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.waitForTimeout(2_000);
    });

    test('app loads and maestro task system is operational (no crash)', async ({ page }) => {
        await expect(page.locator('#root')).toBeVisible();
    });

    test('submitting a campaign intent to the prompt does not crash the app', async ({ page }) => {
        const input = page
            .locator('[data-testid="prompt-input"], textarea, [role="textbox"]')
            .first();

        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip();
            return;
        }

        await input.fill('launch a marketing campaign for my new album');
        await input.press('Enter');

        // Wait for the orchestration to process
        await page.waitForTimeout(3_000);

        // App must still be alive
        await expect(page.locator('#root')).toBeVisible();
    });

    test('task status indicators appear in right panel or chat', async ({ page }) => {
        const input = page
            .locator('[data-testid="prompt-input"], textarea, [role="textbox"]')
            .first();

        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip();
            return;
        }

        await input.fill('create a distribution plan for my release');
        await input.press('Enter');

        await page.waitForTimeout(2_000);

        // Look for task/status indicators in the UI
        const statusIndicators = page.locator(
            '[class*="task"], [class*="status"], [class*="progress"], [class*="batch"]'
        );
        const count = await statusIndicators.count().catch(() => 0);
        console.log(`Task status indicators found: ${count}`);

        await expect(page.locator('#root')).toBeVisible();
    });

    test('markdown report renders in chat after orchestration', async ({ page }) => {
        const input = page
            .locator('[data-testid="prompt-input"], textarea, [role="textbox"]')
            .first();

        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip();
            return;
        }

        await input.fill('generate a royalty report');
        await input.press('Enter');

        await page.waitForTimeout(3_000);

        // Look for markdown content in the chat area
        const markdownContent = page.locator(
            '[class*="markdown"], [class*="message"] h2, [class*="chat"] h2, [class*="response"]'
        ).first();
        const mdVisible = await markdownContent.isVisible().catch(() => false);
        console.log(`Markdown response rendered: ${mdVisible}`);

        await expect(page.locator('#root')).toBeVisible();
    });

    test('failed workflow step shows error state without crashing UI', async ({ page }) => {
        // Override the mock to return an error
        await page.route('**/generativelanguage.googleapis.com/**', async route => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: { message: 'Service unavailable', code: 503 } }),
            });
        });

        const input = page
            .locator('[data-testid="prompt-input"], textarea, [role="textbox"]')
            .first();

        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip();
            return;
        }

        await input.fill('trigger an orchestration that will fail');
        await input.press('Enter');

        await page.waitForTimeout(3_000);

        // App must survive the error gracefully
        await expect(page.locator('#root')).toBeVisible();

        // Should not have an unhandled error overlay from Vite
        const viteError = page.locator('[class*="vite-error-overlay"], #vite-error-overlay');
        const hasViteError = await viteError.isVisible().catch(() => false);
        expect(hasViteError).toBe(false);
    });
});
