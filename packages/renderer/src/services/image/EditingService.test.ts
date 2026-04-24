import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/functions (still needed for module resolution)
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    httpsCallable: (...args: any[]) => mockHttpsCallable(...args),
    connectFunctionsEmulator: vi.fn(),
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

// Mock FirebaseAIService
vi.mock('../ai/FirebaseAIService', () => ({
    GenAI: {
        generateContent: vi.fn(),
    },
}));

// Mock AI_MODELS config
vi.mock('@/core/config/ai-models', () => ({
    AI_MODELS: {
        IMAGE: {
            GENERATION: 'gemini-3-pro-image-preview',
            FAST: 'gemini-2.5-flash-image',
            DIRECT_PRO: 'gemini-3-pro-image-preview',
            DIRECT_FAST: 'gemini-3.1-flash-image-preview',
        },
    },
}));

// Mock InputSanitizer — must expose `sanitize`, `validate`, and `containsInjectionPatterns`
// to match the real static class API used by DirectImageEditor and EditingService.
vi.mock('@/services/ai/utils/InputSanitizer', () => ({
    InputSanitizer: {
        sanitize: (p: string) => p,
        sanitizePrompt: (p: string) => p,
        validate: (p: string) => ({ valid: true, sanitized: p }),
        containsInjectionPatterns: () => false,
        analyzeInjectionRisk: () => ({ level: 'low', patterns: [] }),
    },
}));

// Mock PromptBuilder
vi.mock('./PromptBuilderService', () => ({
    PromptBuilder: {
        build: (opts: any) => opts.userPrompt,
    },
}));

// Mock DirectImageEditor — editImageDirectly is the actual call path
// after the Cloud Function → Direct SDK refactor.
const mockEditImageDirectly = vi.fn();
vi.mock('@/services/ai/generators/DirectImageEditor', () => ({
    editImageDirectly: (...args: any[]) => mockEditImageDirectly(...args),
}));

describe('EditingService', () => {
    let EditingService: any;

    beforeEach(async () => {
        vi.resetAllMocks();
        mockEditImageDirectly.mockReset();
        // Dynamic import to get fresh module each time
        const mod = await import('./EditingService');
        EditingService = mod.Editing;
    });

    describe('editImage', () => {
        it('should return an image result from the Direct SDK pipeline', async () => {
            mockEditImageDirectly.mockResolvedValue({
                id: 'test-uuid-1',
                url: 'data:image/png;base64,base64encodeddata==',
                prompt: 'Edit (Flash): Make the sky blue',
                thoughtSignature: undefined,
            });

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'Make the sky blue',
            });

            expect(result).not.toBeNull();
            expect(result!.url).toContain('data:image/png;base64,');
            expect(result!.prompt).toContain('Make the sky blue');
            expect(result!.id).toBeDefined();
            expect(mockEditImageDirectly).toHaveBeenCalledTimes(1);
        });

        it('should propagate thought signatures from direct SDK', async () => {
            mockEditImageDirectly.mockResolvedValue({
                id: 'test-uuid-2',
                url: 'data:image/jpeg;base64,flatbase64data==',
                prompt: 'Edit (Pro): Add rain',
                thoughtSignature: 'test-sig-123',
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
            mockEditImageDirectly.mockResolvedValue(null);

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'Something impossible',
            });

            expect(result).toBeNull();
        });

        it('should pass forceHighFidelity to direct SDK', async () => {
            mockEditImageDirectly.mockResolvedValue({
                id: 'test-uuid-3',
                url: 'data:image/png;base64,prodata==',
                prompt: 'Edit (Pro): High quality edit',
            });

            await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'inputbase64==' },
                prompt: 'High quality edit',
                forceHighFidelity: true,
            });

            // Verify editImageDirectly was called with forceHighFidelity
            expect(mockEditImageDirectly).toHaveBeenCalledWith(expect.objectContaining({
                forceHighFidelity: true,
                prompt: 'High quality edit',
            }));
        });

        it('should pass mask data to direct SDK when provided', async () => {
            mockEditImageDirectly.mockResolvedValue({
                id: 'test-uuid-4',
                url: 'data:image/png;base64,maskedresult==',
                prompt: 'Edit (Flash): Remove the background',
            });

            await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'base64==' },
                mask: { mimeType: 'image/png', data: 'maskbase64==' },
                prompt: 'Remove the background',
            });

            expect(mockEditImageDirectly).toHaveBeenCalledWith(expect.objectContaining({
                mask: { mimeType: 'image/png', data: 'maskbase64==' },
                prompt: 'Remove the background',
            }));
        });
    });

    describe('batchEdit', () => {
        it('should process multiple images and track progress', async () => {
            mockEditImageDirectly
                .mockResolvedValueOnce({
                    id: 'batch-1',
                    url: 'data:image/png;base64,img1==',
                    prompt: 'Edit (Flash): Enhance all',
                })
                .mockResolvedValueOnce({
                    id: 'batch-2',
                    url: 'data:image/png;base64,img2==',
                    prompt: 'Edit (Flash): Enhance all',
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
            mockEditImageDirectly
                .mockResolvedValueOnce({
                    id: 'ok-1',
                    url: 'data:image/png;base64,ok==',
                    prompt: 'Edit (Flash): Batch test',
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
            mockEditImageDirectly
                .mockRejectedValueOnce({ code: 'resource-exhausted', message: 'Rate limit' })
                .mockResolvedValueOnce({
                    id: 'retried-1',
                    url: 'data:image/png;base64,retried==',
                    prompt: 'Edit (Flash): Retry test',
                });

            const result = await EditingService.editImage({
                image: { mimeType: 'image/png', data: 'base64==' },
                prompt: 'Retry test',
            });

            expect(result).not.toBeNull();
            expect(mockEditImageDirectly).toHaveBeenCalledTimes(2);
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
