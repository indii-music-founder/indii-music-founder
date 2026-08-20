import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firebaseAI } from '../FirebaseIntelligenceService';
import { RateLimiter } from '../RateLimiter';
import { aiCache } from '../IntelligenceResponseCache';
import 'fake-indexeddb/auto'; // Polyfill IndexedDB for JSDOM

// Hoist mock
const { mockGenerateContent } = vi.hoisted(() => ({
    mockGenerateContent: vi.fn()
}));

// Mock env config to provide fake API key
vi.mock('@/config/env', () => ({
    env: {
        apiKey: 'test-api-key-for-caching',
        VITE_API_KEY: 'test-api-key-for-caching',
        DEV: true,
        appCheckKey: 'test-app-check-key',
        appCheckDebugToken: 'test-debug-token'
    },
    firebaseConfig: {
        apiKey: 'test-firebase-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test.appspot.com',
        messagingSenderId: '123',
        appId: '1:123:web:abc'
    }
}));

// Mock Firebase services
vi.mock('@/services/firebase', () => ({
    getFirebaseAI: vi.fn(() => ({})),
    ai: {},
    remoteConfig: {},
    functions: {},
    auth: { currentUser: { uid: 'test-user' } },
    db: {},
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn(),
    getValue: vi.fn().mockReturnValue({ asString: () => 'mock-model' })
}));

// Mock TokenUsageService to avoid quota errors
vi.mock('../billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        trackUsage: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(true)
    }
}));

// Mock Google AutonomousIntelligence SDK (Fallback) - new @google/genai package
vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn(function () {
        return {
            models: {
                generateContent: mockGenerateContent,
                generateContentStream: vi.fn(),
                embedContent: vi.fn()
            }
        };
    })
}));

// Mock firebase/ai
vi.mock('firebase/ai', () => ({
    getGenerativeModel: vi.fn(() => ({
        model: 'mock-model',
        generateContent: mockGenerateContent
    }))
}));

// The AI service routes every content request through the backend
// streaming endpoint via fetch (the direct @google/genai path was removed).
// These tests must not depend on the real network: serve the exact SSE
// contract the service consumes (a BackendStreamPayload line) so the flow
// completes deterministically.
let streamText = 'Fresh Autonomous Response';
// Text and completion travel as SEPARATE stream lines: a payload carrying
// complete:true is consumed without extracting text.
const streamChunk = (text: string): Uint8Array =>
    new TextEncoder().encode(`${JSON.stringify({ text })}\n${JSON.stringify({ complete: true })}\n`);
const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(streamChunk(streamText));
            controller.close();
        },
    }),
    text: async () => '',
}));
vi.stubGlobal('fetch', fetchMock);

describe('AI Caching (Browser Environment)', () => {
    // Force window to exist (although JSDOM usually handles this, explicit check helps)
    beforeEach(async () => {
        vi.clearAllMocks();
        // The service's rate limiter is a singleton with ONE initial token and
        // a ~6s refill — every request after the first queues past the test
        // timeout. Give each test a full bucket.
        firebaseAI.rateLimiter = new RateLimiter(10, 10);
        mockGenerateContent.mockReset(); // Use reset to clear 'Once' implementations
        await aiCache.clear(); // Start with empty cache

        // Setup default mock response
        // Note: The high-level APIs expect a response wrapper object containing candidates and a text() function.
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => 'Fresh Autonomous Response',
                candidates: [{ content: { parts: [{ text: 'Fresh Autonomous Response' }] } }],
                usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 }
            }
        });
        vi.mocked(fetch).mockClear();
    });

    it('should cache generated text responses', async () => {
        const prompt = 'Hello Cache';
        const model = 'mock-model';

        // 1. First Call: Should hit the API
        const response1 = await firebaseAI.generateText(prompt, model);
        expect(response1).toBe('Fresh Autonomous Response');
        expect(fetch).toHaveBeenCalledTimes(1);

        // 2. Refresh Mock to return something different (to prove we don't call it)
        mockGenerateContent.mockResolvedValueOnce({
            response: {
                text: () => 'Different Response (Should Not Be Seen)',
                candidates: [{ content: { parts: [{ text: 'Different Response (Should Not Be Seen)' }] } }]
            }
        });

        // 3. Second Call: Should hit the Cache
        const response2 = await firebaseAI.generateText(prompt, model);
        expect(response2).toBe('Fresh Autonomous Response'); // Same response as before
        expect(fetch).toHaveBeenCalledTimes(1); // Call count remains 1
    });

    it('should cache structured data responses', async () => {
        const prompt = 'Extract data';
        const schema = { type: 'object', properties: { foo: { type: 'string' } } } as unknown as Parameters<typeof firebaseAI.generateStructuredData>[1];

        // The backend stream must carry JSON for the structured parser.
        streamText = JSON.stringify({ foo: 'bar' });

        // Mock returning specific JSON
        const jsonResponse = JSON.stringify({ foo: 'bar' });
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => jsonResponse,
                candidates: [{ content: { parts: [{ text: jsonResponse }] } }]
            }
        });

        // 1. First Call
        const result1 = await firebaseAI.generateStructuredData(prompt, schema);
        expect(result1).toEqual({ foo: 'bar' });
        expect(fetch).toHaveBeenCalledTimes(1);

        // 2. Second Call
        const result2 = await firebaseAI.generateStructuredData(prompt, schema);
        expect(result2).toEqual({ foo: 'bar' });
        expect(fetch).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should respect cache misses (different prompt)', async () => {
        // 1. Call with Prompt A
        await firebaseAI.generateText('Prompt A');
        expect(fetch).toHaveBeenCalledTimes(1);

        // 2. Call with Prompt B
        await firebaseAI.generateText('Prompt B');
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});
