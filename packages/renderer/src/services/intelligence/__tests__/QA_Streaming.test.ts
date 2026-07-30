import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseIntelligenceService } from '../FirebaseIntelligenceService';

const mockGenerateContentStream = vi.fn();
const mockGenerateContent = vi.fn();

// Mock Firebase Service
vi.mock('@/services/firebase', () => ({
    getFirebaseAI: vi.fn(() => ({})),
    functions: {},
    ai: {},
    remoteConfig: {},
    db: {},
    auth: { currentUser: { uid: 'user-stream' } },
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    increment: vi.fn(),
    serverTimestamp: vi.fn(),
    collection: vi.fn()
}));

vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn(() => ({ asString: () => '' }))
}));

vi.mock('@/config/env', () => ({
    env: {
        VITE_API_KEY: '',
        apiKey: '',
        appCheckKey: 'mock-app-check-key',
        appCheckDebugToken: 'mock-debug-token'
    }
}));

vi.mock('../billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(undefined),
        trackUsage: vi.fn().mockResolvedValue(undefined)
    }
}));

// Raw Google client fallback must stay unused in renderer tests.
vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn(() => {
        throw new Error('Raw Google client fallback must not be constructed');
    })
}));

// Mock firebase/ai
vi.mock('firebase/ai', () => ({
    __esModule: true,
    getGenerativeModel: vi.fn(() => ({
        generateContentStream: mockGenerateContentStream,
        generateContent: mockGenerateContent
    })),
    Schema: {},
    Tool: {}
}));

