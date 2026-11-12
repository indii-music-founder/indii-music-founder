import { isVerifiedOwnerContinuityCaller } from '../security/ownerQuotaContinuity';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { typesafeApiKey, arcjetKey } from '../../config/secrets';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../security/arcjet';
import { enforceRateLimit, RATE_LIMITS } from '../../lib/rateLimit';
import { recordUsage } from '../creative/gateway';
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
        // Browser preflights cannot satisfy Cloud Run IAM authentication.
        // The callable still requires App Check and a verified Firebase user.
        invoker: 'public',
        enforceAppCheck: false,
        memory: '512MiB',
        cpu: 'gcf_gen1',
        concurrency: 1,
        timeoutSeconds: 30,
        secrets: [typesafeApiKey, arcjetKey],
    },
    async (request) => {
        validateAppCheckV2(request);
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required.');
        if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
        }
        if (!request.auth.token.email_verified) {
            throw new HttpsError('permission-denied', 'Verify your email to use AI judgments.');
        }
        if (request.rawRequest) {
            const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
                userId: request.auth.uid,
                policy: 'verified-free',
                operationId: `typesafe-judge:${request.auth.uid}`,
                ownerQuotaContinuity: isVerifiedOwnerContinuityCaller(request.auth.token),
            });
            if (!protection.allowed) {
                const code = protection.status === 429 ? 'resource-exhausted'
                    : protection.status === 403 ? 'permission-denied' : 'unavailable';
                throw new HttpsError(code, protection.message);
            }
        }

        await enforceRateLimit(request.auth.uid, 'typesafeJudge', RATE_LIMITS.generation);

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

        let stateJson: string;
        try {
            stateJson = JSON.stringify(input.state);
        } catch {
            throw new HttpsError('invalid-argument', 'state must be serializable.');
        }
        if (!stateJson || stateJson.length > TYPESAFE_MAX_STATE_CHARS) {
            throw new HttpsError('invalid-argument', `state exceeds the ${TYPESAFE_MAX_STATE_CHARS} character budget.`);
        }

        let model: string | undefined;
        if (input.model !== undefined && typeof input.model !== 'string') {
            throw new HttpsError('invalid-argument', 'model must be a TypeSafe model name.');
        }
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
            const totalTokens = (result.inputTokens || 0) + (result.outputTokens || 0);
            if (totalTokens > 0) {
                void recordUsage(request.auth.uid, 'chat_tokens', totalTokens, 'typesafe-judge');
            }
            return {
                answers: result.answers,
                ...(result.requestId !== undefined ? { requestId: result.requestId } : {}),
            };
        } catch (err: unknown) {
            if (err instanceof TypesafeClientError) {
                if (err.kind === 'input') throw new HttpsError('invalid-argument', err.message);
                console.error(`[typesafeJudge] upstream ${err.kind}${err.status ? ` ${err.status}` : ''}: ${err.message}`);
                switch (err.kind) {
                    case 'timeout':
                        throw new HttpsError('deadline-exceeded', 'TypeSafe judgment timed out.');
                    case 'unreachable':
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
