import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAIService } from '../FirebaseAIService';

// Mock Firebase
vi.mock('@/services/firebase', () => ({
    functions: {},
    ai: {},
    remoteConfig: {},
    auth: { currentUser: { uid: 'user-123' } }
}));

// Mock firebase/ai
const mockGenerateContent = vi.fn();

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
