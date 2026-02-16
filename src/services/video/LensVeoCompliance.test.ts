
/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'test-user-lens' } },
    useStore: {
        getState: vi.fn(() => ({ currentOrganizationId: 'org-lens' }))
    },
    subscriptionService: {
        canPerformAction: vi.fn()
    }
}));

// Mock modules
vi.mock('firebase/firestore', () => ({
    doc: mocks.doc,
    onSnapshot: mocks.onSnapshot,
    getFirestore: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    db: {},
    functions: {},
    functionsWest1: {},
    remoteConfig: {}
}));

vi.mock('../firebase', () => ({
    functions: {},
    functionsWest1: {},
    db: {},
    auth: mocks.auth,
    remoteConfig: {}
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: mocks.subscriptionService
}));

vi.mock('@/core/store', () => ({
    useStore: mocks.useStore
}));

vi.mock('uuid', () => ({
    v4: () => 'lens-veo-job-id'
}));

describe('Lens 🎥 - Veo 3.1 Compliance & Integrity Checks', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new VideoGenerationService();
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });

        // Mock fetch for video URL verification
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    it('should generate "Flash" video within 2 seconds (simulated) and verify Veo 3.1 metadata contract', async () => {
        const flashUrl = 'https://storage.googleapis.com/veo-generations/flash-123.mp4';

        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-flash',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: flashUrl,
                            metadata: {
                                duration_seconds: 4.0,
                                fps: 30,
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 1500); // 1.5s
            return vi.fn();
        });

        const start = Date.now();
        const jobPromise = service.waitForJob('job-id-flash', 5000);

        vi.advanceTimersByTime(1500);
        const result = await jobPromise;
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(2000);
        expect(result.output.metadata.mime_type).toBe('video/mp4');
        expect(result.output.metadata.duration_seconds).toBe(4.0);
        expect([24, 30, 60]).toContain(result.output.metadata.fps);
    });

    it('should generate "Pro" video within 30 seconds (simulated) and verify high-fidelity metadata', async () => {
        const proUrl = 'https://storage.googleapis.com/veo-generations/pro-456.mp4';

        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-pro',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: proUrl,
                            metadata: {
                                duration_seconds: 10.0,
                                fps: 60,
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 25000); // 25s
            return vi.fn();
        });

        const start = Date.now();
        const jobPromise = service.waitForJob('job-id-pro', 60000);

        vi.advanceTimersByTime(25000);
        const result = await jobPromise;
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(30000);
        expect(result.output.metadata.mime_type).toBe('video/mp4');
        expect(result.output.metadata.fps).toBe(60);
    });

    it('should enforce MIME Type Guard: Reject non-video assets', async () => {
        // Scenario: Gemini generates a static image instead of video
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-image',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://storage.googleapis.com/bad-output.png',
                            metadata: {
                                duration_seconds: 0,
                                fps: 0,
                                mime_type: 'image/png' // Invalid!
                            }
                        }
                    })
                });
            }, 500);
            return vi.fn();
        });

        const jobPromise = service.waitForJob('job-id-image', 5000);
        vi.advanceTimersByTime(500);

        await expect(jobPromise).rejects.toThrow(/Security Violation: Invalid MIME type/);
    });

    it('should handle Flash-to-Pro upgrade on single job subscription', async () => {
        // Scenario: Job starts, updates with Flash (status: completed), then updates with Pro (status: completed + higher quality)
        // NOTE: The current Service implementation resolves on FIRST 'completed'.
        // If the service logic supports "upgrades", it usually means the *first* completion is Flash,
        // and a *second* event comes later.
        // However, `waitForJob` returns a Promise that resolves *once*.
        // This test verifies that the SUBSCRIPTION (subscribeToJob) receives both updates.

        mocks.doc.mockReturnValue('doc-ref');
        const updates: any[] = [];

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // 1. Flash Update
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-upgrade',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'http://flash.mp4',
                            metadata: { mime_type: 'video/mp4', quality: 'flash' }
                        }
                    })
                });
            }, 1000);

            // 2. Pro Update
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-upgrade',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'http://pro.mp4',
                            metadata: { mime_type: 'video/mp4', quality: 'pro' }
                        }
                    })
                });
            }, 3000);

            return vi.fn();
        });

        // Use subscribeToJob directly to verify stream of updates
        let unsub: (() => void) | undefined;
        const jobPromise = new Promise<void>((resolve) => {
            unsub = service.subscribeToJob('job-id-upgrade', (job) => {
                if (job && job.status === 'completed') {
                    updates.push(job);
                    if (job.output.metadata.quality === 'pro') {
                        resolve();
                    }
                }
            });
        });

        vi.advanceTimersByTime(3000);
        await jobPromise;
        if (unsub) unsub();

        expect(updates).toHaveLength(2);
        expect(updates[0].output.url).toBe('http://flash.mp4');
        expect(updates[1].output.url).toBe('http://pro.mp4');
    });

    it('should handle SafetySettings violation gracefully', async () => {
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-unsafe',
                    data: () => ({
                        status: 'failed',
                        error: 'Safety violation',
                        safety_ratings: []
                    })
                });
            }, 1000);
            return vi.fn();
        });

        const jobPromise = service.waitForJob('job-id-unsafe', 5000);
        vi.advanceTimersByTime(1000);

        await expect(jobPromise).rejects.toThrow(/Safety violation/);
    });

    it('should prevent "Flash" overwriting "Pro" (Race Condition Protection)', async () => {
        // Scenario: "Pro" update arrives FIRST (e.g. race condition or just processed),
        // followed by a delayed "Flash" update. The Flash update should be IGNORED.

        mocks.doc.mockReturnValue('doc-ref');
        const updates: any[] = [];

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // 1. Pro Update (Quality Level 2)
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-race',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'http://pro.mp4',
                            metadata: { mime_type: 'video/mp4', quality: 'pro' }
                        }
                    })
                });
            }, 1000);

            // 2. Flash Update (Quality Level 1) - Arriving LATER
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-race',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'http://flash.mp4',
                            metadata: { mime_type: 'video/mp4', quality: 'flash' }
                        }
                    })
                });
            }, 2000);

            return vi.fn();
        });

        const jobPromise = new Promise<void>((resolve) => {
            // We wait enough time for both to potentially fire
            setTimeout(resolve, 3000);
        });

        service.subscribeToJob('job-id-race', (job) => {
            if (job) {
                updates.push(job);
            }
        });

        vi.advanceTimersByTime(3000);
        await jobPromise;

        // Current behavior (FAIL): updates = [Pro, Flash]
        // Desired behavior (PASS): updates = [Pro]
        const urls = updates.map(u => u.output.url);
        expect(urls).toEqual(['http://pro.mp4']);
    });
});
