import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseAIService } from './FirebaseAIService';

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
    getValue: vi.fn((rc, key) => ({
        asString: () => key === 'model_name' ? 'mock-model-v1' : 'us-central1'
    }))
}));

const mockGenerativeModel = {
    model: 'mock-model-v1',
    generateContent: mockGenerateContent,
    generateContentStream: mockGenerateContentStream,
    startChat: vi.fn(() => ({
        sendMessage: mockGenerateContent
    }))
};

vi.mock('firebase/ai', () => ({
    getGenerativeModel: vi.fn(() => mockGenerativeModel),
    getLiveGenerativeModel: vi.fn(),
    VertexAIBackend: vi.fn(),
    getAI: vi.fn()
}));

// Mock the core firebase service
vi.mock('@/services/firebase', () => ({
    app: {},
    remoteConfig: {},
    ai: {}
}));

describe('FirebaseAIService', () => {
    let service: FirebaseAIService;

    beforeEach(() => {
        service = new FirebaseAIService();
        vi.clearAllMocks();

        mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Mock AI Response' }
        });

        mockGenerateContentStream.mockResolvedValue({
            stream: (async function* () { yield { text: () => 'Stream' }; })()
        });
    });

    it('should bootstrap by fetching remote config and initializing model', async () => {
        const { fetchAndActivate } = await import('firebase/remote-config');
        const { getGenerativeModel } = await import('firebase/ai');

        await service.bootstrap();

        expect(fetchAndActivate).toHaveBeenCalled();
        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            model: 'mock-model-v1'
        }));
    });

    it('should auto-initialize on first generateContent call', async () => {
        const bootSpy = vi.spyOn(service, 'bootstrap');
        const result = await service.generateContent('Test Prompt');

        expect(bootSpy).toHaveBeenCalled();
        expect(result).toBe('Mock AI Response');
    });

    it('should handle generateText with system instructions', async () => {
        const result = await service.generateText('Prompt', 1024, 'Be a cat');
        expect(result).toBe('Mock AI Response');

        const { getGenerativeModel } = await import('firebase/ai');
        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            systemInstruction: 'Be a cat',
            generationConfig: expect.objectContaining({
                thinkingConfig: { thinkingBudget: 1024 }
            })
        }));
    });

    it('should handle chat sessions', async () => {
        const result = await service.chat([], 'Hello');
        expect(result).toBe('Mock AI Response');
        expect(mockGenerativeModel.startChat).toHaveBeenCalled();
    });

    it('should handle App Check failures gracefully', async () => {
        await service.bootstrap();
        mockGenerateContent.mockRejectedValueOnce(new Error('firebase-app-check-token-invalid'));

        await expect(service.generateContent('fail')).rejects.toThrow('AI Verification Failed (App Check)');
    });

    it('should handle content streams', async () => {
        const stream = await service.generateContentStream('Stream me');
        const reader = stream.getReader();
        const { value } = await reader.read();
        expect(value).toBe('Stream');
    });
});
