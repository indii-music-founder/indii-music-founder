import { FirebaseAIService } from './FirebaseAIService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// HOISTED MOCKS
const {
    mockGenerateContent,
    mockGenerateContentStream
} = vi.hoisted(() => {
    return {
    serverTimestamp: vi.fn(),
        mockGenerateContent: vi.fn(),
        mockGenerateContentStream: vi.fn()
    };
});

// Mock Firebase Modules
vi.mock('firebase/remote-config', () => ({
  serverTimestamp: vi.fn(),
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn(() => ({
  serverTimestamp: vi.fn(), asString: () => '' }))
}));

vi.mock('firebase/functions', () => ({
  serverTimestamp: vi.fn(),
    getFunctions: vi.fn(),
    httpsCallable: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
    getFirestore: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn()
}));

// Mock firebase/ai
vi.mock('firebase/ai', () => {
    const mockModel = {
        model: 'mock-model-v1',
        generateContent: mockGenerateContent,
    };

    return {
    serverTimestamp: vi.fn(),
        getGenerativeModel: vi.fn(() => mockModel),
        getLiveGenerativeModel: vi.fn(),
        getFirebaseAI: vi.fn(() => ({
  serverTimestamp: vi.fn(),})),
    };
});

// Mock the core firebase service
vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    app: {},
    remoteConfig: {},
    ai: {},
    getFirebaseAI: () => ({
  serverTimestamp: vi.fn(),}),
    functions: {},
    db: {},
    auth: { currentUser: { uid: 'test-user-id' } },
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock other dependencies
vi.mock('@google/genai', () => ({
  serverTimestamp: vi.fn(), GoogleGenAI: class {} }));
vi.mock('@/config/env', () => ({
  serverTimestamp: vi.fn(),
    env: { VITE_API_KEY: 'mock-key', appCheckKey: 'mock-key' }
}));
vi.mock('./billing/TokenUsageService', () => ({
  serverTimestamp: vi.fn(),
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(true),
        trackUsage: vi.fn().mockResolvedValue(undefined)
    }
}));
vi.mock('./context/CachedContextService', () => ({
  serverTimestamp: vi.fn(),
    CachedContextService: {
        shouldCache: vi.fn().mockReturnValue(false),
        generateHash: vi.fn(),
        findCache: vi.fn()
    }
}));
vi.mock('./AIResponseCache', () => ({
  serverTimestamp: vi.fn(),
    aiCache: { get: vi.fn(), set: vi.fn() }
}));

describe('FirebaseAIService Configuration Mapping', () => {
    let service: FirebaseAIService;

    beforeEach(() => {
        service = new FirebaseAIService();
        vi.clearAllMocks();
        mockGenerateContent.mockReset();
        mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Mock Response' }
        });
    });

    it('should map thinkingBudget to budgetTokenCount and set includeThoughts in generateText', async () => {
        const { getGenerativeModel } = await import('firebase/ai');

        await service.generateText('Prompt', 2048);

        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            generationConfig: expect.objectContaining({
                thinkingConfig: {
                    thinkingBudget: 2048,
                    budgetTokenCount: 2048,
                    includeThoughts: true
                }
            })
        }));
    });

    it('should map thinkingBudget in generateStructuredData', async () => {
        const { getGenerativeModel } = await import('firebase/ai');
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ success: true }) }
        });
        const schema = { type: 'object' };

        await service.generateStructuredData('Prompt', schema as any, 1024);

        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            generationConfig: expect.objectContaining({
                thinkingConfig: {
                    thinkingBudget: 1024,
                    budgetTokenCount: 1024,
                    includeThoughts: true
                }
            })
        }));
    });

    it('should configure dynamic retrieval in generateGroundedContent', async () => {
        const { getGenerativeModel } = await import('firebase/ai');

        await service.generateGroundedContent('Search query', { dynamicThreshold: 0.7 });

        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            tools: expect.arrayContaining([
                expect.objectContaining({
                    googleSearch: {},
                    googleSearchRetrieval: {
                        dynamicRetrievalConfig: {
                            mode: 'MODE_DYNAMIC',
                            dynamicThreshold: 0.7
                        }
                    }
                })
            ])
        }));
    });

    it('should use basic google search if no dynamic options provided', async () => {
        const { getGenerativeModel } = await import('firebase/ai');

        await service.generateGroundedContent('Search query');

        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            tools: expect.arrayContaining([
                { googleSearch: {}, googleSearchRetrieval: undefined }
            ])
        }));
    });
});
