
/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
  serverTimestamp: vi.fn(),
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'test-user-lens' } },
    useStore: {
        getState: vi.fn(() => ({
  serverTimestamp: vi.fn(), currentOrganizationId: 'org-lens' }))
    },
    subscriptionService: {
        canPerformAction: vi.fn()
    }
}));

// Mock modules
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

vi.mock('uuid', () => ({
  serverTimestamp: vi.fn(),
    v4: () => 'lens-veo-job-id'
}));

describe('Lens 🎥 - Veo Flash vs Pro Race Condition', () => {
    let service: VideoGenerationService;
    let snapshotCallbacks: Record<string, (...args: any[]) => void> = {};

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new VideoGenerationService();
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        snapshotCallbacks = {};

        // Robust mock for onSnapshot that allows triggering specific job updates
        mocks.doc.mockImplementation((db, collection, jobId) => `doc-ref-${jobId}`);
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            const refStr = ref.toString();
            snapshotCallbacks[refStr] = callback;
            return vi.fn(); // Unsubscribe mock
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should correctly resolve concurrent "Flash" and "Pro" jobs without cross-contamination', async () => {
        const proJobId = 'job-pro';
        const flashJobId = 'job-flash';

        const proPromise = service.waitForJob(proJobId, 60000);
        const flashPromise = service.waitForJob(flashJobId, 10000);

        await vi.advanceTimersByTimeAsync(100);

        const flashCallback = snapshotCallbacks[`doc-ref-${flashJobId}`];
        expect(flashCallback).toBeDefined();

        flashCallback({
            exists: () => true,
            id: flashJobId,
            data: () => ({
  serverTimestamp: vi.fn(),
                status: 'completed',
                output: {
                    url: 'http://veo-flash.mp4',
                    metadata: {
                        duration_seconds: 4.0,
                        fps: 30,
                        mime_type: 'video/mp4'
                    }
                }
            })
        });

        const proCallback = snapshotCallbacks[`doc-ref-${proJobId}`];
        expect(proCallback).toBeDefined();

        proCallback({
            exists: () => true,
            id: proJobId,
            data: () => ({
  serverTimestamp: vi.fn(),
                status: 'completed',
                output: {
                    url: 'http://veo-pro.mp4',
                    metadata: {
                        duration_seconds: 10.0,
                        fps: 60,
                        mime_type: 'video/mp4'
                    }
                }
            })
        });

        const [flashResult, proResult] = await Promise.all([flashPromise, proPromise]);

        expect(flashResult.output!.url).toBe('http://veo-flash.mp4');
        expect((flashResult.output!.metadata as any)!.duration_seconds).toBe(4.0);

        expect(proResult.output!.url).toBe('http://veo-pro.mp4');
        expect((proResult.output!.metadata as any)!.duration_seconds).toBe(10.0);
        expect((proResult.output!.metadata as any)!.fps).toBe(60);
    });

    it('should ignore "Flash" update if "Pro" update has already been processed for the same job', () => {
        const jobId = 'job-race-protection';
        const callbackSpy = vi.fn();

        service.subscribeToJob(jobId, callbackSpy);

        const internalCallback = snapshotCallbacks[`doc-ref-${jobId}`];
        expect(internalCallback).toBeDefined();

        internalCallback({
            exists: () => true,
            id: jobId,
            data: () => ({
  serverTimestamp: vi.fn(),
                status: 'completed',
                output: {
                    url: 'http://veo-pro.mp4',
                    metadata: {
                        quality: 'pro',
                        duration_seconds: 10.0,
                        fps: 30,
                        mime_type: 'video/mp4'
                    }
                }
            })
        });

        expect(callbackSpy).toHaveBeenCalledTimes(1);
        expect(callbackSpy).toHaveBeenLastCalledWith(expect.objectContaining({
            output: expect.objectContaining({
                metadata: expect.objectContaining({
                    quality: 'pro',
                    duration_seconds: 10.0,
                    fps: 30,
                    mime_type: 'video/mp4'
                })
            })
        }));

        internalCallback({
            exists: () => true,
            id: jobId,
            data: () => ({
  serverTimestamp: vi.fn(),
                status: 'completed',
                output: {
                    url: 'http://veo-flash.mp4',
                    metadata: {
                        quality: 'flash',
                        duration_seconds: 10.0,
                        fps: 30,
                        mime_type: 'video/mp4'
                    }
                }
            })
        });

        expect(callbackSpy).toHaveBeenCalledTimes(1);
    });

    it('should upgrade from "Flash" to "Pro" for the same job', () => {
        const jobId = 'job-upgrade';
        const callbackSpy = vi.fn();

        service.subscribeToJob(jobId, callbackSpy);

        const internalCallback = snapshotCallbacks[`doc-ref-${jobId}`];
        expect(internalCallback).toBeDefined();

        internalCallback({
            exists: () => true,
            id: jobId,
            data: () => ({
  serverTimestamp: vi.fn(),
                status: 'completed',
                output: {
                    url: 'http://veo-flash.mp4',
                    metadata: {
                        quality: 'flash',
                        duration_seconds: 4.0,
                        fps: 24,
                        mime_type: 'video/mp4'
                    }
                }
            })
        });

        expect(callbackSpy).toHaveBeenCalledTimes(1);
        expect(callbackSpy).toHaveBeenLastCalledWith(expect.objectContaining({
            output: expect.objectContaining({
                metadata: expect.objectContaining({
                    quality: 'flash',
                    duration_seconds: 4.0,
                    fps: 24,
                    mime_type: 'video/mp4'
                })
            })
        }));

        internalCallback({
            exists: () => true,
            id: jobId,
            data: () => ({
  serverTimestamp: vi.fn(),
                status: 'completed',
                output: {
                    url: 'http://veo-pro.mp4',
                    metadata: {
                        quality: 'pro',
                        duration_seconds: 10.0,
                        fps: 60,
                        mime_type: 'video/mp4'
                    }
                }
            })
        });

        expect(callbackSpy).toHaveBeenCalledTimes(2);
        expect(callbackSpy).toHaveBeenLastCalledWith(expect.objectContaining({
            output: expect.objectContaining({
                metadata: expect.objectContaining({
                    quality: 'pro',
                    duration_seconds: 10.0,
                    fps: 60,
                    mime_type: 'video/mp4'
                })
            })
        }));
    });
});
