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
    auth: { currentUser: { uid: 'user-123' } }
}));

// Mock Google Generative AI (Fallback)
vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn(function () {
        return {
            getGenerativeModel: vi.fn(() => ({
                generateContent: mockGenerateContent
            }))
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
            response: {
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
            }
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
