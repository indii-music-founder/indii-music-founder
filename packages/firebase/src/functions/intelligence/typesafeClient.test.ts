import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createTypesafeClient,
    TypesafeClientError,
    TYPESAFE_DEFAULT_MODEL,
    TYPESAFE_MAX_STATE_CHARS,
    TYPESAFE_MAX_QUESTION_CHARS,
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

    it('keeps upstream error bodies out of diagnostic messages', async () => {
        const client = createTypesafeClient({
            apiKey: 'synthetic-key',
            fetchImpl: async () => new Response('private request text', { status: 500 }),
        });
        await expect(client.judge({ state: {}, questions: { check: {} } })).rejects.toMatchObject({
            kind: 'upstream',
            status: 500,
            message: 'TypeSafe judgment upstream error (HTTP 500).',
        });
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
        await expect(client.judge({ state: {}, questions: {} })).rejects.toMatchObject({ kind: 'input' });
    });

    it.each(['json', 'text'] as const)('times out while reading a stalled %s body', async (bodyMethod) => {
        vi.useFakeTimers();
        try {
            const fetchImpl = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve({
                ok: bodyMethod === 'json',
                status: bodyMethod === 'json' ? 200 : 500,
                headers: { get: () => 'req-stalled' },
                json: () => new Promise<unknown>(() => {}),
                text: () => new Promise<string>(() => {}),
            } as unknown as Response));
            const client = createTypesafeClient({ apiKey: 'k', timeoutMs: 25, fetchImpl: fetchImpl as unknown as typeof fetch });
            const pending = client.judge({ state: {}, questions: { q: { type: 'noul' } } });
            const rejection = expect(pending).rejects.toMatchObject({ kind: 'timeout', requestId: 'req-stalled' });

            await vi.advanceTimersByTimeAsync(25);
            await rejection;
            expect((fetchImpl.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('rejects oversized or unserializable input before transport', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(okResponse({ answers: { q: { noul: 0.5 } } }));
        const client = createTypesafeClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
        const questions = { q: { type: 'noul' } };
        const textAtLimit = 'x'.repeat(TYPESAFE_MAX_STATE_CHARS - JSON.stringify({ text: '' }).length);

        await client.judge({ state: { text: textAtLimit }, questions });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        await expect(client.judge({ state: { text: `${textAtLimit}x` }, questions }))
            .rejects.toMatchObject({ kind: 'input' });
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        await expect(client.judge({ state: circular, questions })).rejects.toMatchObject({ kind: 'input' });
        await expect(client.judge({ state: {}, questions: { q: circular } })).rejects.toMatchObject({ kind: 'input' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('bounds the serialized question payload before transport', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(okResponse({ answers: {} }));
        const client = createTypesafeClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
        const promptAtLimit = 'x'.repeat(TYPESAFE_MAX_QUESTION_CHARS - JSON.stringify({ q: { prompt: '' } }).length);

        await client.judge({ state: {}, questions: { q: { prompt: promptAtLimit } } });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        await expect(client.judge({ state: {}, questions: { q: { prompt: `${promptAtLimit}x` } } }))
            .rejects.toMatchObject({ kind: 'input' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('sends only the state serialization that passed the size check', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(okResponse({ answers: { q: { noul: 0.5 } } }));
        const client = createTypesafeClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
        let serializations = 0;
        const changingState = { toJSON: () => {
            serializations += 1;
            return serializations === 1 ? { title: 'safe' } : { text: 'x'.repeat(TYPESAFE_MAX_STATE_CHARS) };
        } };

        await client.judge({ state: changingState, questions: { q: { type: 'noul' } } });
        expect(serializations).toBe(1);
        expect(JSON.parse(String((fetchImpl.mock.calls[0][1] as RequestInit).body)).state).toEqual({ title: 'safe' });
    });

    it('rejects state that serializes to a non-object', async () => {
        const fetchImpl = vi.fn();
        const client = createTypesafeClient({ apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
        await expect(client.judge({ state: { toJSON: () => null }, questions: { q: { type: 'noul' } } }))
            .rejects.toMatchObject({ kind: 'input' });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('uses a valid per-call model override and rejects an invalid one before transport', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(okResponse({ answers: { q: { noul: 0.5 } } }));
        const client = createTypesafeClient({ apiKey: 'k', model: 'jev-latest', fetchImpl: fetchImpl as unknown as typeof fetch });
        const input = { state: {}, questions: { q: { type: 'noul' } } };

        await client.judge({ ...input, model: 'jev-1.13.0' });
        expect(JSON.parse(String((fetchImpl.mock.calls[0][1] as RequestInit).body)).model).toBe('jev-1.13.0');
        await expect(client.judge({ ...input, model: 'not-jev' })).rejects.toMatchObject({ kind: 'input' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('clears the deadline after a completed response', async () => {
        vi.useFakeTimers();
        try {
            const fetchImpl = vi.fn().mockResolvedValue(okResponse({ answers: { q: { noul: 0.5 } } }));
            const client = createTypesafeClient({ apiKey: 'k', timeoutMs: 25, fetchImpl: fetchImpl as unknown as typeof fetch });

            await client.judge({ state: {}, questions: { q: { type: 'noul' } } });
            const signal = (fetchImpl.mock.calls[0][1] as RequestInit).signal;
            await vi.advanceTimersByTimeAsync(25);
            expect(signal?.aborted).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });
});
