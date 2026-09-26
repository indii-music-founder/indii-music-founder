import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createTypesafeClient,
    TypesafeClientError,
    TYPESAFE_DEFAULT_MODEL,
} from './typesafeClient.js';

const okResponse = (body: unknown, headers: Record<string, string> = {}) =>
    ({
        ok: true,
        status: 200,
        headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
        json: async () => body,
        text: async () => JSON.stringify(body),
    }) as unknown as Response;

const errorResponse = (status: number, text = '') =>
    ({
        ok: false,
        status,
        headers: { get: () => null },
        json: async () => { throw new Error('no body'); },
        text: async () => text,
    }) as unknown as Response;

describe('typesafeClient (server-side System One transport)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('posts { model, state, questions } to the System One endpoint and returns answers verbatim', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(okResponse(
            { answers: { transient: 0.9 }, usage: { input_tokens: 11, output_tokens: 7 } },
            { 'x-typesafe-request-id': 'req-42' },
        ));
        const client = createTypesafeClient({ apiKey: ' key ', fetchImpl: fetchImpl as unknown as typeof fetch });

        const result = await client.judge({ state: { a: 1 }, questions: { transient: { type: 'noul' } } });

        expect(result.answers).toEqual({ transient: 0.9 });
        expect(result.requestId).toBe('req-42');
        expect(result.inputTokens).toBe(11);
        expect(result.outputTokens).toBe(7);
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://api.typesafe.ai/v1/systemone');
        expect(JSON.parse(String(init.body))).toEqual({
            model: TYPESAFE_DEFAULT_MODEL,
            state: { a: 1 },
            questions: { transient: { type: 'noul' } },
        });
        expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer key');
    });

    it('maps upstream statuses to failure kinds', async () => {
        const rateLimited = createTypesafeClient({ apiKey: 'k', fetchImpl: (async () => errorResponse(429)) as unknown as typeof fetch });
        await expect(rateLimited.judge({ state: {}, questions: { q: { type: 'noul' } } }))
            .rejects.toMatchObject({ kind: 'rate_limited', status: 429 });

        const badCreds = createTypesafeClient({ apiKey: 'k', fetchImpl: (async () => errorResponse(401)) as unknown as typeof fetch });
        await expect(badCreds.judge({ state: {}, questions: { q: { type: 'noul' } } }))
            .rejects.toMatchObject({ kind: 'credentials' });

        const boom = createTypesafeClient({ apiKey: 'k', fetchImpl: (async () => errorResponse(500, 'kaboom')) as unknown as typeof fetch });
        await expect(boom.judge({ state: {}, questions: { q: { type: 'noul' } } }))
            .rejects.toMatchObject({ kind: 'upstream' });
    });

    it('maps network failures to unreachable and aborts to timeout', async () => {
        const unreachable = createTypesafeClient({
            apiKey: 'k',
            fetchImpl: (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch,
        });
        await expect(unreachable.judge({ state: {}, questions: { q: { type: 'noul' } } }))
            .rejects.toMatchObject({ kind: 'unreachable' });

        const aborting = createTypesafeClient({
            apiKey: 'k',
            timeoutMs: 5,
            fetchImpl: (async (_input: unknown, init?: RequestInit) => {
                // Simulate the transport honoring the abort signal.
                return await new Promise<Response>((_, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        const err = new Error('aborted');
                        err.name = 'AbortError';
                        reject(err);
                    });
                });
            }) as unknown as typeof fetch,
        });
        await expect(aborting.judge({ state: {}, questions: { q: { type: 'noul' } } }))
            .rejects.toMatchObject({ kind: 'timeout' });
    });

    it('rejects unexpected response shapes and empty/invalid configs', async () => {
        const badShape = createTypesafeClient({ apiKey: 'k', fetchImpl: (async () => okResponse({ nope: true })) as unknown as typeof fetch });
        await expect(badShape.judge({ state: {}, questions: { q: { type: 'noul' } } }))
            .rejects.toMatchObject({ kind: 'shape' });

        expect(() => createTypesafeClient({ apiKey: '   ' })).toThrow(TypesafeClientError);
        expect(() => createTypesafeClient({ apiKey: 'k', model: 'gpt-4o' })).toThrow(/Unknown TypeSafe model/);
        expect(() => createTypesafeClient({ apiKey: 'k', timeoutMs: 0 })).toThrow(/timeout/);
    });

    it('enforces question bounds at the transport boundary', async () => {
        const client = createTypesafeClient({ apiKey: 'k', fetchImpl: vi.fn() as unknown as typeof fetch });
        await expect(client.judge({ state: {}, questions: {} })).rejects.toMatchObject({ kind: 'shape' });
    });
});
