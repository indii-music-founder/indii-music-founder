/**
 * typesafeJudge callable tests (ISSUE-1442 pilot).
 *
 * The proxy is the security boundary for the TYPESAFE_API_KEY: it must
 * authenticate, validate and cap the payload, forward verbatim to the
 * TypeSafe HTTP API with the bearer token, and map upstream failures to
 * HttpsError without leaking the key.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    onCall: vi.fn((_options: unknown, handler: unknown) => handler),
    fetch: vi.fn(),
    apiKeyValue: vi.fn(() => 'sk-test-key'),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: mocks.onCall,
    HttpsError: class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    },
}));

vi.mock('../../config/secrets', () => ({
    typesafeApiKey: { value: () => mocks.apiKeyValue() },
}));

import { typesafeJudge } from './typesafeJudge';

// Root-tsconfig types the onCall product with a 2-param callable signature;
// the handler under test takes exactly one request argument.
const callJudge = (data: unknown, auth?: unknown) =>
    (typesafeJudge as unknown as (req: unknown) => Promise<unknown>)(makeRequest(data, auth));

const AUTHED_AUTH = { uid: 'artist-1', token: { email_verified: true } };

function makeRequest(data: unknown, auth: unknown = AUTHED_AUTH) {
    return { auth, data } as never;
}

describe('typesafeJudge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks wipes hoisted implementations in Vitest 4 — re-arm them.
        mocks.apiKeyValue.mockReturnValue('sk-test-key');
        global.fetch = mocks.fetch as unknown as typeof global.fetch;
        mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ answers: { transient: 0.9 } }), { status: 200 }));
    });

    it('rejects unauthenticated calls', async () => {
        await expect(callJudge(validPayload(), null)).rejects.toMatchObject({ code: 'unauthenticated' });
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it('rejects malformed payloads without calling upstream', async () => {
        await expect(callJudge({ state: 'not-an-object', questions: {} })).rejects.toMatchObject({ code: 'invalid-argument' });
        await expect(callJudge({ state: {}, questions: {} })).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it('rejects state beyond the character budget', async () => {
        const big = { blob: 'x'.repeat(70_000) };
        await expect(callJudge({ state: big, questions: { q: validQuestion() } }))
            .rejects.toMatchObject({ code: 'invalid-argument' });
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it('forwards the payload verbatim with the bearer token and returns the answers', async () => {
        const result = await callJudge(validPayload());

        expect(mocks.fetch).toHaveBeenCalledWith(
            'https://api.typesafe.ai/v1/systemone',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ Authorization: 'Bearer sk-test-key' }),
            }),
        );
        const body = JSON.parse((mocks.fetch.mock.calls[0]?.[1] as RequestInit).body as string);
        expect(body.model).toBe('jev-latest');
        expect(body.state).toEqual(validPayload().state);
        expect(result).toEqual({ answers: { transient: 0.9 } });
    });

    it('rejects an unknown model string', async () => {
        await expect(callJudge({ ...validPayload(), model: 'not-jev' }))
            .rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('maps upstream 429 to resource-exhausted', async () => {
        mocks.fetch.mockResolvedValue(new Response('rate limited', { status: 429 }));
        await expect(callJudge(validPayload())).rejects.toMatchObject({ code: 'resource-exhausted' });
    });

    it('maps upstream auth rejection to failed-precondition', async () => {
        mocks.fetch.mockResolvedValue(new Response('bad key', { status: 401 }));
        await expect(callJudge(validPayload())).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('maps other upstream errors to internal', async () => {
        mocks.fetch.mockResolvedValue(new Response('boom', { status: 500 }));
        await expect(callJudge(validPayload())).rejects.toMatchObject({ code: 'internal' });
    });

    it('reports failed-precondition when the API key is not configured', async () => {
        mocks.apiKeyValue.mockReturnValue('');
        await expect(callJudge(validPayload())).rejects.toMatchObject({ code: 'failed-precondition' });
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it('rejects an upstream response without an answers object', async () => {
        mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
        await expect(callJudge(validPayload())).rejects.toMatchObject({ code: 'internal' });
    });
});

function validQuestion() {
    return {
        type: 'noul',
        instructions: 'Is this failure transient?',
        criteria: { true: 'Transient.', false: 'Persistent.' },
    };
}

function validPayload() {
    return {
        state: { errorMessage: 'ETIMEDOUT', errorName: 'Error', heuristicVerdict: true },
        questions: { transient: validQuestion() },
    };
}
