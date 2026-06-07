import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from '../VideoGenerationService';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { onSnapshot } from 'firebase/firestore';

vi.mock('@/services/creative/CreativeStorageService', () => ({
    CreativeStorageService: {
        uploadReferenceMedia: vi.fn().mockResolvedValue('gs://mock-bucket/mock-uri')
    }
}));

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: vi.fn().mockResolvedValue([{ url: 'https://grounded-image.png' }])
    }
}));

// Mock dependencies
vi.mock('../../intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        generateVideo: vi.fn().mockResolvedValue('https://storage.googleapis.com/mock-video.mp4'),
        generateContent: vi.fn().mockResolvedValue('Mock Intelligence response'),
        analyzeImage: vi.fn().mockResolvedValue('Mock analysis text')
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: {
        currentUser: { uid: 'test-user' }
    },
    db: {},
    functions: {},
    functionsWest1: {},
    remoteConfig: { defaultConfig: {} },
    storage: {},
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

const mockHttpsCallable = vi.fn().mockResolvedValue({ data: { jobId: 'mock-job-id' } });
vi.mock('firebase/functions', () => ({
    httpsCallable: () => mockHttpsCallable
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        serverTimestamp: vi.fn(),
        doc: vi.fn(() => ({ id: 'mock-doc-ref', path: 'videoJobs/mock-doc-ref' })),
        setDoc: vi.fn().mockResolvedValue(undefined),
        updateDoc: vi.fn().mockResolvedValue(undefined),
        onSnapshot: vi.fn(),
        Timestamp: {
            now: vi.fn(() => ({ toDate: () => new Date() })),
        },
    };
});

// Mock SubscriptionService
vi.mock('@/services/subscription/SubscriptionService', () => ({
    serverTimestamp: vi.fn(),
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 100 }),
        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: Promise.resolve('pro') })
    }
}));

// Mock MetadataPersistenceService
vi.mock('@/services/persistence/MetadataPersistenceService', () => ({
    metadataPersistenceService: {
        save: vi.fn().mockResolvedValue(undefined),
        saveVideoJob: vi.fn().mockResolvedValue(undefined),
        updateVideoJob: vi.fn().mockResolvedValue(undefined),
    }
}));

// Mock InputSanitizer
vi.mock('@/services/intelligence/utils/InputSanitizer', () => ({
    InputSanitizer: {
        sanitize: vi.fn((text: string) => text),
        sanitizePrompt: vi.fn((text: string) => text),
    }
}));

// Mock CostControlService
vi.mock('@/services/billing/CostControlService', () => ({
    CostControlService: {
        checkAndReserve: vi.fn().mockResolvedValue({ allowed: true }),
        releaseReservation: vi.fn().mockResolvedValue(undefined),
        confirmUsage: vi.fn().mockResolvedValue(undefined),
    }
}));

// Mock video utils to prevent HTMLMediaElement frame extraction timeout in jsdom
vi.mock('@/utils/video', () => ({
    extractLastFrameForAPI: vi.fn().mockResolvedValue({
        data: 'fake-frame-base64',
        mimeType: 'image/png',
    }),
}));

