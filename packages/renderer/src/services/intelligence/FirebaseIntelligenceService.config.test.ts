import { FirebaseIntelligenceService } from './FirebaseIntelligenceService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// HOISTED MOCKS
const {
    mockGenerateContent,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        serverTimestamp: vi.fn(), asString: () => ''
    }))
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
        model: 'gemini-3-mock-v1',
        generateContent: mockGenerateContent,
    };

    return {
        serverTimestamp: vi.fn(),
        getGenerativeModel: vi.fn(() => mockModel),
        getLiveGenerativeModel: vi.fn(),
        getFirebaseAI: vi.fn(() => ({
            serverTimestamp: vi.fn(),
        })),
    };
});

// Mock the core firebase service
vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    app: {},
    remoteConfig: {},
    ai: {},
    getFirebaseAI: () => ({
        serverTimestamp: vi.fn(),
    }),
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
    serverTimestamp: vi.fn(), GoogleGenAI: class { }
}));
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
vi.mock('./IntelligenceResponseCache', () => ({
    serverTimestamp: vi.fn(),
    aiCache: { get: vi.fn(), set: vi.fn() }
}));

describe('FirebaseIntelligenceService Configuration Mapping', () => {
    let service: FirebaseIntelligenceService;

    const latestBackendRequest = () => {
        const calls = vi.mocked(fetch).mock.calls;
        const call = [...calls].reverse().find(([url]) => String(url).includes('generateContentStream'));
        return JSON.parse(call?.[1]?.body as string);
    };

    beforeEach(() => {
        service = new FirebaseIntelligenceService();
        vi.clearAllMocks();
        mockGenerateContent.mockReset();
        mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Mock Response' }
        });
        vi.mocked(fetch).mockResolvedValue(new Response(`${JSON.stringify({ text: 'Mock Response' })}\n${JSON.stringify({ complete: true })}\n`));
    });

    it('should map thinkingBudget and set includeThoughts in generateText', async () => {
        await service.generateText('Prompt', 2048);

        expect(latestBackendRequest().config).toMatchObject({
                thinkingConfig: {
                    thinkingBudget: 2048,
                    includeThoughts: true
                }
        });
    });

    it('should map thinkingBudget in generateStructuredData', async () => {
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ success: true }) }
        });
        const schema = { type: 'object' };

        await service.generateStructuredData('Prompt', schema as Parameters<typeof service.generateStructuredData>[1], 1024);

        expect(latestBackendRequest().config).toMatchObject({
                thinkingConfig: {
                    thinkingBudget: 1024,
                    includeThoughts: true
                }
        });
    });

    it('should configure dynamic retrieval in generateGroundedContent', async () => {
        await service.generateGroundedContent('Search query', { dynamicThreshold: 0.7 });

        expect(latestBackendRequest().config).toMatchObject({
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
        });
    });

    it('should use basic google search if no dynamic options provided', async () => {
        await service.generateGroundedContent('Search query');

        expect(latestBackendRequest().config).toMatchObject({
            tools: expect.arrayContaining([
                { googleSearch: {}, googleSearchRetrieval: undefined }
            ])
        });
    });
});
