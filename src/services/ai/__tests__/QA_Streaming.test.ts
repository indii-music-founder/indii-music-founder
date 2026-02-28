import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAIService } from '../FirebaseAIService';

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
        VITE_API_KEY: 'mock-key',
        apiKey: 'mock-key'
    }
}));

vi.mock('../billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(undefined),
        trackUsage: vi.fn().mockResolvedValue(undefined)
    }
}));

// Mock Google GenAI SDK (Fallback) - new @google/genai package
vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn(function () {
        return {
            models: {
                generateContent: mockGenerateContent,
                generateContentStream: mockGenerateContentStream,
                embedContent: vi.fn()
            }
        };
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
    let service: FirebaseAIService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new FirebaseAIService();
    });

    it.skip('should pass AbortSignal to SDK', async () => {
        const mockStream = {
            [Symbol.asyncIterator]: async function* () {
                yield {
                    text: () => 'Chunk',
                    candidates: [{ content: { parts: [{ text: 'Chunk' }] } }]
                };
            }
        };

        mockGenerateContentStream.mockResolvedValue(mockStream);

        const controller = new AbortController();
        const signal = controller.signal;

        await service.generateContentStream('prompt', undefined, {}, undefined, undefined, { signal });

        expect(mockGenerateContentStream).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ signal })
        );
    });

    it.skip('should tolerate chunk errors', async () => {
        const mockStream = {
            [Symbol.asyncIterator]: async function* () {
                yield {
                    text: () => 'Good',
                    candidates: [{ content: { parts: [{ text: 'Good' }] } }]
                };
                yield {
                    text: () => { throw new Error('Bad'); },
                    candidates: []
                };
            }
        };

        mockGenerateContentStream.mockResolvedValue(mockStream);

        const { stream } = await service.generateContentStream('prompt');
        const reader = stream.getReader();

        const r1 = await reader.read();
        expect(r1.value?.text()).toBe('Good');

        const r2 = await reader.read();
        expect(r2.value?.text()).toBe(''); // Should catch error and return empty string
    });
});
