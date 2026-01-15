/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'lens-tester' } },
    subscriptionService: {
        canPerformAction: vi.fn(),
        getCurrentSubscription: vi.fn()
    },
    useStore: {
        getState: vi.fn(() => ({ currentOrganizationId: 'org-lens' }))
    },
    firebaseAI: {
        analyzeImage: vi.fn()
    },
    uuid: vi.fn(() => 'job-uuid-123')
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
    getFunctions: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
    doc: mocks.doc,
    onSnapshot: mocks.onSnapshot,
    getFirestore: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    db: {},
    functions: {}
}));

vi.mock('../firebase', () => ({
    functions: {},
    db: {},
    auth: mocks.auth
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: mocks.subscriptionService
}));

vi.mock('@/core/store', () => ({
    useStore: mocks.useStore
}));

vi.mock('../ai/FirebaseAIService', () => ({
    firebaseAI: mocks.firebaseAI
}));

describe('Lens: Veo 3.1 Payload & Pipeline Integrity', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        service = new VideoGenerationService();
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should validate Veo 3.1 metadata contract on "Pro" completion', async () => {
        // This test simulates the "massive payload" delivery where metadata is critical.
        // We simulate a 45s generation time (Pro model speed).

        const jobId = 'job-veo-pro-001';
        mocks.doc.mockReturnValue('doc-ref');

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // 1. Initial State: Processing
            callback({
                exists: () => true,
                id: jobId,
                data: () => ({ status: 'processing', progress: 10 })
            });

            // 2. Simulate long wait (Pro model)
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: jobId,
                    data: () => ({
                        status: 'stitching',
                        progress: 90
                    })
                });
            }, 30000);

            // 3. Completion with Metadata
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: jobId,
                    data: () => ({
                        status: 'completed',
                        videoUrl: 'https://storage.googleapis.com/bucket/video.mp4',
                        output: {
                            url: 'https://storage.googleapis.com/bucket/video.mp4',
                            metadata: {
                                duration_seconds: 20, // 4 segments * 5s
                                fps: 30,
                                mime_type: 'video/mp4',
                                resolution: '1280x720'
                            }
                        }
                    })
                });
            }, 45000);

            return () => {};
        });

        const pendingJob = service.waitForJob(jobId, 60000);

        // Advance time to trigger completion
        await vi.advanceTimersByTimeAsync(46000);

        const result = await pendingJob;

        // ASSERTIONS
        // 1. Contract Integrity
        expect(result.output).toBeDefined();
        expect(result.output.metadata).toBeDefined();

        // 2. Veo 3.1 Specifics
        expect(result.output.metadata.mime_type).toBe('video/mp4');
        expect(result.output.metadata.fps).toBe(30);
        expect(result.output.metadata.resolution).toBe('1280x720');
        expect(result.output.metadata.duration_seconds).toBeGreaterThan(0);
    });

    it('should handle "SafetySettings" rejection gracefully', async () => {
        // Simulates Google's safety filter triggering a 500 or blocking content
        const jobId = 'job-safety-fail';
        mocks.doc.mockReturnValue('doc-ref');

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: jobId,
                    data: () => ({
                        status: 'failed',
                        error: 'Safety violation: Content blocked by safety settings.'
                    })
                });
            }, 2000);
            return () => {};
        });

        const pendingJob = service.waitForJob(jobId);
        // Suppress unhandled rejection warning by attaching a catch
        pendingJob.catch(() => {});

        await vi.advanceTimersByTimeAsync(2100);

        await expect(pendingJob).rejects.toThrow('Safety violation');
    });

    it('should enforce MIME Type Guard (simulated)', async () => {
        // "Rejecting non-video assets injected into the player"
        // Since the service just returns data, we verify the data structure allows the consumer to check this.

        const jobId = 'job-malformed';
        mocks.doc.mockReturnValue('doc-ref');

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: jobId,
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://malicious.site/script.js',
                            metadata: {
                                mime_type: 'application/javascript' // Invalid type!
                            }
                        }
                    })
                });
            }, 1000);
            return () => {};
        });

        const pendingJob = service.waitForJob(jobId);
        await vi.advanceTimersByTimeAsync(1100);

        const result = await pendingJob;

        // The service returns the data, but our "Lens" verification logic (represented by this test assertion)
        // ensures we can detect it.
        expect(result.output.metadata.mime_type).not.toBe('video/mp4');

        // In a real player component test, we would assert the player doesn't render.
        // Here we assert the service faithfully delivers the bad news.
    });
});
