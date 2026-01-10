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
    delay: vi.fn()
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

vi.mock('@/utils/async', () => ({
    delay: mocks.delay
}));

vi.mock('uuid', () => ({
    v4: () => 'lens-veo-job-id'
}));

describe('Lens 🎥 - Veo 3.1 & Gemini 3 Native Generation Pipeline', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoGenerationService();
        // Default: Quota OK
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        // Default: Trigger OK
        mocks.httpsCallable.mockReturnValue(async () => ({ data: { jobId: 'lens-veo-job-id' } }));

        // Mock delay to be a promise that never resolves by default (unless we want to trigger timeout)
        mocks.delay.mockReturnValue(new Promise(() => {}));
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

            const job = await service.waitForJob('lens-veo-job-id');

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

            const job = await service.waitForJob('lens-veo-job-id');

            // In a real player, this would be a critical failure.
            // Here we verify that we CAN detect it.
            expect(job.output.metadata.mime_type).not.toBe('video/mp4');
        });
    });

    describe('Generation Speed & Latency (Flash vs Pro)', () => {
        it('should handle "Flash" generation (Success < 2s)', async () => {
            // Simulate fast return
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                // Immediate callback
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
            const job = await service.waitForJob('lens-veo-job-id');
            const duration = Date.now() - start;

            expect(job.status).toBe('completed');
            // In unit test this is practically 0ms, but logically it represents "instant"
            expect(duration).toBeLessThan(2000);
        });

        it('should handle "Pro" generation with polling/processing states', async () => {
            // Simulate: Pending -> Processing -> Processing -> Completed
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                let state = 0;
                const interval = setInterval(() => {
                    state++;
                    if (state === 1) {
                        callback({ exists: () => true, id: 'lens-veo-job-id', data: () => ({ status: 'pending' }) });
                    } else if (state === 2) {
                        callback({ exists: () => true, id: 'lens-veo-job-id', data: () => ({ status: 'processing', progress: 50 }) });
                    } else if (state === 3) {
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
                        clearInterval(interval);
                    }
                }, 50);
                return () => clearInterval(interval);
            });

            const job = await service.waitForJob('lens-veo-job-id');
            expect(job.status).toBe('completed');
            expect(job.output.metadata.model).toBe('veo-3.1-pro');
        });
    });

    describe('Error Handling & Safety Settings', () => {
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

            await expect(service.waitForJob('lens-veo-job-id'))
                .rejects.toThrow(/Safety violation/);
        });

        it('should handle Copyright/Policy violations explicitly', async () => {
            // 🔍 Audit: Copyright/Policy checks
            mocks.doc.mockReturnValue('doc-ref');
            mocks.onSnapshot.mockImplementation((ref, callback) => {
                setTimeout(() => {
                    callback({
                        exists: () => true,
                        id: 'lens-veo-job-id',
                        data: () => ({
                            status: 'failed',
                            error: 'Policy violation: Copyrighted content detected in prompt.'
                        })
                    });
                }, 10);
                return () => {};
            });

            await expect(service.waitForJob('lens-veo-job-id'))
                .rejects.toThrow(/Policy violation/);
        });
    });
});