describe('VideoGenerationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateVideo', () => {
        it('should trigger video generation successfully', async () => {
            const result = await VideoGeneration.generateVideo({ prompt: 'test video' });

            expect(result).toHaveLength(1);
            expect(result[0]!.id).toBe('mock-job-id');
            expect(result[0]!.url).toBe('');
            // Verify it calls the Cloud Functions, not direct SDK path
            expect(mockHttpsCallable).toHaveBeenCalled();
        });

        it('should throw error if quota is exceeded', async () => {
            vi.mocked(subscriptionService.canPerformAction).mockResolvedValueOnce({
                allowed: false,
                reason: 'Daily limit reached',
                upgradeRequired: true
            });

            await expect(VideoGeneration.generateVideo({ prompt: 'test video' }))
                .rejects.toThrow(/Quota exceeded/);
        });

        it('should upload firstFrame as reference media', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'test video',
                firstFrame: 'data:image/png;base64,start'
            });

            const { CreativeStorageService } = await import('@/services/creative/CreativeStorageService');
            expect(CreativeStorageService.uploadReferenceMedia).toHaveBeenCalled();
        });

        it('should handle long-form video generation', async () => {
            const result = await VideoGeneration.generateLongFormVideo({
                prompt: 'long video',
                totalDuration: 60
            });

            expect(result).toHaveLength(1);
            expect(result[0]!.id).toMatch(/^long_/);
            // Long-form should also call generateVideo for each segment
            expect(AutonomousIntelligence.generateVideo).toHaveBeenCalled();
        });
    });

    describe('waitForJob (Async Veo Pipeline)', () => {
        it('should resolve when job status is completed with Veo metadata', async () => {
            const mockJobId = 'veo-job-123';
            const mockVeoMetadata = {
                status: 'completed',
                url: 'https://storage.googleapis.com/veo-video.mp4',
                metadata: {
                    duration_seconds: 5.0,
                    fps: 24,
                    mime_type: 'video/mp4',
                    resolution: '1280x720'
                }
            };

            // Mock onSnapshot to simulate job progression
            vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: (snapshot: unknown) => void) => {
                // 1. Pending
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => ({ status: 'pending' })
                } as unknown as import('firebase/firestore').DocumentSnapshot);

                // 2. Completed (Simulating async update)
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => mockVeoMetadata
                    } as unknown as import('firebase/firestore').DocumentSnapshot);
                }, 10);

                return vi.fn(); // Unsubscribe mock
            }) as unknown as typeof import('firebase/firestore').onSnapshot);

            const job = await VideoGeneration.waitForJob(mockJobId);

            expect(job.status).toBe('completed');
            expect(job.url).toBe(mockVeoMetadata.url);
            expect((job.metadata as unknown as Record<string, unknown>).fps).toBe(24);
            expect((job.metadata as unknown as Record<string, unknown>).mime_type).toBe('video/mp4');
        });

        it('should reject when job status is failed (SafetySettings)', async () => {
            const mockJobId = 'unsafe-job';

            vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: (snapshot: unknown) => void) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => ({
                            serverTimestamp: vi.fn(),
                            status: 'failed',
                            error: 'Safety violation: Content blocked by safety filters.'
                        })
                    } as unknown as import('firebase/firestore').DocumentSnapshot);
                }, 10);
                return vi.fn();
            }) as unknown as typeof import('firebase/firestore').onSnapshot);

            await expect(VideoGeneration.waitForJob(mockJobId))
                .rejects.toThrow('Safety violation');
        });

        it('should distinguish between Flash (fast) and Pro (slow) timeouts', async () => {
            const mockJobId = 'slow-pro-job';

            // Simulate a job that never completes within the test timeout
            vi.mocked(onSnapshot).mockImplementation(((ref: unknown, callback: (snapshot: unknown) => void) => {
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => ({ status: 'processing' })
                } as unknown as import('firebase/firestore').DocumentSnapshot);
                return vi.fn();
            }) as unknown as typeof import('firebase/firestore').onSnapshot);

            // Use a short timeout for the test
            const SHORT_TIMEOUT = 100;

            await expect(VideoGeneration.waitForJob(mockJobId, SHORT_TIMEOUT))
                .rejects.toThrow(`Video generation timeout for Job ID: ${mockJobId}`);
        });
    });

    describe('Parameter Forwarding & Image Sources', () => {
        it('should forward all parameters to gateway payload in generateVideo', async () => {
            const options = {
                prompt: 'cinematic video of a cat',
                firstFrame: 'data:image/png;base64,start',
                lastFrame: 'data:image/png;base64,end',
                referenceImages: [
                    { image: { uri: 'data:image/png;base64,ref1' }, referenceType: 'asset' as const }
                ],
                aspectRatio: '16:9' as const,
                model: 'veo-3.1-generate-preview',
                resolution: '1080p' as const,
                duration: 6,
                personGeneration: 'allow_adult' as const,
                negativePrompt: 'blurry',
                seed: 42
            };

            await VideoGeneration.generateVideo(options);

            expect(mockHttpsCallable).toHaveBeenCalledWith({
                prompt: expect.stringContaining('cinematic video of a cat'),
                firstFrameUri: 'gs://mock-bucket/mock-uri',
                lastFrameUri: 'gs://mock-bucket/mock-uri',
                referenceUris: ['gs://mock-bucket/mock-uri'],
                aspectRatio: '16:9',
                model: 'veo-3.1-generate-preview',
                resolution: '1080p',
                durationSeconds: 6,
                personGeneration: 'allow_adult',
                negativePrompt: 'blurry',
                seed: 42
            });
        });

        it('should handle gs:// URIs and HTTP URLs in MediaGenerator', async () => {
            const { generateVideo } = await import('../../intelligence/generators/MediaGenerator');
            
            // Mock global fetch
            const mockFetchResponse = {
                ok: true,
                blob: vi.fn().mockResolvedValue({
                    type: 'image/png',
                    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
                })
            };
            const originalFetch = global.fetch;
            global.fetch = vi.fn().mockResolvedValue(mockFetchResponse);

            try {
                const mockClient = {
                    models: {
                        generateVideos: vi.fn().mockResolvedValue({
                            name: 'mock-op-name',
                            done: true,
                            response: {
                                generatedVideos: [{
                                    video: {
                                        uri: 'https://mock-uri',
                                        mimeType: 'video/mp4'
                                    }
                                }]
                            }
                        })
                    }
                } as any;

                // 1. Test gs:// URI input
                await generateVideo(mockClient, {
                    prompt: 'test',
                    image: { imageBytes: 'gs://bucket/frame.png', mimeType: 'image/png' },
                    config: {
                        lastFrame: 'gs://bucket/last.png',
                        referenceImages: [
                            { image: { uri: 'gs://bucket/ref.png' }, referenceType: 'asset' }
                        ]
                    }
                });

                expect(mockClient.models.generateVideos).toHaveBeenLastCalledWith({
                    model: expect.any(String),
                    prompt: 'test',
                    image: { gcsUri: 'gs://bucket/frame.png' },
                    config: expect.objectContaining({
                        lastFrame: { gcsUri: 'gs://bucket/last.png' },
                        referenceImages: [
                            { image: { gcsUri: 'gs://bucket/ref.png' }, referenceType: 'asset' }
                        ]
                    })
                });

                // 2. Test HTTP URL input
                await generateVideo(mockClient, {
                    prompt: 'test',
                    image: { imageBytes: 'https://example.com/frame.png', mimeType: 'image/png' }
                });

                expect(global.fetch).toHaveBeenCalledWith('https://example.com/frame.png');
                expect(mockClient.models.generateVideos).toHaveBeenLastCalledWith({
                    model: expect.any(String),
                    prompt: 'test',
                    image: { imageBytes: expect.any(String), mimeType: 'image/png' },
                    config: expect.any(Object)
                });
            } finally {
                global.fetch = originalFetch;
            }
        });
    });

    describe('Google Grounding Pre-flight & Long Form References', () => {
        it('should trigger pre-flight Imagen 3 generation when useGrounding is true and firstFrame is empty', async () => {
            const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
            const { CreativeStorageService } = await import('@/services/creative/CreativeStorageService');

            await VideoGeneration.generateVideo({
                prompt: 'grounded location video',
                useGrounding: true
            });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith({
                prompt: 'grounded location video',
                count: 1,
                aspectRatio: '16:9',
                useGoogleSearch: true,
                model: 'fast'
            });

            // Ensure the generated image was uploaded
            expect(CreativeStorageService.uploadReferenceMedia).toHaveBeenCalledWith(
                'test-user',
                'https://grounded-image.png',
                'image'
            );
        });

        it('should forward reference images in generateLongFormVideo', async () => {
            const spyGenerateVideo = vi.spyOn(AutonomousIntelligence, 'generateVideo').mockResolvedValue('https://storage.googleapis.com/segment-video.mp4');

            await VideoGeneration.generateLongFormVideo({
                prompt: 'long video with refs',
                totalDuration: 10,
                referenceImages: [
                    { image: { uri: 'gs://bucket/ref1.png' }, referenceType: 'asset' }
                ],
                personGeneration: 'allow_adult'
            });

            expect(spyGenerateVideo).toHaveBeenCalledWith(expect.objectContaining({
                config: expect.objectContaining({
                    referenceImages: [
                        { image: { uri: 'gs://bucket/ref1.png' }, referenceType: 'asset' }
                    ]
                })
            }));

            spyGenerateVideo.mockRestore();
        });
    });
});

