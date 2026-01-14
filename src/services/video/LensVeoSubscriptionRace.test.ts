
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
    },
    httpsCallable: vi.fn()
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

// Mock UUID
vi.mock('uuid', () => ({
    v4: () => 'lens-veo-job-id'
}));


describe('Lens 🎥 - Veo 3.1 Subscription Race Conditions', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new VideoGenerationService();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should NOT trigger callback after unsubscription (Stale Data Protection)', () => {
        // Setup: Mock onSnapshot to simulate a delayed response
        // We implement a "Smart Mock" that respects unsubscription
        let active = true;
        let fireSnapshot: (data: any) => void;

        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            fireSnapshot = (data) => {
                if (active) callback(data);
            };
            return () => { active = false; }; // Unsubscribe logic
        });

        const callbackSpy = vi.fn();

        // 1. Subscribe to Job A (The "Pro" job)
        const unsubscribe = service.subscribeToJob('job-id-pro', callbackSpy);

        // 2. Simulate User switching to Job B (Flash) -> Unsubscribes from A
        unsubscribe();

        // 3. Job A finally completes (Stale update)
        if (fireSnapshot!) {
            fireSnapshot({
                exists: () => true,
                id: 'job-id-pro',
                data: () => ({ status: 'completed', output: { url: 'http://slow.url' } })
            });
        }

        // 4. Assert: The callback should NOT be called because we unsubscribed
        expect(callbackSpy).not.toHaveBeenCalled();
    });

    it('should clean up subscription after timeout (Prevent Memory/Listener Leaks)', async () => {
        // Setup: Mock onSnapshot
        const unsubscribeSpy = vi.fn();
        mocks.onSnapshot.mockReturnValue(unsubscribeSpy);
        mocks.doc.mockReturnValue('doc-ref');

        // 1. Call waitForJob with a short timeout
        const jobPromise = service.waitForJob('job-id-timeout', 100);

        // 2. Advance time to trigger timeout
        vi.advanceTimersByTime(150);

        // 3. Expect rejection
        await expect(jobPromise).rejects.toThrow(/timeout/);

        // 4. Assert: Unsubscribe WAS called
        expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should clean up subscription after completion (Happy Path Cleanup)', async () => {
        // Setup: Mock onSnapshot to return success immediately
        const unsubscribeSpy = vi.fn();
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-success',
                    data: () => ({ status: 'completed' })
                });
            }, 50);
            return unsubscribeSpy;
        });
        mocks.doc.mockReturnValue('doc-ref');

        // 1. Call waitForJob
        const jobPromise = service.waitForJob('job-id-success', 1000);

        // 2. Advance time
        vi.advanceTimersByTime(60);

        // 3. Expect success
        await expect(jobPromise).resolves.toEqual(expect.objectContaining({ status: 'completed' }));

        // 4. Assert: Unsubscribe WAS called
        expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should handle multiple concurrent job waits independently (Isolation)', async () => {
        // Fix: doc() receives (db, collection, id). We need to capture the ID (3rd arg).
        mocks.doc.mockImplementation((_db, _col, id) => `doc-ref-${id}`);

        const callbacks: Record<string, (data: any) => void> = {};

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // ref is `doc-ref-ID`
            const id = ref.replace('doc-ref-', '');
            callbacks[id] = callback;
            return vi.fn();
        });

        // Start Job A (Slow)
        const promiseA = service.waitForJob('job-a', 5000);

        // Start Job B (Fast)
        const promiseB = service.waitForJob('job-b', 5000);

        // Complete Job B with Veo 3.1 Metadata (Mandatory)
        if (callbacks['job-b']) {
            callbacks['job-b']({
                exists: () => true,
                id: 'job-b',
                data: () => ({
                    status: 'completed',
                    output: {
                        url: 'url-b',
                        metadata: {
                            duration_seconds: 4.0,
                            fps: 24,
                            mime_type: 'video/mp4'
                        }
                    }
                })
            });
        }

        const resultB = await promiseB;
        expect(resultB.output.url).toBe('url-b');
        // Assert Veo 3.1 Metadata
        expect(resultB.output.metadata.fps).toBe(24);
        expect(resultB.output.metadata.mime_type).toBe('video/mp4');

        // Job A is still pending. Ensure B's completion didn't resolve A.

        const spyA = vi.fn();
        promiseA.then(spyA);

        await vi.advanceTimersByTime(10);
        expect(spyA).not.toHaveBeenCalled();

        // Complete Job A
        if (callbacks['job-a']) {
            callbacks['job-a']({
                exists: () => true,
                id: 'job-a',
                data: () => ({
                    status: 'completed',
                    output: {
                        url: 'url-a',
                        metadata: {
                            duration_seconds: 60.0,
                            fps: 30,
                            mime_type: 'video/mp4'
                        }
                    }
                })
            });
        }

        const resultA = await promiseA;
        expect(resultA.output.url).toBe('url-a');
        expect(resultA.output.metadata.duration_seconds).toBe(60.0);
    });
});
