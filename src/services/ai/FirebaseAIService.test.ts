import { FirebaseAIService } from './FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';

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
    getValue: vi.fn((rc, key) => ({
        asString: () => {
            if (key === 'model_name') return 'mock-model-v1';
            // Return empty string (valid falsy) for ai_system_config to trigger default fallback
            // console.log(`[Test Debug] getValue called for ${key}`);
            return '';
        }
    }))
}));

vi.mock('firebase/functions', () => ({
    serverTimestamp: vi.fn(),
    getFunctions: vi.fn(),
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: {} }))
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
        generateContentStream: vi.fn().mockResolvedValue({
            stream: (async function* () { yield { text: () => 'Stream' }; })(),
            response: Promise.resolve({
                candidates: [],
                usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }
            })
        }),
        startChat: vi.fn(() => ({
            serverTimestamp: vi.fn(),
            sendMessage: mockGenerateContent
        })),
        embedContent: vi.fn().mockResolvedValue({
            embedding: { values: [0.1, 0.2, 0.3] }
        })
    };

    return {
        serverTimestamp: vi.fn(),
        getGenerativeModel: vi.fn(() => mockModel),
        getLiveGenerativeModel: vi.fn(),
        VertexAIBackend: vi.fn(),
        getAI: vi.fn()
    };
});

// Mock the core firebase service
vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    app: {},
    remoteConfig: {},
    ai: {}, // The raw firebase instance
    getFirebaseAI: () => ({
        serverTimestamp: vi.fn(),
    }), // The accessor function
    functions: {},
    db: {},
    auth: { currentUser: { uid: 'test-user-id' } },
    storage: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock Google GenAI SDK (Fallback) - new @google/genai package
vi.mock('@google/genai', () => {
    return {
        serverTimestamp: vi.fn(),
        GoogleGenAI: class {
            models = {
                generateContent: mockGenerateContent,
                generateContentStream: vi.fn().mockResolvedValue(
                    (async function* () { yield { text: 'Fallback Stream', candidates: [] }; })()
                ),
                embedContent: vi.fn().mockResolvedValue({
                    embeddings: [{ values: [0.1, 0.2, 0.3] }]
                })
            };
        }
    };
});

vi.mock('@/config/env', () => ({
    serverTimestamp: vi.fn(),
    env: {
        VITE_API_KEY: 'mock-google-api-key',
        apiKey: 'mock-google-api-key',
        appCheckKey: 'mock-app-check-key',
        appCheckDebugToken: 'mock-debug-token'
    }
}));

vi.mock('./billing/TokenUsageService', () => ({
    serverTimestamp: vi.fn(),
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(true),
        trackUsage: vi.fn().mockResolvedValue(undefined)
    }
}));

