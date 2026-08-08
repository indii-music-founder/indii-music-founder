import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseIntelligenceService } from './FirebaseIntelligenceService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';

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
            if (key === 'model_name') return 'gemini-3-mock-v1';
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
        model: 'gemini-3-mock-v1',
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

// Mock Google AutonomousIntelligence SDK (Fallback) - new @google/genai package
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
                }),
                generateVideos: vi.fn().mockResolvedValue({
                    done: false,
                    response: null
                })
            };
            operations = {
                getVideosOperation: vi.fn().mockResolvedValue({
                    done: true,
                    response: { generatedVideos: [{ video: { uri: 'http://video.mp4' } }] }
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

describe('FirebaseIntelligenceService', () => {
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
        mockGenerateContentStream.mockReset();

        mockGenerateContent.mockResolvedValue({
            response: { text: () => 'Mock Autonomous Response' }
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

        await service.bootstrap();

        expect(fetchAndActivate).toHaveBeenCalled();
        expect(service.model).toMatchObject({ model: 'gemini-3-mock-v1' });
    });

    it('should send safety settings to the backend gateway', async () => {
        const { STANDARD_SAFETY_SETTINGS } = await import('./config/safety-settings');

        await service.generateContent('Safe Prompt', undefined, { temperature: 0.5 });

        expect(latestBackendRequest().config).toMatchObject({
            temperature: 0.5,
            safetySettings: STANDARD_SAFETY_SETTINGS
        });
    });

    it('should auto-initialize on first generateContent call', async () => {
        const bootSpy = vi.spyOn(service, 'bootstrap');
        const result = await service.generateContent('Test Prompt');

        expect(bootSpy).toHaveBeenCalled();
        expect(result.response.text()).toBe('Mock Autonomous Response');
    });


    it('should handle generateText with system instructions', async () => {
        const result = await service.generateText('Prompt', 1024, 'Be a cat');
        expect(result).toBe('Mock Autonomous Response');

        expect(latestBackendRequest().config).toMatchObject({
            systemInstruction: 'Be a cat',
            thinkingConfig: expect.objectContaining({
                thinkingBudget: 1024,
                includeThoughts: true
            })
        });
    });

    it('should handle chat sessions', async () => {
        const result = await service.chat([], 'Hello');
        expect(result).toBe('Mock Autonomous Response');
        expect(latestBackendRequest().contents[0].parts[0].text).toBe('Hello');
    });

    it('should handle generateStructuredData', async () => {
        const schema = { type: 'object', properties: { test: { type: 'string' } } };
        mockGenerateContent.mockResolvedValueOnce({
            response: { text: () => JSON.stringify({ test: 'success' }) }
        });

        const result = await service.generateStructuredData('Prompt', schema as Parameters<typeof service.generateStructuredData>[1]);
        expect(result).toEqual({ test: 'success' });

        expect(latestBackendRequest().config).toMatchObject({
            responseMimeType: 'application/json',
            responseSchema: schema
        });
    });

    it('should handle analyzeImage', async () => {
        await service.analyzeImage('What is this?', 'data:image/png;base64,encoded...', 'image/png');

        expect(latestBackendRequest()).toMatchObject({
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

        expect(latestBackendRequest()).toMatchObject({
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

        expect(latestBackendRequest().config).toMatchObject({
            tools: expect.arrayContaining([
                expect.objectContaining({ googleSearch: {} })
            ])
        });
    });

    it('should fail closed for embedContent until a backend embedding route exists', async () => {
        await expect(service.embedContent({
            model: 'gemini-3-mock-v1',
            content: { role: 'user', parts: [{ text: 'Embed me' }] }
        })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('should fail closed for browser-side Live API', async () => {
        await expect(service.getLiveModel('System instruction')).rejects.toMatchObject({
            code: 'UNAUTHORIZED'
        });
    });

    it('should fail closed on App Check failure', async () => {
        // Force primary model to fail with App Check error during bootstrap
        const { fetchAndActivate } = await import('firebase/remote-config');
        vi.mocked(fetchAndActivate).mockRejectedValueOnce(new Error('firebase-app-check-token-invalid'));

        const originalDev = import.meta.env.DEV;
        (import.meta.env as any).DEV = false;
        await expect(service.bootstrap()).rejects.toMatchObject({
            code: 'UNAUTHORIZED'
        });
        (import.meta.env as any).DEV = originalDev;
    });

    it('should handle content streams', async () => {
        const { stream } = await service.generateContentStream('Stream me');
        const reader = stream.getReader();
        const { value } = await reader.read();
        // Expect "Stream"
        const text = typeof value?.text === 'function' ? value.text() : value?.text;
        expect(text).toBe('Stream');
    });

    it('keeps the configured timeout active while opening the backend stream', async () => {
        vi.useFakeTimers();
        vi.mocked(fetch).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
            const signal = init?.signal;
            signal?.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
        }));

        const pending = service.rawGenerateContentStream(
            'Timeout stream',
            undefined,
            undefined,
            undefined,
            undefined,
            { timeout: 25 }
        );
        const assertion = expect(pending).rejects.toThrow('AI Request timed out');
        await vi.advanceTimersByTimeAsync(30);

        await assertion;
        vi.useRealTimers();
    });

    it('should not fall back if bootstrap fails (Resilience)', async () => {
        const { fetchAndActivate } = await import('firebase/remote-config');
        vi.mocked(fetchAndActivate).mockRejectedValueOnce(new Error('firebase-app-check-token-invalid'));

        const originalDev = import.meta.env.DEV;
        (import.meta.env as any).DEV = false;
        await expect(service.bootstrap()).rejects.toMatchObject({
            code: 'UNAUTHORIZED'
        });
        (import.meta.env as any).DEV = originalDev;
    });

    it('should block renderer-side direct video generation', async () => {
        await expect(service.generateVideo({
            prompt: 'Cinematic video',
            model: 'veo-v1',
            config: { durationSeconds: 5 },
            timeoutMs: 60000
        })).rejects.toMatchObject({
            code: 'UNAUTHORIZED'
        });
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
        expect(fetch).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('should abort retry if user cancels', async () => {
        const abortController = new AbortController();
        abortController.abort();

        await expect(service.generateContent('Cancel me', undefined, undefined, undefined, undefined, { signal: abortController.signal }))
            .rejects.toThrow(/aborted|cancelled/i);
    });

    it('should fail closed on Firebase Installations API errors', async () => {
        const { fetchAndActivate } = await import('firebase/remote-config');
        const error = 'Installations: Create Installation request failed with error "403 PERMISSION_DENIED"';
        vi.mocked(fetchAndActivate).mockRejectedValueOnce(new Error(error));

        const originalDev = import.meta.env.DEV;
        (import.meta.env as any).DEV = false;
        await expect(service.bootstrap()).rejects.toMatchObject({
            code: 'INTERNAL_ERROR',
            message: 'Firebase Installations API is disabled or restricted. Please enable it in Google Cloud Console.'
        });
        (import.meta.env as any).DEV = originalDev;
    });
});
