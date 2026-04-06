import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firebaseAI } from '../FirebaseAIService';
import { aiCache } from '../AIResponseCache';
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

// Mock Google GenAI SDK (Fallback) - new @google/genai package
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

describe('AI Caching (Browser Environment)', () => {
    // Force window to exist (although JSDOM usually handles this, explicit check helps)
    beforeEach(async () => {
        vi.clearAllMocks();
        mockGenerateContent.mockReset(); // Use reset to clear 'Once' implementations
        await aiCache.clear(); // Start with empty cache

        // Setup default mock response
        // Note: The Google GenAI SDK (fallback client) returns a flat object with text/candidates,
        // unlike the Firebase SDK which wraps it in a response object.
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => 'Fresh AI Response',
                candidates: [{ content: { parts: [{ text: 'Fresh AI Response' }] } }],
                usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 }
            }
        });
    });

    it('should cache generated text responses', async () => {
        const prompt = 'Hello Cache';
        const model = 'mock-model';

        // 1. First Call: Should hit the API
        const response1 = await firebaseAI.generateText(prompt, model);
        expect(response1).toBe('Fresh AI Response');
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);

        // 2. Refresh Mock to return something different (to prove we don't call it)
        mockGenerateContent.mockResolvedValueOnce({
            response: {
                text: () => 'Different Response (Should Not Be Seen)',
                candidates: [{ content: { parts: [{ text: 'Different Response (Should Not Be Seen)' }] } }]
            }
        });

        // 3. Second Call: Should hit the Cache
        const response2 = await firebaseAI.generateText(prompt, model);
        expect(response2).toBe('Fresh AI Response'); // Same response as before
        expect(mockGenerateContent).toHaveBeenCalledTimes(1); // Call count remains 1
    });

    it('should cache structured data responses', async () => {
        const prompt = 'Extract data';
        const schema = { type: 'object', properties: { foo: { type: 'string' } } } as unknown as Parameters<typeof firebaseAI.generateStructuredData>[1];

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
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);

        // 2. Second Call
        const result2 = await firebaseAI.generateStructuredData(prompt, schema);
        expect(result2).toEqual({ foo: 'bar' });
        expect(mockGenerateContent).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should respect cache misses (different prompt)', async () => {
        // 1. Call with Prompt A
        await firebaseAI.generateText('Prompt A');
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);

        // 2. Call with Prompt B
        await firebaseAI.generateText('Prompt B');
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });
});