describe('Streaming QA', () => {
    let service: FirebaseIntelligenceService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetch).mockResolvedValue(new Response(`${JSON.stringify({ text: 'Good' })}\n${JSON.stringify({ complete: true })}\n`));
        service = new FirebaseIntelligenceService();
    });

    it('should pass AbortSignal to the backend gateway', async () => {
        const controller = new AbortController();
        const signal = controller.signal;

        await service.generateContentStream('prompt', undefined, {}, undefined, undefined, { signal });

        const call = [...vi.mocked(fetch).mock.calls].reverse().find(([url]) => String(url).includes('generateContentStream'));
        expect(call?.[1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it('should read backend stream chunks', async () => {
        const { stream } = await service.generateContentStream('prompt');
        const reader = stream.getReader();

        const r1 = await reader.read();
        expect(r1.value?.text()).toBe('Good');

        const r2 = await reader.read();
        expect(r2.done).toBe(true);
    });

    it('rejects an EOF that lacks the backend billing-settlement frame', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(`${JSON.stringify({ text: 'partial' })}\n`));
        const { stream, response } = await service.generateContentStream('prompt');
        const failure = response.catch(error => error);
        const reader = stream.getReader();
        await expect(reader.read()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
        await expect(failure).resolves.toMatchObject({ code: 'NETWORK_ERROR' });
    });

    it('propagates caller abort to the in-flight backend fetch signal', async () => {
        const controller = new AbortController();
        let observedAbort = false;
        vi.mocked(fetch).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
            const signal = init?.signal as AbortSignal;
            signal.addEventListener('abort', () => {
                observedAbort = signal.aborted;
                reject(new DOMException('aborted', 'AbortError'));
            }, { once: true });
        }));
        const request = service.generateContentStream('prompt', undefined, {}, undefined, undefined, { signal: controller.signal });
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        controller.abort('caller cancelled');
        await expect(request).rejects.toBeDefined();
        expect(observedAbort).toBe(true);
    });

    it('preserves the typed specialist-unavailable contract and retry guidance', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
            error: {
                code: 'SPECIALIST_UNAVAILABLE',
                message: 'This specialist is temporarily unavailable. Your request was not processed by another model.',
                retryable: true,
                category: 'specialist_unavailable',
                nextActions: ['retry_later', 'select_qualified_specialist'],
            },
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        }));

        await expect((service as any).callBackendGenerateContentStream(
            [{ role: 'user', parts: [{ text: 'specialist-only prompt' }] }],
            'projects/148015878263/locations/us/endpoints/1720656532632240128',
            {},
            'agent-stream-op-1',
            { authorization: 'Bearer test-token', 'content-type': 'application/json', 'x-firebase-appcheck': 'test-app-check-token' },
        )).rejects.toMatchObject({
            code: 'SPECIALIST_UNAVAILABLE',
            message: 'This specialist is temporarily unavailable. Your request was not processed by another model.',
            details: {
                retryable: true,
                reason: 'specialist_unavailable',
                context: {
                    nextActions: ['retry_later', 'select_qualified_specialist'],
                },
            },
        });
    });

    it('does not automatically resubmit a specialist request after typed unavailability', async () => {
        vi.mocked(fetch).mockClear();
        vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
            error: {
                code: 'SPECIALIST_UNAVAILABLE',
                message: 'This specialist is temporarily unavailable. Your request was not processed by another model.',
                retryable: true,
                category: 'provider_outage',
                nextActions: ['retry_later', 'select_qualified_specialist'],
            },
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        }));

        await expect(service.generateContentStream(
            'specialist-only prompt',
            'projects/148015878263/locations/us/endpoints/1720656532632240128',
        )).rejects.toMatchObject({
            code: 'SPECIALIST_UNAVAILABLE',
        });

        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('preserves typed application capacity without resubmitting or claiming provider work', async () => {
        vi.mocked(fetch).mockClear();
        vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
            error: {
                code: 'GENERATION_CAPACITY_LIMITED',
                message: 'Boardroom is temporarily at capacity. Your request was not sent for generation.',
                retryable: true,
                retryAfterSeconds: 60,
                category: 'application_rate_limit',
                nextActions: ['retry_after_wait'],
                providerSubmitted: false,
            },
        }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
        }));

        await expect(service.generateContentStream('create an image of a dog')).rejects.toMatchObject({
            code: 'GENERATION_CAPACITY_LIMITED',
            details: {
                retryable: true,
                retryAfterMs: 60_000,
                reason: 'application_rate_limit',
                context: {
                    nextActions: ['retry_after_wait'],
                    providerSubmitted: false,
                },
            },
        });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('rejects partial specialist output when the stream ends with an unavailable record', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(
            `${JSON.stringify({ text: 'partial' })}\n${JSON.stringify({
                error: {
                    code: 'SPECIALIST_UNAVAILABLE',
                    message: 'This specialist is temporarily unavailable. Your request was not processed by another model.',
                    retryable: true,
                    category: 'provider_outage',
                    nextActions: ['retry_later', 'select_qualified_specialist'],
                },
            })}\n`,
            { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } },
        ));

        const { stream, response } = await service.generateContentStream(
            'specialist-only prompt',
            'projects/148015878263/locations/us/endpoints/1720656532632240128',
        );
        const responseFailure = response.catch((error: unknown) => error);
        const reader = stream.getReader();

        await expect(reader.read()).rejects.toMatchObject({
            code: 'SPECIALIST_UNAVAILABLE',
        });
        await expect(responseFailure).resolves.toMatchObject({
            code: 'SPECIALIST_UNAVAILABLE',
            details: { reason: 'provider_outage', retryable: true },
        });
    });

    it('should preserve function calls from SSE candidate parts', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(
            `data: ${JSON.stringify({
                candidates: [{
                    content: {
                        role: 'model',
                        parts: [
                            { text: 'Seating Marketing.' },
                            { functionCall: { name: 'seat_agent', args: { targetAgentId: 'marketing' } } },
                        ],
                    },
                    finishReason: 'STOP',
                }],
            })}\n${JSON.stringify({ complete: true })}\n`,
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        ));

        const { stream, response } = await service.generateContentStream('prompt');
        const reader = stream.getReader();

        const streamed = await reader.read();
        expect(streamed.value?.text()).toBe('Seating Marketing.');
        expect(streamed.value?.functionCalls()).toEqual([
            { name: 'seat_agent', args: { targetAgentId: 'marketing' } },
        ]);

        const final = await response;
        expect(final.text()).toBe('Seating Marketing.');
        expect(final.functionCalls()).toEqual([
            { name: 'seat_agent', args: { targetAgentId: 'marketing' } },
        ]);
    });
});
