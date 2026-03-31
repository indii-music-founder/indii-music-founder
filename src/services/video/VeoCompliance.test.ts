/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';

// 1. Hoisted mocks
const mocks = vi.hoisted(() => ({
  serverTimestamp: vi.fn(),
    httpsCallable: vi.fn(),
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'test-user-lens' } },
    subscriptionService: {
        canPerformAction: vi.fn()
    },
    useStore: {
        getState: vi.fn(() => ({
  serverTimestamp: vi.fn(), currentOrganizationId: 'org-lens' }))
    },
    delay: vi.fn()
}));

// 2. Mock modules
vi.mock('firebase/functions', () => ({
  serverTimestamp: vi.fn(),
    httpsCallable: mocks.httpsCallable,
    getFunctions: vi.fn()
}));

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(),
    doc: mocks.doc,
    onSnapshot: mocks.onSnapshot,
    getFirestore: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    auth: mocks.auth,
    db: {},
    functions: {},
    functionsWest1: {},
    remoteConfig: {},
    storage: {},
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

vi.mock('../firebase', () => ({
  serverTimestamp: vi.fn(),
    functions: {},
    functionsWest1: {},
    db: {},
    auth: mocks.auth,
    remoteConfig: {},
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
  serverTimestamp: vi.fn(),
    subscriptionService: mocks.subscriptionService
}));

vi.mock('@/core/store', () => ({
  serverTimestamp: vi.fn(),
    useStore: mocks.useStore
}));

vi.mock('@/utils/async', () => ({
  serverTimestamp: vi.fn(),
    delay: mocks.delay
}));

vi.mock('uuid', () => ({
  serverTimestamp: vi.fn(),
    v4: () => 'lens-veo-job-id'
}));

