import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    httpsCallable: (...args: any[]) => mockHttpsCallable(...args),
    connectFunctionsEmulator: vi.fn(),
}));

// Mock firebase service
vi.mock('@/services/firebase', () => ({
    functionsWest1: {},
    auth: {
        currentUser: { uid: 'test-user', email: 'test@example.com' }
    },
    db: {},
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock FirebaseAIService
vi.mock('../ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn(),
    },
}));

// Mock AI_MODELS config
vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        IMAGE: {
            GENERATION: 'gemini-3-pro-image-preview',
            FAST: 'gemini-2.5-flash-image',
        },
    },
}));

// Mock InputSanitizer
vi.mock('../ai/utils/InputSanitizer', () => ({
    InputSanitizer: {
        sanitizePrompt: (p: string) => p,
    },
}));

// Mock PromptBuilder
vi.mock('./PromptBuilderService', () => ({
    PromptBuilder: {
        build: (opts: any) => opts.userPrompt,
    },
}));

describe('EditingService', () => {
    let EditingService: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Dynamic import to get fresh module each time
        const mod = await import('./EditingService');
        EditingService = mod.Editing;
    });

    describe('editImage', () => {
        it('should return an image result when the Cloud Function returns candidates format', async () => {
            const mockCallable = vi.fn().mockResolvedValue({
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: 'base64encodeddata=='
                                }
                            }]
                        }
                    }]
                }
            });
            mockHttpsCallable.mockReturnValue(mockCallable);

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'Make the sky blue',
            });

            expect(result).not.toBeNull();
            expect(result!.url).toContain('data:image/png;base64,');
            expect(result!.prompt).toContain('Make the sky blue');
            expect(result!.id).toBeDefined();
        });

        it('should return an image result when the Cloud Function returns flat base64 format', async () => {
            const mockCallable = vi.fn().mockResolvedValue({
                data: {
                    base64: 'flatbase64data==',
                    mimeType: 'image/jpeg',
                    thoughtSignature: 'test-sig-123'
                }
            });
            mockHttpsCallable.mockReturnValue(mockCallable);

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'Add rain',
            });

            expect(result).not.toBeNull();
            expect(result!.url).toBe('data:image/jpeg;base64,flatbase64data==');
            expect(result!.thoughtSignature).toBe('test-sig-123');
        });

        it('should return null when no image data is returned', async () => {
            const mockCallable = vi.fn().mockResolvedValue({
                data: {}
            });
            mockHttpsCallable.mockReturnValue(mockCallable);

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'Something impossible',
            });

            expect(result).toBeNull();
        });

        it('should use pro model when forceHighFidelity is set', async () => {
            const mockCallable = vi.fn().mockResolvedValue({
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: 'prodata=='
                                }
                            }]
                        }
                    }]
                }
            });
            mockHttpsCallable.mockReturnValue(mockCallable);

            await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'High quality edit',
                forceHighFidelity: true,
            });

            // Verify the callable was invoked with pro model
            expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({
                model: 'gemini-3-pro-image-preview',
            }));
        });

        it('should pass mask data when provided', async () => {
            const mockCallable = vi.fn().mockResolvedValue({
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: 'image/png',
                                    data: 'maskedresult=='
                                }
                            }]
                        }
                    }]
                }
            });
            mockHttpsCallable.mockReturnValue(mockCallable);

            await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'base64==' },
                mask: { mimeType: 'image/png', data: 'maskbase64==' },
                prompt: 'Remove the background',
            });

            expect(mockCallable).toHaveBeenCalledWith(expect.objectContaining({
                mask: 'maskbase64==',
                maskMimeType: 'image/png',
            }));
        });
    });

    describe('batchEdit', () => {
        it('should process multiple images and track progress', async () => {
            const mockCallable = vi.fn()
                .mockResolvedValueOnce({
                    data: {
                        candidates: [{
                            content: {
                                parts: [{
                                    inlineData: { mimeType: 'image/png', data: 'img1==' }
                                }]
                            }
                        }]
                    }
                })
                .mockResolvedValueOnce({
                    data: {
                        candidates: [{
                            content: {
                                parts: [{
                                    inlineData: { mimeType: 'image/png', data: 'img2==' }
                                }]
                            }
                        }]
                    }
                });
            mockHttpsCallable.mockReturnValue(mockCallable);

            const onProgress = vi.fn();

            const result = await EditingService.batchEdit({
                images: [
                    { mimeType: 'image/png', data: 'source1==' },
                    { mimeType: 'image/png', data: 'source2==' },
                ],
                prompt: 'Enhance all',
                onProgress,
            });

            expect(result.results).toHaveLength(2);
            expect(result.failures).toHaveLength(0);
            expect(onProgress).toHaveBeenCalledWith(1, 2);
            expect(onProgress).toHaveBeenCalledWith(2, 2);
        });

        it('should capture failures individually without stopping batch', async () => {
            const mockCallable = vi.fn()
                .mockResolvedValueOnce({
                    data: {
                        candidates: [{
                            content: {
                                parts: [{
                                    inlineData: { mimeType: 'image/png', data: 'ok==' }
                                }]
                            }
                        }]
                    }
                })
                .mockRejectedValueOnce(new Error('API rate limit'));
            mockHttpsCallable.mockReturnValue(mockCallable);

            const result = await EditingService.batchEdit({
                images: [
                    { mimeType: 'image/png', data: 's1==' },
                    { mimeType: 'image/png', data: 's2==' },
                ],
                prompt: 'Batch test',
            });

            expect(result.results).toHaveLength(1);
            expect(result.failures).toHaveLength(1);
            expect(result.failures[0].index).toBe(1);
            expect(result.failures[0].error).toBeDefined();
        });
    });

    describe('withRetry', () => {
        it('should retry on resource-exhausted errors', async () => {
            const mockCallable = vi.fn()
                .mockRejectedValueOnce({ code: 'resource-exhausted', message: 'Rate limit' })
                .mockResolvedValueOnce({
                    data: {
                        candidates: [{
                            content: {
                                parts: [{
                                    inlineData: { mimeType: 'image/png', data: 'retried==' }
                                }]
                            }
                        }]
                    }
                });
            mockHttpsCallable.mockReturnValue(mockCallable);

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'base64==' },
                prompt: 'Retry test',
            });

            expect(result).not.toBeNull();
            expect(mockCallable).toHaveBeenCalledTimes(2);
        });
    });

    describe('editVideo', () => {
        it('should return deprecation error', async () => {
            const result = await EditingService.editVideo({
                video: { mimeType: 'video/mp4', data: 'videobase64==' },
                prompt: 'Edit video',
            });

            expect(result).toBeNull();
        });
    });
});
