import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { typesafeApiKey } from '../../config/secrets';

/**
 * typesafeJudge — server-side proxy for the TypeSafe System One API (ISSUE-1442 pilot).
 *
 * The TYPESAFE_API_KEY is a true secret and must never reach the renderer
 * (API Credentials Policy). Renderer judgments (e.g. the transient-error Noul
 * in AgentLoopService) call this callable with { state, questions } and get
 * the TypeSafe answers object back verbatim.
 *
 * Judgments defined in the renderer's single reviewable constants file:
 * packages/renderer/src/config/typesafeJudgments.ts
 */

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_MODEL = 'jev-latest';
const MODEL_PATTERN = /^jev-[a-z0-9.-]+$/;
const MAX_STATE_CHARS = 64_000;
const MAX_QUESTIONS = 20;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const typesafeJudge = onCall(
    {
        region: 'us-central1',
        cors: true,
        enforceAppCheck: true,
        memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
        timeoutSeconds: 30,
        secrets: [typesafeApiKey],
    },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required.');
        if (!request.auth.token.email_verified) {
            throw new HttpsError('permission-denied', 'Verify your email to use AI judgments.');
        }

        const input = (request.data ?? {}) as {
            state?: unknown;
            questions?: unknown;
            model?: unknown;
        };

        if (!isPlainObject(input.state) || !isPlainObject(input.questions)) {
            throw new HttpsError('invalid-argument', 'state and questions must be objects.');
        }
        const questionCount = Object.keys(input.questions).length;
        if (questionCount === 0 || questionCount > MAX_QUESTIONS) {
            throw new HttpsError('invalid-argument', `questions must contain 1–${MAX_QUESTIONS} entries.`);
        }

        const stateJson = JSON.stringify(input.state);
        if (stateJson.length > MAX_STATE_CHARS) {
            throw new HttpsError('invalid-argument', `state exceeds the ${MAX_STATE_CHARS} character budget.`);
        }

        let model = DEFAULT_MODEL;
        if (typeof input.model === 'string') {
            // Truthful capability: an unknown model name is rejected, never
            // silently substituted with the default.
            if (!MODEL_PATTERN.test(input.model)) {
                throw new HttpsError('invalid-argument', `Unknown model: ${input.model}.`);
            }
            model = input.model;
        }
        const apiKey = typesafeApiKey.value();
        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'TypeSafe judgments are not configured.');
        }

        let upstream: Response;
        try {
            upstream = await fetch(TYPESAFE_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ model, state: input.state, questions: input.questions }),
            });
        } catch (err: unknown) {
            console.error('[typesafeJudge] upstream fetch failed:', err instanceof Error ? err.message : err);
            throw new HttpsError('unavailable', 'TypeSafe judgment upstream is unreachable.');
        }

        if (!upstream.ok) {
            const detail = await upstream.text().catch(() => '');
            console.error(`[typesafeJudge] upstream ${upstream.status}: ${detail.slice(0, 300)}`);
            if (upstream.status === 429) {
                throw new HttpsError('resource-exhausted', 'TypeSafe judgment rate limited.');
            }
            if (upstream.status === 401 || upstream.status === 403) {
                throw new HttpsError('failed-precondition', 'TypeSafe judgment credentials rejected.');
            }
            throw new HttpsError('internal', 'TypeSafe judgment upstream error.');
        }

        const body = (await upstream.json().catch(() => null)) as unknown;
        if (!isPlainObject(body) || !isPlainObject(body.answers)) {
            throw new HttpsError('internal', 'TypeSafe judgment returned an unexpected shape.');
        }

        return { answers: body.answers };
    },
);
