import { FirebaseAIService } from './FirebaseAIService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// HOISTED MOCKS
const {
    mockGenerateContent,
    mockGenerateContentStream
} = vi.hoisted(() => {
    return {
        mockGenerateContent: vi.fn(),
        mockGenerateContentStream: vi.fn()
    };
});

// Mock Firebase Modules
vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn(() => ({ asString: () => '' }))
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
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
        getGenerativeModel: vi.fn(() => mockModel),
        getLiveGenerativeModel: vi.fn(),
        getFirebaseAI: vi.fn(() => ({})),
    };
});

// Mock the core firebase service
vi.mock('@/services/firebase', () => ({
    app: {},
    remoteConfig: {},
    ai: {},
    getFirebaseAI: () => ({}),
    functions: {},
    db: {},
    auth: { currentUser: { uid: 'test-user-id' } }
}));

// Mock other dependencies
vi.mock('@google/genai', () => ({ GoogleGenAI: class {} }));
vi.mock('@/config/env', () => ({
    env: { VITE_API_KEY: 'mock-key', appCheckKey: 'mock-key' }
}));
vi.mock('./billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(true),
        trackUsage: vi.fn().mockResolvedValue(undefined)
    }
}));
vi.mock('./context/CachedContextService', () => ({
    CachedContextService: {
        shouldCache: vi.fn().mockReturnValue(false),
        generateHash: vi.fn(),
        findCache: vi.fn()
    }
}));
vi.mock('./AIResponseCache', () => ({
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
