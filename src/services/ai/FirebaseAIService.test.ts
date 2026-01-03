import { FirebaseAIService } from './FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';

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

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: {} }))
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn()
}));

const mockGenerativeModel = {
    model: 'mock-model-v1',
    generateContent: mockGenerateContent,
    generateContentStream: mockGenerateContentStream,
    startChat: vi.fn(() => ({
        sendMessage: mockGenerateContent
    })),
    embedContent: vi.fn().mockResolvedValue({
        embedding: { values: [0.1, 0.2, 0.3] }
    })
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
    ai: {},
    functions: {},
    db: {}
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
        expect(result.response.text()).toBe('Mock AI Response');
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

    it('should handle generateStructuredData', async () => {
        const schema = { type: 'object', properties: { test: { type: 'string' } } };
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ test: 'success' }) }
        });

        const result = await service.generateStructuredData('Prompt', schema as any);
        expect(result).toEqual({ test: 'success' });

        const { getGenerativeModel } = await import('firebase/ai');
        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            generationConfig: expect.objectContaining({
                responseMimeType: 'application/json',
                responseSchema: schema
            })
        }));
    });

    it('should handle analyzeImage', async () => {
        await service.analyzeImage('What is this?', 'data:image/png;base64,encoded...', 'image/png');

        expect(mockGenerateContent).toHaveBeenCalledWith(expect.arrayContaining([
            'What is this?',
            expect.objectContaining({
                inlineData: { data: 'encoded...', mimeType: 'image/png' }
            })
        ]));
    });

    it('should handle analyzeMultimodal', async () => {
        const parts = [{ text: 'Extra Part' }];
        await service.analyzeMultimodal('Explain', parts);

        expect(mockGenerateContent).toHaveBeenCalledWith(['Explain', ...parts]);
    });

    it('should handle generateGroundedContent', async () => {
        await service.generateGroundedContent('Search this');

        const { getGenerativeModel } = await import('firebase/ai');
        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            tools: expect.arrayContaining([
                expect.objectContaining({ googleSearch: {} })
            ])
        }));
    });

    it('should handle embedContent', async () => {
        const result = await service.embedContent({
            model: 'mock-model-v1',
            content: { role: 'user', parts: [{ text: 'Embed me' }] }
        });

        expect(result.values).toEqual([0.1, 0.2, 0.3]);
        expect(mockGenerativeModel.embedContent).toHaveBeenCalled();
    });

    it('should handle getLiveModel', async () => {
        const { getLiveGenerativeModel } = await import('firebase/ai');
        await service.getLiveModel('System instruction');

        expect(getLiveGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            model: AI_MODELS.TEXT.AGENT,
            systemInstruction: 'System instruction'
        }));
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

    it('should handle generateVideo with polling', async () => {
        const { httpsCallable } = await import('firebase/functions');
        const { getDoc } = await import('firebase/firestore');

        (httpsCallable as any).mockReturnValue(vi.fn().mockResolvedValue({ data: {} }));
        (getDoc as any).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ status: 'pending' })
        }).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ status: 'complete', videoUrl: 'http://video.mp4' })
        });

        const result = await service.generateVideo({
            prompt: 'Cinematic video',
            model: 'veo-v1',
            config: { durationSeconds: 5 }
        });

        expect(result).toBe('http://video.mp4');
    });
});
