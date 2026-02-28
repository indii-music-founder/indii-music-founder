import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAIService } from '../FirebaseAIService';

// Hoist mocks
const mockGenerateContent = vi.fn();

// Mock Firebase Service
vi.mock('@/services/firebase', () => ({
    getFirebaseAI: vi.fn(() => ({})), // Return truthy to simulate "App Check Configured" or at least normal mode intent
    functions: {},
    ai: {},
    remoteConfig: {},
    auth: { currentUser: { uid: 'user-123' } },
    db: {},
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
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
    __esModule: true,
    getGenerativeModel: vi.fn(() => ({
        generateContent: mockGenerateContent
    })),
    Schema: {},
    Tool: {}
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

describe('Voice Interface QA', () => {
    let service: FirebaseAIService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new FirebaseAIService();
    });

    it('should handle empty input gracefully', async () => {
        await expect(service.generateSpeech('', 'Kore'))
            .rejects.toThrow('Cannot generate speech for empty text');
    });

    it('should sanitize special characters', async () => {
        mockGenerateContent.mockResolvedValue({
            candidates: [{
                content: {
                    parts: [{
                        inlineData: {
                            mimeType: 'audio/mp3',
                            data: 'base64audio'
                        }
                    }]
                }
            }]
        });

        const result = await service.generateSpeech('Hello 🌍! @#$%^&*()', 'Kore');
        expect(result).toBeDefined();
        expect(result.audio.inlineData.data).toBe('base64audio');
    });

    it('should throw error on API failure', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Down'));

        await expect(service.generateSpeech('Hello', 'Kore'))
            .rejects.toThrow('API Down');
    });
});