describe('Lens 🎥 - Veo 3.1 & Gemini 3 Native Generation Pipeline', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new VideoGenerationService();
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        // Default: Quota OK
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        // Default: Trigger OK
        mocks.httpsCallable.mockReturnValue(async () => ({
  serverTimestamp: vi.fn(), data: { jobId: 'lens-veo-job-id' } }));

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
  serverTimestamp: vi.fn(),
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
                return () => { };
            });

            const jobPromise = service.waitForJob('lens-veo-job-id');
            vi.advanceTimersByTime(20);
            const job = await jobPromise;

            // 🔍 Lens Audit: Metadata is the contract
            expect(job.output!.metadata).toBeDefined();
            expect((job.output!.metadata as Record<string, unknown>).duration_seconds).toBeGreaterThan(0);
            expect([24, 30, 60]).toContain((job.output!.metadata as Record<string, unknown>).fps);
            expect(job.output!.metadata!.mime_type).toBe('video/mp4');
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
  serverTimestamp: vi.fn(),
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
                return () => { };
            });

            const jobPromise = service.waitForJob('lens-veo-job-id');
            vi.advanceTimersByTime(20);

            // In a real player, this would be a critical failure.
            // Here we verify that we CAN detect it by asserting that the promise rejects
            await expect(jobPromise).rejects.toThrow(/Security Violation: Invalid MIME type/);
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
  serverTimestamp: vi.fn(),
                        status: 'completed',
                        output: {
                            url: 'https://mock.url/flash.mp4',
                            metadata: { mime_type: 'video/mp4', model: 'veo-3.1-flash' }
                        }
                    })
                });
                return () => { };
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
                callback({ exists: () => true, id: 'lens-veo-job-id', data: () => ({
  serverTimestamp: vi.fn(), status: 'pending' }) });

                // Processing after 5s
                setTimeout(() => {
                    callback({ exists: () => true, id: 'lens-veo-job-id', data: () => ({
  serverTimestamp: vi.fn(), status: 'processing', progress: 25 }) });
                }, 5000);

                // Processing after 15s
                setTimeout(() => {
                    callback({ exists: () => true, id: 'lens-veo-job-id', data: () => ({
  serverTimestamp: vi.fn(), status: 'processing', progress: 75 }) });
                }, 15000);

                // Completed after 25s
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
  serverTimestamp: vi.fn(),
                            status: 'completed',
                            output: {
                                url: 'https://mock.url/pro.mp4',
                                metadata: { mime_type: 'video/mp4', model: 'veo-3.1-pro' }
                            }
                        })
                    });
                }, 25000);

                return () => { };
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
            expect(job.output!.metadata!.model).toBe('veo-3.1-pro');
            expect(duration).toBeGreaterThanOrEqual(25000);
            expect(duration).toBeLessThan(30000); // "Pro < 30s" boundary
        });
    });

    describe('Flash vs Pro Race (Upgrade)', () => {
        it('should handle "Flash" to "Pro" upgrade (subscribeToJob)', async () => {
            // Verify that Gemini 3 Flash images (or videos) swap to Gemini 3 Pro (upscaled) if applicable.
            // This requires using subscribeToJob because waitForJob resolves on the first completion.

            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                // 1. Initial "Flash" Result
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
  serverTimestamp: vi.fn(),
                            status: 'completed',
                            output: {
                                url: 'https://mock.url/flash.mp4',
                                metadata: {
                                    mime_type: 'video/mp4',
                                    model: 'veo-3.1-flash',
                                    duration_seconds: 4.0,
                                    fps: 24
                                }
                            }
                        })
                    });
                }, 100);

                // 2. Later "Pro" Update
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
  serverTimestamp: vi.fn(),
                            status: 'completed',
                            output: {
                                url: 'https://mock.url/pro.mp4',
                                metadata: {
                                    mime_type: 'video/mp4',
                                    model: 'veo-3.1-pro',
                                    duration_seconds: 4.0,
                                    fps: 30 // Pro might have higher FPS
                                }
                            }
                        })
                    });
                }, 1000);

                return () => { };
            });

            const updates: any[] = [];
            const unsubscribe = service.subscribeToJob('lens-veo-job-id', (job) => {
                if (job) updates.push(job);
            });

            // Fast forward to capture both updates
            vi.advanceTimersByTime(2000);
            unsubscribe();

            // Assertions
            expect(updates.length).toBe(2);

            // First update: Flash
            expect(updates[0].output!.metadata!.model).toBe('veo-3.1-flash');
            expect(updates[0].output!.url).toBe('https://mock.url/flash.mp4');
            expect(updates[0].output!.metadata!.mime_type).toBe('video/mp4');
            expect(updates[0].output!.metadata!.duration_seconds).toBe(4.0);
            expect(updates[0].output!.metadata!.fps).toBe(24);

            // Second update: Pro (Upgrade)
            expect(updates[1].output!.metadata!.model).toBe('veo-3.1-pro');
            expect(updates[1].output!.url).toBe('https://mock.url/pro.mp4');
            expect(updates[1].output!.metadata!.mime_type).toBe('video/mp4');
            expect(updates[1].output!.metadata!.duration_seconds).toBe(4.0);
            expect(updates[1].output!.metadata!.fps).toBe(30);
        });
    });

    describe('Timeout & Error Handling', () => {
        it('should timeout if Veo generation hangs (Veo Timeout Handler)', async () => {
            // 🎥 The "Veo Timeout" Handler
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                // Stays pending forever
                callback({ exists: () => true, id: 'lens-veo-job-id', data: () => ({
  serverTimestamp: vi.fn(), status: 'pending' }) });
                return () => { };
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
  serverTimestamp: vi.fn(),
                            status: 'failed',
                            error: 'Safety violation: Harassment filter tripped.'
                        })
                    });
                }, 10);
                return () => { };
            });

            const jobPromise = service.waitForJob('lens-veo-job-id');
            vi.advanceTimersByTime(20);
            await expect(jobPromise).rejects.toThrow(/Safety violation/);
        });

        it('should handle specific Google API error codes (400/429)', async () => {
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
  serverTimestamp: vi.fn(),
                            status: 'failed',
                            error: '429 Too Many Requests: Resource has been exhausted (e.g. check quota).'
                        })
                    });
                }, 10);
                return () => { };
            });

            const jobPromise = service.waitForJob('lens-veo-job-id');
            vi.advanceTimersByTime(20);
            await expect(jobPromise).rejects.toThrow(/429 Too Many Requests/);
        });
    });
});
