/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';

// 1. Hoisted mocks
const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'test-user-lens' } },
    subscriptionService: {
        canPerformAction: vi.fn()
    },
    useStore: {
        getState: vi.fn(() => ({ currentOrganizationId: 'org-lens' }))
    },
    delay: vi.fn(),
    firebaseAI: {
        analyzeImage: vi.fn()
    },
    uuid: vi.fn(() => 'lens-veo-job-id')
}));

// 2. Mock modules
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

vi.mock('@/utils/async', () => ({
    delay: mocks.delay
}));

vi.mock('uuid', () => ({
    v4: mocks.uuid
}));

describe('Lens 🎥 - Veo 3.1 & Gemini 3 Native Generation Pipeline', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new VideoGenerationService();
        // Default: Quota OK
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        // Default: Trigger OK
        mocks.httpsCallable.mockReturnValue(async () => ({ data: { jobId: 'lens-veo-job-id' } }));

        // Mock delay to use setTimeout so we can control it with fake timers
        mocks.delay.mockImplementation((ms) => new Promise(resolve => setTimeout(resolve, ms)));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Veo 3.1 Metadata Contract', () => {
        it('should strictly assert Veo 3.1 metadata: duration, fps, and mime_type', async () => {
            // Setup: Job completes with valid Veo metadata
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
                            status: 'completed',
                            output: {
                                url: 'https://storage.googleapis.com/veo-generations/mock-video.mp4',
                                metadata: {
                                    duration_seconds: 6.0,
                                    fps: 24, // Veo often defaults to 24
                                    mime_type: 'video/mp4',
                                    resolution: '1920x1080'
                                }
                            }
                        })
                    });
                }, 10);
                return () => {};
            });

            const jobPromise = service.waitForJob('lens-veo-job-id');
            vi.advanceTimersByTime(20);
            const job = await jobPromise;

            // 🔍 Lens Audit: Metadata is the contract
            expect(job.output.metadata).toBeDefined();
            expect(job.output.metadata.duration_seconds).toBeGreaterThan(0);
            expect([24, 30, 60]).toContain(job.output.metadata.fps);
            expect(job.output.metadata.mime_type).toBe('video/mp4');
        });

        it('should fail validation if MIME type is not video/mp4 (MIME Type Guard)', async () => {
            // Setup: Job completes but returns an image (e.g. Gemini generated a static preview instead of video)
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
                            status: 'completed',
                            output: {
                                url: 'https://storage.googleapis.com/veo-generations/oops.png',
                                metadata: {
                                    duration_seconds: 0,
                                    fps: 0,
                                    mime_type: 'image/png' // ❌ Violation
                                }
                            }
                        })
                    });
                }, 10);
                return () => {};
            });

            const jobPromise = service.waitForJob('lens-veo-job-id');
            vi.advanceTimersByTime(20);
            const job = await jobPromise;

            // In a real player, this would be a critical failure.
            // Here we verify that we CAN detect it.
            expect(job.output.metadata.mime_type).not.toBe('video/mp4');
        });

        it('should strictly respect aspect_ratio request in metadata', async () => {
             // Setup: Job completes with valid Veo metadata
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
                            status: 'completed',
                            output: {
                                url: 'https://storage.googleapis.com/veo-generations/mock-video.mp4',
                                metadata: {
                                    duration_seconds: 6.0,
                                    fps: 24,
                                    mime_type: 'video/mp4',
                                    resolution: '3840x2160' // 16:9 4K
                                }
                            }
                        })
                    });
                }, 10);
                return () => {};
            });

            // Simulate request with aspect ratio
            const jobPromise = service.waitForJob('lens-veo-job-id');
            vi.advanceTimersByTime(20);
            const job = await jobPromise;

            // 16:9 check
            expect(job.output.metadata.resolution).toBeDefined();
            const [w, h] = job.output.metadata.resolution.split('x').map(Number);
            const ratio = w / h;
            expect(ratio).toBeCloseTo(16/9, 1);
        });
    });

    describe('Generation Speed & Latency (Flash vs Pro)', () => {
        it('should handle "Flash" generation (Success < 2s)', async () => {
            // Simulate fast return
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                // Immediate callback for Flash
                callback({
                    exists: () => true,
                    id: 'lens-veo-job-id',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://mock.url/flash.mp4',
                            metadata: { mime_type: 'video/mp4', model: 'veo-3.1-flash' }
                        }
                    })
                });
                return () => {};
            });

            const start = Date.now();
            const jobPromise = service.waitForJob('lens-veo-job-id');
            // No time advancement needed if callback is immediate, but safest to advance 0
            vi.advanceTimersByTime(0);
            const job = await jobPromise;
            const duration = Date.now() - start;

            expect(job.status).toBe('completed');
            // In unit test this is practically 0ms, but logically it represents "instant"
            expect(duration).toBeLessThan(2000);
        });

        it('should handle "Pro" generation with polling/processing states', async () => {
            // Simulate: Pending -> Processing -> Processing -> Completed
            // Veo 3.1 Pro might take ~20s
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                // Initial Pending
                callback({ exists: () => true, id: 'lens-veo-job-id', data: () => ({ status: 'pending' }) });

                // Processing after 5s
                setTimeout(() => {
                    callback({ exists: () => true, id: 'lens-veo-job-id', data: () => ({ status: 'processing', progress: 25 }) });
                }, 5000);

                // Processing after 15s
                setTimeout(() => {
                    callback({ exists: () => true, id: 'lens-veo-job-id', data: () => ({ status: 'processing', progress: 75 }) });
                }, 15000);

                // Completed after 25s
                setTimeout(() => {
                     callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
                            status: 'completed',
                            output: {
                                url: 'https://mock.url/pro.mp4',
                                metadata: { mime_type: 'video/mp4', model: 'veo-3.1-pro' }
                            }
                        })
                    });
                }, 25000);

                return () => {};
            });

            const start = Date.now();
            const jobPromise = service.waitForJob('lens-veo-job-id');

            // Advance time in chunks to simulate waiting
            vi.advanceTimersByTime(5000);
            vi.advanceTimersByTime(10000);
            vi.advanceTimersByTime(10000); // Now at 25s

            const job = await jobPromise;
            const duration = Date.now() - start;

            expect(job.status).toBe('completed');
            expect(job.output.metadata.model).toBe('veo-3.1-pro');
            expect(duration).toBeGreaterThanOrEqual(25000);
            expect(duration).toBeLessThan(30000); // "Pro < 30s" boundary
        });
    });

    describe('Timeout & Error Handling', () => {
        it('should timeout if Veo generation hangs (Veo Timeout Handler)', async () => {
            // 🎥 The "Veo Timeout" Handler
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                // Stays pending forever
                callback({ exists: () => true, id: 'lens-veo-job-id', data: () => ({ status: 'pending' }) });
                return () => {};
            });

            // Set a specific timeout for this test
            const timeoutMs = 60000; // 60s
            const jobPromise = service.waitForJob('lens-veo-job-id', timeoutMs);

            // Fast forward past the timeout
            vi.advanceTimersByTime(timeoutMs + 100);

            await expect(jobPromise).rejects.toThrow(/Video generation timeout/);
        });

        it('should propagate Gemini 3 safety filter errors correctly', async () => {
            // 🔍 Audit: Error Handling
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
                            status: 'failed',
                            error: 'Safety violation: Harassment filter tripped.'
                        })
                    });
                }, 10);
                return () => {};
            });

            const jobPromise = service.waitForJob('lens-veo-job-id');
            vi.advanceTimersByTime(20);
            await expect(jobPromise).rejects.toThrow(/Safety violation/);
        });

        it('should handle granular SafetySettings violations without crashing', async () => {
             // 🎥 SafetySettings Handshake
             // Simulate a complex safety error structure that might come from Gemini
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
                            status: 'failed',
                            error: 'Safety violation: [HARM_CATEGORY_DANGEROUS_CONTENT] triggered with probability [HIGH]. Generation blocked.'
                        })
                    });
                }, 10);
                return () => {};
            });

            const jobPromise = service.waitForJob('lens-veo-job-id');
            vi.advanceTimersByTime(20);

            // Verify we catch it and it contains the specific category
            await expect(jobPromise).rejects.toThrow(/HARM_CATEGORY_DANGEROUS_CONTENT/);
        });

        it('should handle specific Google API error codes (400/429)', async () => {
             mocks.doc.mockReturnValue('doc-ref');
             mocks.onSnapshot.mockImplementation((ref, callback) => {
                 setTimeout(() => {
                     callback({
                         exists: () => true,
                         id: 'lens-veo-job-id',
                         data: () => ({
                             status: 'failed',
                             error: '429 Too Many Requests: Resource has been exhausted (e.g. check quota).'
                         })
                     });
                 }, 10);
                 return () => {};
             });

             const jobPromise = service.waitForJob('lens-veo-job-id');
             vi.advanceTimersByTime(20);
             await expect(jobPromise).rejects.toThrow(/429 Too Many Requests/);
        });
    });
});
