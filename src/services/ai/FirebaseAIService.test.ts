import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAIService } from './FirebaseAIService';

// HOISTED MOCKS to avoid ReferenceError
const {
    mockGetAI,
    mockGetGenerativeModel,
    mockGenerateContent,
    mockVertexAIBackend
} = vi.hoisted(() => {
    const mockGenerateContent = vi.fn();
    const mockGetGenerativeModel = vi.fn(() => ({
        generateContent: mockGenerateContent,
        generateContentStream: vi.fn().mockResolvedValue({
            stream: (async function* () { yield { text: () => 'Stream Chunk' }; })()
        })
    }));
    const mockGetAI = vi.fn(() => ({}));
    const mockVertexAIBackend = vi.fn();

    return {
        mockGetAI,
        mockGetGenerativeModel,
        mockGenerateContent,
        mockVertexAIBackend
    };
});

// Mock Firebase Modules
vi.mock('firebase/remote-config', () => ({
    getRemoteConfig: vi.fn(),
    fetchAndActivate: vi.fn().mockResolvedValue(true),
    getValue: vi.fn((rc, key) => ({
        asString: () => key === 'model_name' ? 'mock-model-v1' : 'us-central1'
    }))
}));

vi.mock('firebase/ai', () => ({
    getAI: mockGetAI,
    VertexAIBackend: mockVertexAIBackend,
    getGenerativeModel: mockGetGenerativeModel,
    GenerativeModel: vi.fn(), // Mock class/types if used as values
    GenerateContentResult: vi.fn(),
    Content: vi.fn(),
    GenerateContentStreamResult: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    app: {},
    remoteConfig: {}
}));

describe('FirebaseAIService', () => {
    let service: FirebaseAIService;

    beforeEach(() => {
        service = new FirebaseAIService();
        vi.clearAllMocks();

        // Ensure mocks return valid objects
        mockGetAI.mockReturnValue({ id: 'mock-ai-instance' });
        mockGetGenerativeModel.mockReturnValue({
            generateContent: mockGenerateContent,
            generateContentStream: vi.fn()
        });

        // Default success
        mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Mock AI Response' }
        });
    });

    it('should bootstrap by fetching remote config and initializing model', async () => {
        const { fetchAndActivate, getValue } = await import('firebase/remote-config');
        const { getAI, getGenerativeModel, VertexAIBackend } = await import('firebase/ai');

        await service.bootstrap();

        expect(fetchAndActivate).toHaveBeenCalled();
        expect(getValue).toHaveBeenCalledWith(expect.anything(), 'model_name');

        // Verify Check List Requirement: Limited Use Tokens
        expect(getAI).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            useLimitedUseAppCheckTokens: true,
            backend: expect.any(VertexAIBackend)
        }));

        expect(getGenerativeModel).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'mock-ai-instance' }),
            expect.objectContaining({
                model: 'mock-model-v1'
            })
        );
    });

    it('should auto-initialize on first generate call', async () => {
        const bootSpy = vi.spyOn(service, 'bootstrap');
        const result = await service.generateContent('Test Prompt');

        expect(bootSpy).toHaveBeenCalled();
        expect(result).toBe('Mock AI Response');
    });

    it('should handle App Check failures gracefully', async () => {
        // Override for this specific test
        mockGenerateContent.mockRejectedValueOnce(new Error('firebase-app-check-token-invalid'));

        await expect(service.generateContent('fail')).rejects.toThrow('AI Verification Failed (App Check)');
    });
});