describe('FirebaseAIService', () => {
    let service: FirebaseAIService;

    beforeEach(() => {
        service = new FirebaseAIService();
        vi.clearAllMocks();
        mockGenerateContent.mockReset();
        mockGenerateContentStream.mockReset();

        mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Mock AI Response' }
        });

        mockGenerateContentStream.mockResolvedValue({
            stream: (async function* () {
                yield {
                    text: () => 'Stream',
                    candidates: [{
                        content: {
                            parts: [{ text: 'Stream' }]
                        }
                    }]
                };
            })()
        });
    });

    it('should bootstrap by fetching remote config and initializing model', async () => {
        const { fetchAndActivate } = await import('firebase/remote-config');
        const { getGenerativeModel } = await import('firebase/ai');
        const { STANDARD_SAFETY_SETTINGS } = await import('./config/safety-settings');

        await service.bootstrap();

        expect(fetchAndActivate).toHaveBeenCalled();
        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            model: 'mock-model-v1',
            safetySettings: STANDARD_SAFETY_SETTINGS
        }));
    });

    it('should enforce safety settings in generateContent', async () => {
        const { getGenerativeModel } = await import('firebase/ai');
        const { STANDARD_SAFETY_SETTINGS } = await import('./config/safety-settings');

        // Force a call that triggers re-initialization of model (e.g. by passing config)
        await service.generateContent('Safe Prompt', undefined, { temperature: 0.5 });

        expect(getGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            safetySettings: STANDARD_SAFETY_SETTINGS
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
                thinkingConfig: expect.objectContaining({
                    thinkingBudget: 1024,
                    includeThoughts: true
                })
            })
        }));
    });

    it('should handle chat sessions', async () => {
        const result = await service.chat([], 'Hello');
        expect(result).toBe('Mock AI Response');
        // We verify interactions via the hoisted functions now since reference to local var is gone
        expect(mockGenerateContent).toHaveBeenCalled();
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

        const args = mockGenerateContent.mock.calls[0];
        expect(args[0]).toMatchObject({
            contents: [{
                role: 'user',
                parts: [
                    { text: 'What is this?' },
                    { inlineData: { data: 'encoded...', mimeType: 'image/png' } }
                ]
            }]
        });
    });

    it('should handle analyzeMultimodal', async () => {
        const parts = [{ text: 'Extra Part' }];
        await service.analyzeMultimodal('Explain', parts);

        const args = mockGenerateContent.mock.calls[0];
        expect(args[0]).toMatchObject({
            contents: [{
                role: 'user',
                parts: [
                    { text: 'Explain' },
                    { text: 'Extra Part' }
                ]
            }]
        });
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
        // expect(mockGenerativeModel.embedContent).toHaveBeenCalled(); // Can't easily check internal mock obj
    });

    it('should handle getLiveModel', async () => {
        const { getLiveGenerativeModel } = await import('firebase/ai');
        await service.getLiveModel('System instruction');

        expect(getLiveGenerativeModel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            model: AI_MODELS.TEXT.AGENT,
            systemInstruction: 'System instruction'
        }));
    });

    it('should fall back to direct SDK on App Check failure', async () => {
        // Force primary model to fail with App Check error during bootstrap
        const { fetchAndActivate } = await import('firebase/remote-config');
        (fetchAndActivate as any).mockRejectedValueOnce(new Error('firebase-app-check-token-invalid'));

        await service.bootstrap();
        expect(service['useFallbackMode']).toBe(true);
    });

    it('should handle content streams', async () => {
        const { stream } = await service.generateContentStream('Stream me');
        const reader = stream.getReader();
        const { value } = await reader.read();
        // Expect "Stream"
        const text = typeof value?.text === 'function' ? value.text() : value?.text;
        expect(text).toBe('Stream');
    });

    it('should falling back if bootstrap fails (Resilience)', async () => {
        const { fetchAndActivate } = await import('firebase/remote-config');
        (fetchAndActivate as any).mockRejectedValueOnce(new Error('firebase-app-check-token-invalid'));

        // Should NOT throw, but enter fallback mode
        await service.bootstrap();
        expect(service['useFallbackMode']).toBe(true);
    });

    it('should throw if BOTH primary and fallback fail', async () => {
        // Force fallback mode, but with a broken client
        const { fetchAndActivate } = await import('firebase/remote-config');
        (fetchAndActivate as any).mockRejectedValueOnce(new Error('firebase-app-check-token-invalid'));

        // Corrupt the fallback client to simulate total failure
        await service.bootstrap();
        service['fallbackClient'] = null;

        await expect(service.generateText('test')).rejects.toThrow('AI Service not properly initialized');
    });

    it('should handle generateVideo with polling', async () => {
        const { httpsCallable } = await import('firebase/functions');
        const { getDoc } = await import('firebase/firestore');

        (httpsCallable as any).mockReturnValue(vi.fn().mockResolvedValue({ data: {} }));
        (getDoc as any).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
                serverTimestamp: vi.fn(), status: 'pending'
            })
        }).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
                serverTimestamp: vi.fn(), status: 'completed', videoUrl: 'http://video.mp4'
            })
        });

        const result = await service.generateVideo({
            prompt: 'Cinematic video',
            model: 'veo-v1',
            config: { durationSeconds: 5 }
        });

        expect(result).toBe('http://video.mp4');
    });

    it('should retry on transient errors', async () => {
        vi.useFakeTimers();
        // Fail twice with "signal is aborted", then succeed
        mockGenerateContent
            .mockRejectedValueOnce(new Error('signal is aborted without reason'))
            .mockRejectedValueOnce(new Error('503 service unavailable'))
            .mockResolvedValueOnce({
                response: {
                    text: () => 'Success after retry',
                    usageMetadata: {}
                }
            });

        const promise = service.generateContent('Retry me');

        // Advance timers to trigger retries
        // Wait for backoff loops (approx 2000 + 4000 ms)
        await vi.advanceTimersByTimeAsync(10000);

        const result = await promise;
        expect(result.response.text()).toBe('Success after retry');
        expect(mockGenerateContent).toHaveBeenCalledTimes(3);
        vi.useRealTimers();
    });

    it('should abort retry if user cancels', async () => {
        vi.useFakeTimers();
        mockGenerateContent.mockRejectedValue(new Error('503 service unavailable'));
        const abortController = new AbortController();

        const promise = service.generateContent('Cancel me', undefined, undefined, undefined, undefined, { signal: abortController.signal });
        const expectation = expect(promise).rejects.toThrow('Operation cancelled by user');

        // Advance slightly to let it enter retry loop
        await vi.advanceTimersByTimeAsync(10);
        abortController.abort();

        // Must advance timer to trigger the abort check inside the sleep
        await vi.advanceTimersByTimeAsync(1000);

        await expectation;
        vi.useRealTimers();
    });

    it('should fallback on Firebase Installations API errors', async () => {
        // Mock a failure that resembles the Installations error
        const errMsg = 'Installations: Create Installation request failed with error "403 PERMISSION_DENIED"';
        const { fetchAndActivate } = await import('firebase/remote-config');
        (fetchAndActivate as any).mockRejectedValueOnce(new Error(errMsg));

        // Should NOT throw
        await service.bootstrap();
        expect(service['useFallbackMode']).toBe(true);
    });
});
