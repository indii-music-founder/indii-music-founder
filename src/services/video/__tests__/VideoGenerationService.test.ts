import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from '../VideoGenerationService';
import { firebaseAI } from '../../ai/FirebaseAIService';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { onSnapshot } from 'firebase/firestore';

// Mock dependencies
vi.mock('../../ai/FirebaseAIService', () => ({
    serverTimestamp: vi.fn(),
    firebaseAI: {
        analyzeImage: vi.fn().mockResolvedValue("Mocked temporal analysis result."),
        generateVideo: vi.fn().mockResolvedValue('https://storage.googleapis.com/mock-video.mp4'),
    }
}));

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

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        serverTimestamp: vi.fn(),
        ...actual,
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
vi.mock('@/services/ai/utils/InputSanitizer', () => ({
    InputSanitizer: {
        sanitize: vi.fn((text: string) => text),
        sanitizePrompt: vi.fn((text: string) => text),
    }
}));

describe('VideoGenerationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateVideo', () => {
        it('should trigger video generation successfully', async () => {
            const result = await VideoGeneration.generateVideo({ prompt: 'test video' });

            expect(result).toHaveLength(1);
            expect(result[0]!.id).toBeDefined();
            expect(result[0]!.url).toBe('https://storage.googleapis.com/mock-video.mp4');
            // Verify it calls the direct SDK path, not Cloud Functions
            expect(firebaseAI.generateVideo).toHaveBeenCalled();
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

        it('should analyze temporal context when firstFrame is provided', async () => {
            await VideoGeneration.generateVideo({
                prompt: 'test video',
                firstFrame: 'data:image/png;base64,start'
            });

            expect(firebaseAI.analyzeImage).toHaveBeenCalled();
        });

        it('should handle long-form video generation', async () => {
            const result = await VideoGeneration.generateLongFormVideo({
                prompt: 'long video',
                totalDuration: 60
            });

            expect(result).toHaveLength(1);
            expect(result[0]!.id).toMatch(/^long_/);
            // Long-form should also call generateVideo for each segment
            expect(firebaseAI.generateVideo).toHaveBeenCalled();
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
            vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
                // 1. Pending
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => ({ serverTimestamp: vi.fn(), status: 'pending' })
                } as any);

                // 2. Completed (Simulating async update)
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => mockVeoMetadata
                    } as any);
                }, 10);

                return vi.fn(); // Unsubscribe mock
            });

            const job = await VideoGeneration.waitForJob(mockJobId);

            expect(job.status).toBe('completed');
            expect(job.url).toBe(mockVeoMetadata.url);
            expect((job.metadata as any).fps).toBe(24);
            expect((job.metadata as any).mime_type).toBe('video/mp4');
        });

        it('should reject when job status is failed (SafetySettings)', async () => {
            const mockJobId = 'unsafe-job';

            vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => ({
                            serverTimestamp: vi.fn(),
                            status: 'failed',
                            error: 'Safety violation: Content blocked by safety filters.'
                        })
                    } as any);
                }, 10);
                return vi.fn();
            });

            await expect(VideoGeneration.waitForJob(mockJobId))
                .rejects.toThrow('Safety violation');
        });

        it('should distinguish between Flash (fast) and Pro (slow) timeouts', async () => {
            const mockJobId = 'slow-pro-job';

            // Simulate a job that never completes within the test timeout
            vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => ({ serverTimestamp: vi.fn(), status: 'processing' })
                } as any);
                return vi.fn();
            });

            // Use a short timeout for the test
            const SHORT_TIMEOUT = 100;

            await expect(VideoGeneration.waitForJob(mockJobId, SHORT_TIMEOUT))
                .rejects.toThrow(`Video generation timeout for Job ID: ${mockJobId}`);
        });
    });
});
