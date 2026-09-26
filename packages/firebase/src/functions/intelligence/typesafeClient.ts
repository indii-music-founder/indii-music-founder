import { typesafeApiKey } from '../../config/secrets';

/**
 * typesafeClient — internal server-side transport for the TypeSafe System One
 * API (Post-Mastering Administrative Engine P2; plan §2.1).
 *
 * Extracted from the proven fetch patterns of `typesafeJudge.ts` (callable
 * proxy) and `TypeSafeEvidenceProvider.ts` (evaluation adapter). The Node SDK
 * stays OFF the functions runtime (known Node 20/22 cancellation defect — see
 * the evidence provider header), so every server consumer goes through this
 * module. The TYPESAFE_API_KEY is a true secret: it is resolved from the
 * `typesafeApiKey` defineSecret and must only be declared on server functions
 * (API Credentials Policy).
 *
 * Transport ONLY — input validation and policy mapping stay with callers.
 */

export const TYPESAFE_API_BASE_URL = 'https://api.typesafe.ai';
export const TYPESAFE_SYSTEMONE_PATH = '/v1/systemone';
export const TYPESAFE_DEFAULT_MODEL = 'jev-latest';
/** Truthful capability: unknown model names are rejected, never substituted. */
export const TYPESAFE_MODEL_PATTERN = /^jev-[a-z0-9.-]+$/;
export const TYPESAFE_MAX_QUESTIONS = 20;
export const TYPESAFE_MAX_STATE_CHARS = 64_000;
export const TYPESAFE_DEFAULT_TIMEOUT_MS = 20_000;

export type TypesafeFailureKind =
    | 'unreachable'
    | 'timeout'
    | 'rate_limited'
    | 'credentials'
    | 'upstream'
    | 'shape';

export class TypesafeClientError extends Error {
    constructor(
        public readonly kind: TypesafeFailureKind,
        message: string,
        public readonly status?: number,
        public readonly requestId?: string,
    ) {
        super(message);
        this.name = 'TypesafeClientError';
    }
}

export interface TypesafeJudgeInput {
    state: Record<string, unknown>;
    questions: Record<string, unknown>;
    model?: string;
}

export interface TypesafeJudgeResult {
    answers: Record<string, unknown>;
    requestId?: string;
    inputTokens?: number;
    outputTokens?: number;
}

export interface TypesafeClientConfig {
    apiKey: string;
    baseURL?: string;
    model?: string;
    timeoutMs?: number;
    /** Test seam — defaults to globalThis.fetch. */
    fetchImpl?: typeof fetch;
}

export interface TypesafeClient {
    readonly model: string;
    judge(input: TypesafeJudgeInput): Promise<TypesafeJudgeResult>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createTypesafeClient(config: TypesafeClientConfig): TypesafeClient {
    const apiKey = config.apiKey.trim();
    if (!apiKey) {
        throw new TypesafeClientError('credentials', 'TypeSafe client requires a non-empty API key.');
    }
    const baseURL = (config.baseURL ?? TYPESAFE_API_BASE_URL).replace(/\/+$/, '');
    const model = config.model?.trim() || TYPESAFE_DEFAULT_MODEL;
    if (!TYPESAFE_MODEL_PATTERN.test(model)) {
        throw new TypesafeClientError('shape', `Unknown TypeSafe model: ${model}.`);
    }
    const timeoutMs = config.timeoutMs ?? TYPESAFE_DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new TypesafeClientError('shape', 'TypeSafe client timeout must be a positive number.');
    }
    const fetchImpl = config.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));

    return {
        model,
        async judge(input: TypesafeJudgeInput): Promise<TypesafeJudgeResult> {
            if (!isPlainObject(input.state) || !isPlainObject(input.questions)) {
                throw new TypesafeClientError('shape', 'state and questions must be objects.');
            }
            const questionCount = Object.keys(input.questions).length;
            if (questionCount === 0 || questionCount > TYPESAFE_MAX_QUESTIONS) {
                throw new TypesafeClientError('shape', `questions must contain 1–${TYPESAFE_MAX_QUESTIONS} entries.`);
            }

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            let response: Response;
            try {
                response = await fetchImpl(`${baseURL}${TYPESAFE_SYSTEMONE_PATH}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({ model, state: input.state, questions: input.questions }),
                    signal: controller.signal,
                });
            } catch (err: unknown) {
                const aborted = err instanceof Error && err.name === 'AbortError';
                throw new TypesafeClientError(
                    aborted ? 'timeout' : 'unreachable',
                    aborted ? `TypeSafe judgment timed out after ${timeoutMs}ms.` : 'TypeSafe judgment upstream is unreachable.',
                );
            } finally {
                clearTimeout(timer);
            }

            const requestId = response.headers.get('x-typesafe-request-id') ?? undefined;

            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                if (response.status === 429) {
                    throw new TypesafeClientError('rate_limited', 'TypeSafe judgment rate limited.', response.status, requestId);
                }
                if (response.status === 401 || response.status === 403) {
                    throw new TypesafeClientError('credentials', 'TypeSafe judgment credentials rejected.', response.status, requestId);
                }
                throw new TypesafeClientError(
                    'upstream',
                    `TypeSafe judgment upstream error (HTTP ${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}.`,
                    response.status,
                    requestId,
                );
            }

            const body = (await response.json().catch(() => null)) as unknown;
            if (!isPlainObject(body) || !isPlainObject(body.answers)) {
                throw new TypesafeClientError('shape', 'TypeSafe judgment returned an unexpected shape.', response.status, requestId);
            }

            const usage = isPlainObject(body.usage) ? body.usage : {};
            const finite = (value: unknown): number | undefined =>
                typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

            return {
                answers: body.answers,
                requestId,
                inputTokens: finite(usage['input_tokens']),
                outputTokens: finite(usage['output_tokens']),
            };
        },
    };
}

/**
 * Secret-bound client for Cloud Function runtime use. Callers MUST declare
 * `secrets: [typesafeApiKey]` on their function for this to resolve.
 */
export function getServerTypesafeClient(timeoutMs?: number): TypesafeClient {
    return createTypesafeClient({ apiKey: typesafeApiKey.value() ?? '', timeoutMs });
}
