import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGeneration } from '../VideoGenerationService';
import { onSnapshot } from 'firebase/firestore';

// Mock dependencies
vi.mock('../../ai/FirebaseAIService', () => ({
  serverTimestamp: vi.fn(),
    firebaseAI: {
        analyzeImage: vi.fn().mockResolvedValue("Mocked temporal analysis result.")
    }
}));

vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: {
        currentUser: { uid: 'lens-verifier' }
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

// Mock SubscriptionService to always allow
vi.mock('@/services/subscription/SubscriptionService', () => ({
  serverTimestamp: vi.fn(),
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 100 }),
        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: Promise.resolve('pro') })
    }
}));

// Mock functions to capture arguments
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  serverTimestamp: vi.fn(),
    httpsCallable: vi.fn((functions, name) => {
        return (...args: any[]) => mockHttpsCallable(name, ...args);
    })
}));

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
    serverTimestamp: vi.fn(),
        ...actual,
        doc: vi.fn(),
        onSnapshot: vi.fn()
    };
});

describe('🎥 Lens: Veo 3.1 & Gemini 3 Integration Verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Veo 3.1 Metadata Integrity', () => {
        it('should strictly enforce Veo 3.1 metadata contract', async () => {
            const mockJobId = 'veo-integrity-check';
            const mockVeoMetadata = {
                status: 'completed',
                url: 'https://storage.googleapis.com/veo-video.mp4', // Mocked Signed URL
                metadata: {
                    duration_seconds: 5.0,
                    fps: 24, // Veo standard
                    mime_type: 'video/mp4',
                    resolution: '1280x720'
                }
            };

            vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
                // Simulate "Processing" -> "Success"
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => ({
  serverTimestamp: vi.fn(), status: 'processing' })
                } as any);

                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => mockVeoMetadata
                    } as any);
                }, 1000);

                return vi.fn();
            });

            const jobPromise = VideoGeneration.waitForJob(mockJobId);

            // Advance time to trigger completion
            vi.advanceTimersByTime(1100);

            const job = await jobPromise;

            expect(job.status).toBe('completed');
            expect(job.metadata!.fps).toBe(24);
            expect(job.metadata!.mime_type).toBe('video/mp4');
            expect(job.metadata!.duration_seconds).toBe(5.0);
            // Verify URL is present (Lens philosophy: A 404 is a critical failure, here we ensure we get a URL)
            expect(job.url).toBeDefined();
        });
    });

    describe('Flash vs Pro Generation Speed', () => {
        it('should handle Flash generation (< 2s)', async () => {
            const mockJobId = 'flash-job';

            vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => ({
  serverTimestamp: vi.fn(), status: 'completed', url: 'http://fast.url' })
                    } as any);
                }, 500); // 0.5s
                return vi.fn();
            });

            const jobPromise = VideoGeneration.waitForJob(mockJobId, 2000); // 2s timeout

            vi.advanceTimersByTime(510);

            await expect(jobPromise).resolves.toHaveProperty('status', 'completed');
        });

        it('should handle Pro generation (< 30s) and timeout if too slow', async () => {
            const mockJobId = 'pro-job-slow';

            vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => ({
  serverTimestamp: vi.fn(), status: 'processing' })
                } as any);
                return vi.fn();
            });

            const jobPromise = VideoGeneration.waitForJob(mockJobId, 30000); // 30s timeout

            // Advance past 30s
            vi.advanceTimersByTime(30001);

            await expect(jobPromise).rejects.toThrow(/Video generation timeout/);
        });
    });

    describe('SafetySettings Handshake', () => {
        it('should gracefully handle Gemini/Veo safety blocks', async () => {
            const mockJobId = 'unsafe-content';

            vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: mockJobId,
                        data: () => ({
  serverTimestamp: vi.fn(),
                            status: 'failed',
                            error: 'Safety violation: Harassment filter triggered.'
                        })
                    } as any);
                }, 100);
                return vi.fn();
            });

            const jobPromise = VideoGeneration.waitForJob(mockJobId);
            vi.advanceTimersByTime(110);

            await expect(jobPromise).rejects.toThrow(/Safety violation/);
        });
    });

    describe('Prompt Enhancer Flow', () => {
        it('should inject camera and motion parameters into the prompt', async () => {
            mockHttpsCallable.mockResolvedValue({ data: { jobId: 'test-job' } });

            await VideoGeneration.generateVideo({
                prompt: 'A Cyberpunk city',
                cameraMovement: 'Pan Right',
                motionStrength: 0.9,
                fps: 24
            });

            // Inspect the call to triggerVideoJob
            expect(mockHttpsCallable).toHaveBeenCalledWith('triggerVideoJob', expect.objectContaining({
                prompt: expect.stringContaining('cinematic pan right camera movement'),
                jobId: expect.any(String)
            }));

            // Verify motion strength enrichment
            expect(mockHttpsCallable).toHaveBeenCalledWith('triggerVideoJob', expect.objectContaining({
                prompt: expect.stringContaining('high dynamic motion')
            }));
        });
    });
});
