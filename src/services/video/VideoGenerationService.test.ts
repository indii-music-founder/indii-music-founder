/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Hoisted mocks for dependencies
const mocks = vi.hoisted(() => ({
  serverTimestamp: vi.fn(),
    httpsCallable: vi.fn(),
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'test-user' } },
    subscriptionService: {
        canPerformAction: vi.fn(),
        getCurrentSubscription: vi.fn()
    },
    useStore: {
        getState: vi.fn(() => ({
  serverTimestamp: vi.fn(), currentOrganizationId: 'org-123' }))
    },
    firebaseAI: {
        analyzeImage: vi.fn(),
        generateVideo: vi.fn().mockResolvedValue('https://storage.googleapis.com/mock/video.mp4')
    },
    uuid: vi.fn(() => 'mock-uuid')
}));

// 2. Mock modules
vi.mock('firebase/functions', () => ({
  serverTimestamp: vi.fn(),
    httpsCallable: mocks.httpsCallable,
    getFunctions: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(() => new Date()),
    doc: mocks.doc,
    onSnapshot: mocks.onSnapshot,
    getFirestore: vi.fn(),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    collection: vi.fn(() => ({ id: 'mock-coll-id' })),
}));

vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: mocks.auth,
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

// Handle dynamic import used in VideoGenerationService
vi.mock('../firebase', () => ({
  serverTimestamp: vi.fn(),
    functions: {},
    functionsWest1: {},
    db: {},
    auth: mocks.auth
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
  serverTimestamp: vi.fn(),
    subscriptionService: mocks.subscriptionService
}));

vi.mock('@/core/store', () => ({
  serverTimestamp: vi.fn(),
    useStore: mocks.useStore
}));

vi.mock('../ai/FirebaseAIService', () => ({
  serverTimestamp: vi.fn(),
    firebaseAI: mocks.firebaseAI
}));

vi.mock('uuid', () => ({
  serverTimestamp: vi.fn(),
    v4: mocks.uuid
}));

// Import service AFTER mocks
import { VideoGenerationService } from './VideoGenerationService';

