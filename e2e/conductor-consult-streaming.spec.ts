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

        // Firebase Vertex AI and Gemini model calls.
        await page.route(/.*(firebasevertexai|generativelanguage)\.googleapis\.com.*/, async (route) => {
            const url = route.request().url();
            const postData = route.request().postData() || '';
            const isStream = url.includes('streamGenerateContent');
            // Discriminate ONLY on the unique delegated task — the Conductor's own
            // request also contains "marketing" (it's in the valid-agent list), which
            // would otherwise misclassify the Conductor turn as the specialist.
            const isMarketing = postData.includes('Draft launch copy');

            if (isMarketing) {
                // Specialist streams its reply in chunks (so the UI grows progressively).
                if (isStream) {
                    await route.fulfill({
                        status: 200,
                        contentType: 'text/event-stream',
                        body: sse(REPLY_CHUNKS.map((t) => ({ text: t }))),
                    });
                } else {
                    await route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: SPECIALIST_REPLY }], role: 'model' } }] }),
                    });
                }
                return;
            }

            // Conductor: emit a consult_specialist tool call targeting marketing.
            const conductorParts = [
                { text: 'Routing to the marketing specialist.' },
                { functionCall: { name: 'consult_specialist', args: { targetAgentId: 'marketing', task: 'Draft launch copy' } } },
            ];
            if (isStream) {
                await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(conductorParts) });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ candidates: [{ content: { parts: conductorParts, role: 'model' } }] }),
                });
            }
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

        await expect(page.getByText(SPECIALIST_REPLY, { exact: false })).toBeVisible({ timeout: 25_000 });
        await page.screenshot({ path: 'test-results/conductor-consult-streaming.png', fullPage: true });
    });
});
