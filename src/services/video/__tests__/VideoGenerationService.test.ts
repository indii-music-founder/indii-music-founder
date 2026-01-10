import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from '../VideoGenerationService';
import { firebaseAI } from '../../ai/FirebaseAIService';
import { httpsCallable } from 'firebase/functions';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { onSnapshot } from 'firebase/firestore';

// Mock dependencies
vi.mock('../../ai/FirebaseAIService', () => ({
    firebaseAI: {
        analyzeImage: vi.fn().mockResolvedValue("Mocked temporal analysis result.")
    }
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user' }
    },
    db: {},
    functions: {}
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: { jobId: 'mock-job-id' } }))
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    onSnapshot: vi.fn()
}));

// Mock SubscriptionService
vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 100 }),
        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: Promise.resolve('pro') })
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
            expect(result[0].id).toBeDefined(); // UUID is generated dynamically
            expect(result[0].url).toBe(''); // Async job returns empty URL
            expect(httpsCallable).toHaveBeenCalled();
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
            expect(result[0].id).toMatch(/^long_/);
            expect(result[0].url).toBe('');
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
                    data: () => ({ status: 'pending' })
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
            expect(job.metadata.fps).toBe(24);
            expect(job.metadata.mime_type).toBe('video/mp4');
        });

        it('should reject when job status is failed (SafetySettings)', async () => {
            const mockJobId = 'unsafe-job';

            vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => ({
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
                    data: () => ({ status: 'processing' })
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