describe('VideoGenerationService (Veo 3.1 Pipeline)', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoGenerationService();
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        // Default happy path for quota
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        mocks.subscriptionService.getCurrentSubscription.mockResolvedValue({ tier: 'pro' });
        // Default happy path for function trigger
        mocks.httpsCallable.mockReturnValue(async () => ({
  serverTimestamp: vi.fn(), data: { jobId: 'job-123' } }));
    });

    describe('generateVideo', () => {
        it('should enforce quota limits before triggering job', async () => {
            mocks.subscriptionService.canPerformAction.mockResolvedValue({
                allowed: false,
                reason: 'Quota exceeded'
            });

            await expect(service.generateVideo({ prompt: 'test' }))
                .rejects.toThrow('Quota exceeded: Quota exceeded');
        });

        it('should trigger video generation with correct parameters', async () => {
            const result = await service.generateVideo({
                prompt: 'A cinematic shot',
                aspectRatio: '16:9',
                resolution: '1080p'
            });

            // firebaseAI.generateVideo should be called directly (no Cloud Functions)
            expect(mocks.firebaseAI.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
                prompt: expect.stringContaining('A cinematic shot'),
                config: expect.objectContaining({
                    aspectRatio: '16:9',
                }),
            }));

            expect(result).toHaveLength(1);
            expect(result[0]!.id).toBe('mock-uuid');
        });
    });

    describe('waitForJob (Veo Metadata Verification)', () => {
        it('should resolve with Veo 3.1 specific metadata on completion', async () => {
            // Mock onSnapshot to simulate job completion
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                // Simulate async update
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'job-123',
                        data: () => ({
  serverTimestamp: vi.fn(),
                            status: 'completed',
                            output: {
                                url: 'https://storage.googleapis.com/mock/video.mp4',
                                metadata: {
                                    duration_seconds: 5.0,
                                    fps: 24,
                                    mime_type: 'video/mp4',
                                    resolution: '720p' // 720p is typical for preview
                                }
                            }
                        })
                    });
                }, 10);
                return () => { }; // unsubscribe
            });

            const job = await service.waitForJob('job-123');

            expect(job.status).toBe('completed');
            expect(job.output!.metadata).toBeDefined();
            expect((job.output!.metadata as Record<string, unknown>)!.duration_seconds).toBeGreaterThan(0);
            expect([24, 30, 60]).toContain((job.output!.metadata as Record<string, unknown>)!.fps);
            expect(job.output!.metadata!.mime_type).toBe('video/mp4');
            expect(job.output!.metadata).toEqual(expect.objectContaining({
                duration_seconds: 5.0,
                fps: 24,
                mime_type: 'video/mp4'
            }));
        });

        it('should handle SafetySettings rejection (Gemini 3 Guardrails)', async () => {
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'job-123',
                        data: () => ({
  serverTimestamp: vi.fn(),
                            status: 'failed',
                            error: 'Safety violation: Content blocked by safety filters.'
                        })
                    });
                }, 10);
                return () => { };
            });

            await expect(service.waitForJob('job-123'))
                .rejects.toThrow('Safety violation: Content blocked by safety filters.');
        });
    });

    describe('generateLongFormVideo (Veo 3.1 Streaming)', () => {
        it('should enforce duration-based quota for long-form video', async () => {
            mocks.subscriptionService.canPerformAction.mockResolvedValue({
                allowed: false,
                reason: 'Duration limit exceeded',
                currentUsage: { limit: 10 }
            });

            await expect(service.generateLongFormVideo({
                prompt: 'Long video',
                totalDuration: 60
            })).rejects.toThrow('Duration limit exceeded');

            expect(mocks.subscriptionService.canPerformAction).toHaveBeenCalledWith('generateVideo', 60);
        });

        it('should segment prompt into multiple blocks for long duration (Pro scenario)', async () => {
            // 20s duration with 8s block size = 3 blocks (8, 8, 4)
            await service.generateLongFormVideo({
                prompt: 'Epic space battle',
                totalDuration: 20
            });

            // firebaseAI.generateVideo should be called 3 times (one per segment)
            expect(mocks.firebaseAI.generateVideo).toHaveBeenCalledTimes(3);

            // Verify prompt format for each segment
            const calls = mocks.firebaseAI.generateVideo.mock.calls;
            expect(calls[0]![0].prompt).toContain('Epic space battle');
            expect(calls[0]![0].prompt).toContain('Part 1/3');
            expect(calls[1]![0].prompt).toContain('Part 2/3');
            expect(calls[2]![0].prompt).toContain('Part 3/3');
        });

        it('should generate single block for short duration (Flash scenario)', async () => {
            // 5s duration with 8s block size = 1 block
            await service.generateLongFormVideo({
                prompt: 'Quick reaction',
                totalDuration: 5
            });

            expect(mocks.firebaseAI.generateVideo).toHaveBeenCalledTimes(1);
            expect(mocks.firebaseAI.generateVideo.mock.calls[0]![0].prompt).toContain('Part 1/1');
        });

        it('should pass firstFrame image to the first segment only', async () => {
            const startImage = 'data:image/png;base64,abc';
            await service.generateLongFormVideo({
                prompt: 'continuation',
                totalDuration: 10,
                firstFrame: startImage,
                aspectRatio: '9:16'
            });

            // Should be called 2 times (10s / 8s block = 2 blocks)
            expect(mocks.firebaseAI.generateVideo).toHaveBeenCalledTimes(2);

            // First segment should have the image
            const firstCall = mocks.firebaseAI.generateVideo.mock.calls[0]![0];
            expect(firstCall.image).toEqual({
                imageBytes: startImage,
                mimeType: 'image/jpeg'
            });

            // Second segment should NOT have the image
            const secondCall = mocks.firebaseAI.generateVideo.mock.calls[1]![0];
            expect(secondCall.image).toBeUndefined();
        });
    });
});
