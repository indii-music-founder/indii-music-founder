import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { typesafeApiKey } from '../../config/secrets';
import {
    createTypesafeClient,
    TypesafeClientError,
    TYPESAFE_MODEL_PATTERN,
    TYPESAFE_MAX_QUESTIONS,
    TYPESAFE_MAX_STATE_CHARS,
} from './typesafeClient';

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
 *
 * Transport lives in ./typesafeClient (shared with server-side audit workers).
 * This callable keeps the validation and HttpsError policy mapping.
 */

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
        if (questionCount === 0 || questionCount > TYPESAFE_MAX_QUESTIONS) {
            throw new HttpsError('invalid-argument', `questions must contain 1–${TYPESAFE_MAX_QUESTIONS} entries.`);
        }

        const stateJson = JSON.stringify(input.state);
        if (stateJson.length > TYPESAFE_MAX_STATE_CHARS) {
            throw new HttpsError('invalid-argument', `state exceeds the ${TYPESAFE_MAX_STATE_CHARS} character budget.`);
        }

        let model: string | undefined;
        if (typeof input.model === 'string') {
            // Truthful capability: an unknown model name is rejected, never
            // silently substituted with the default.
            if (!TYPESAFE_MODEL_PATTERN.test(input.model)) {
                throw new HttpsError('invalid-argument', `Unknown model: ${input.model}.`);
            }
            model = input.model;
        }
        const apiKey = typesafeApiKey.value();
        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'TypeSafe judgments are not configured.');
        }

        const client = createTypesafeClient({ apiKey, ...(model ? { model } : {}) });

        try {
            const result = await client.judge({ state: input.state, questions: input.questions });
            return { answers: result.answers };
        } catch (err: unknown) {
            if (err instanceof TypesafeClientError) {
                console.error(`[typesafeJudge] upstream ${err.kind}${err.status ? ` ${err.status}` : ''}: ${err.message}`);
                switch (err.kind) {
                    case 'unreachable':
                    case 'timeout':
                        throw new HttpsError('unavailable', 'TypeSafe judgment upstream is unreachable.');
                    case 'rate_limited':
                        throw new HttpsError('resource-exhausted', 'TypeSafe judgment rate limited.');
                    case 'credentials':
                        throw new HttpsError('failed-precondition', 'TypeSafe judgment credentials rejected.');
                    case 'upstream':
                    case 'shape':
                        throw new HttpsError('internal', 'TypeSafe judgment upstream error.');
                }
            }
            throw err;
        }
    },
);
