import { test, expect } from './fixtures/auth';

/**
 * Conductor → Specialist consult, streamed into the live UI.
 *
 * Deterministically forces the Conductor to call `consult_specialist` (mocked
 * Gemini functionCall) targeting the marketing agent, which STREAMS a distinctive
 * reply back via SSE. Asserts the reply renders in the chat and captures a
 * screenshot artifact. The app uses the Firebase Vertex AI SDK
 * (firebasevertexai.googleapis.com), so we mock that host + App Check.
 *
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:4242 npx playwright test e2e/conductor-consult-streaming.spec.ts
 */

const SPECIALIST_REPLY = 'MARKETING_SPECIALIST_REPLY_42';
const REPLY_CHUNKS = ['MARKETING_', 'SPECIALIST_', 'REPLY_42'];

function sse(parts: Array<Record<string, unknown>>): string {
    return parts
        .map((p) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [p], role: 'model' } }] })}\r\n\r\n`)
        .join('');
}

test.describe('Conductor → Specialist consult (live UI)', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // App Check: hand back a dummy token so model calls proceed.
        await page.route('**content-firebaseappcheck.googleapis.com/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ token: 'e2e-fake-appcheck-token', ttl: '3600s' }),
            });
        });

        // Intercept backend-only generateContentStream Cloud Function calls.
        await page.route('**/generateContentStream', async (route) => {
            const postData = route.request().postData() || '';
            // Discriminate ONLY on the unique delegated task — the Conductor's own
            // request also contains "marketing" (it's in the valid-agent list), which
            // would otherwise misclassify the Conductor turn as the specialist.
            const isMarketing = postData.includes('Draft launch copy');

            if (isMarketing) {
                // Specialist streams its reply in chunks (so the UI grows progressively).
                const bodyLines = REPLY_CHUNKS.map(t => `data: ${JSON.stringify({ text: t })}\n`).join('');
                await route.fulfill({
                    status: 200,
                    contentType: 'text/event-stream',
                    body: bodyLines,
                });
                return;
            }

            // Conductor: emit a consult_specialist tool call targeting marketing.
            const conductorPayload = {
                text: 'Routing to the marketing specialist.',
                functionCalls: [{ name: 'consult_specialist', args: { targetAgentId: 'marketing', task: 'Draft launch copy' } }]
            };
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: `data: ${JSON.stringify(conductorPayload)}\n`,
            });
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#root', { timeout: 15_000 });
        await page.locator('[data-testid="dev-bypass-button"]').click({ timeout: 10_000 }).catch(() => { });
        await page.waitForSelector('[data-testid="main-prompt-input"]', { state: 'visible', timeout: 30_000 });
    });

    test('specialist reply renders in the chat', async ({ authedPage: page }) => {
        const input = page.locator('[data-testid="main-prompt-input"]').first();
        await input.waitFor({ state: 'visible', timeout: 15_000 });
        await input.click({ force: true });
        await input.fill('Help me launch my new album');
        await input.press('Enter');

        // Target the actual chat paragraph (not the system tool-call log span)
        await expect(page.locator('p').filter({ hasText: SPECIALIST_REPLY })).toBeVisible({ timeout: 25_000 });
        await page.screenshot({ path: 'test-results/conductor-consult-streaming.png', fullPage: true });
    });
});
