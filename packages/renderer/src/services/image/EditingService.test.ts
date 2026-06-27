import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEditImageFn, mockUploadReferenceMedia } = vi.hoisted(() => {
    return {
        mockEditImageFn: vi.fn(),
        mockUploadReferenceMedia: vi.fn(async (_userId: string, media: string) => {
            if (media.includes('mask')) return 'gs://mock-bucket.appspot.com/users/test-user/vault/masks/mock-mask.png';
            if (media.includes('reference')) return 'gs://mock-bucket.appspot.com/users/test-user/vault/objects/mock-reference.png';
            return 'gs://mock-bucket.appspot.com/users/test-user/vault/objects/mock-image.png';
        })
    };
});

vi.mock('firebase/functions', () => ({
    httpsCallable: () => mockEditImageFn,
    connectFunctionsEmulator: vi.fn(),
}));

vi.mock('@/services/creative/CreativeStorageService', () => ({
    CreativeStorageService: {
        uploadReferenceMedia: (...args: unknown[]) => mockUploadReferenceMedia(...args as [string, string]),
    },
}));

// Mock firebase service
vi.mock('@/services/firebase', () => ({
    functionsWest1: {},
    auth: {
        currentUser: {
            uid: 'test-user',
            email: 'test@example.com',
            getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
        }
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

// Mock FirebaseIntelligenceService
vi.mock('../intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        generateVideo: vi.fn().mockResolvedValue({ videoId: 'mock-video-id' }),
        generateContent: vi.fn().mockResolvedValue('Mock Intelligence response'),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

// Mock INTELLIGENCE_MODELS config
vi.mock('@/core/config/intelligence-models', () => ({
    INTELLIGENCE_MODELS: {
        IMAGE: {
            GENERATION: 'gemini-3-pro-image-preview',
            FAST: 'gemini-2.5-flash-image',
            DIRECT_PRO: 'gemini-3-pro-image-preview',
            DIRECT_FAST: 'gemini-3.1-flash-image',
        },
    },
}));

// Mock InputSanitizer
vi.mock('@/services/intelligence/utils/InputSanitizer', () => ({
    InputSanitizer: {
        sanitize: (p: string) => p,
        sanitizePrompt: (p: string) => p,
        validate: (p: string) => ({ valid: true, sanitized: p }),
        containsInjectionPatterns: () => false,
        analyzeInjectionRisk: () => ({ level: 'low', patterns: [] }),
    },
}));

// Mock IntelligenceImagePromptService
vi.mock('./IntelligenceImagePromptService', () => ({
    IntelligenceImagePromptService: {
        build: (opts: any) => opts.userPrompt,
    },
}));

describe('EditingService', () => {
    let EditingService: any;

    beforeEach(async () => {
        vi.resetAllMocks();
        mockEditImageFn.mockReset();
        mockUploadReferenceMedia.mockReset();
        mockUploadReferenceMedia.mockImplementation(async (_userId: string, media: string) => {
            if (media.includes('mask')) return 'gs://mock-bucket.appspot.com/users/test-user/vault/masks/mock-mask.png';
            if (media.includes('reference')) return 'gs://mock-bucket.appspot.com/users/test-user/vault/objects/mock-reference.png';
            return 'gs://mock-bucket.appspot.com/users/test-user/vault/objects/mock-image.png';
        });
        // Dynamic import to get fresh module each time
        const mod = await import('./EditingService');
        EditingService = new mod.EditingService();
    });

    describe('editImage', () => {
        it('should return an image result from the Direct SDK pipeline', async () => {
            mockEditImageFn.mockResolvedValue({
                data: {
                    id: 'test-uuid-1',
                    url: 'data:image/png;base64,base64encodeddata==',
                    prompt: 'Edit (Flash): Make the sky blue',
                    thoughtSignature: undefined,
                }
            });

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'Make the sky blue',
            });

            expect(result).not.toBeNull();
            expect(result!.url).toContain('data:image/png;base64,');
            expect(result!.prompt).toContain('Make the sky blue');
            expect(result!.id).toBeDefined();
            expect(mockEditImageFn).toHaveBeenCalledTimes(1);
            expect(mockEditImageFn).toHaveBeenCalledWith(expect.objectContaining({
                imageUri: 'gs://mock-bucket.appspot.com/users/test-user/vault/objects/mock-image.png',
            }));
        });

        it('should propagate thought signatures from direct SDK', async () => {
            mockEditImageFn.mockResolvedValue({
                data: {
                    id: 'test-uuid-2',
                    url: 'data:image/jpeg;base64,flatbase64data==',
                    prompt: 'Edit (Pro): Add rain',
                    thoughtSignature: 'test-sig-123',
                }
            });

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'Add rain',
            });

            expect(result).not.toBeNull();
            expect(result!.url).toBe('data:image/jpeg;base64,flatbase64data==');
            expect(result!.thoughtSignature).toBe('test-sig-123');
        });

        it('should return null when direct SDK returns null', async () => {
            mockEditImageFn.mockResolvedValue({ data: null });

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'Something impossible',
            });

            expect(result).toBeNull();
        });

        it('should pass forceHighFidelity to direct SDK', async () => {
            mockEditImageFn.mockResolvedValue({
                data: {
                    id: 'test-uuid-3',
                    url: 'data:image/png;base64,prodata==',
                    prompt: 'Edit (Pro): Make it cinematic',
                }
            });

            await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'Make it cinematic',
                forceHighFidelity: true,
            });

            expect(mockEditImageFn).toHaveBeenCalledWith(
                expect.objectContaining({
                    forceHighFidelity: true,
                })
            );
        });

        it('should pass mask data to direct SDK when provided', async () => {
            mockEditImageFn.mockResolvedValue({
                data: {
                    id: 'test-uuid-4',
                    url: 'data:image/png;base64,maskdata==',
                    prompt: 'Edit (Pro): Remove the background',
                }
            });

            await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                mask: { mimeType: 'image/png', data: 'maskbase64==' },
                prompt: 'Remove the background',
            });

            expect(mockEditImageFn).toHaveBeenCalledWith(
                expect.objectContaining({
                    maskUri: 'gs://mock-bucket.appspot.com/users/test-user/vault/masks/mock-mask.png',
                })
            );
        });
    });

    describe('batchEdit', () => {
        it('should process multiple images and track progress', async () => {
            mockEditImageFn
                .mockResolvedValueOnce({
                    data: {
                        id: 'batch-1',
                        url: 'data:image/png;base64,img1==',
                        prompt: 'Edit (Flash): Enhance all',
                    }
                })
                .mockResolvedValueOnce({
                    data: {
                        id: 'batch-2',
                        url: 'data:image/png;base64,img2==',
                        prompt: 'Edit (Flash): Enhance all',
                    }
                });

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
            mockEditImageFn
                .mockResolvedValueOnce({
                    data: {
                        id: 'ok-1',
                        url: 'data:image/png;base64,ok==',
                        prompt: 'Edit (Flash): Batch test',
                    }
                })
                .mockRejectedValueOnce(new Error('Safety filter blocked this content'));

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
            mockEditImageFn
                .mockRejectedValueOnce({ code: 'resource-exhausted', message: 'Rate limit' })
                .mockResolvedValueOnce({
                    data: {
                        id: 'retried-1',
                        url: 'data:image/png;base64,retried==',
                        prompt: 'Edit (Flash): Retry test',
                    }
                });

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'base64==' },
                prompt: 'Retry test',
            });

            expect(result).not.toBeNull();
            expect(mockEditImageFn).toHaveBeenCalledTimes(2);
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
