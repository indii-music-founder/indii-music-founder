
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

vi.mock('uuid', () => ({
    v4: () => 'lens-veo-job-id'
}));

describe('Lens 🎥 - Veo Flash vs Pro Race Condition', () => {
    let service: VideoGenerationService;
    let snapshotCallbacks: Record<string, Function> = {};

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new VideoGenerationService();
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        snapshotCallbacks = {};

        // Robust mock for onSnapshot that allows triggering specific job updates
        mocks.doc.mockImplementation((db, collection, jobId) => `doc-ref-${jobId}`);
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // ref is like "doc-ref-job-id-..."
            // We need to map the callback to the jobId.
            // In the mock above, we returned `doc-ref-${jobId}`.
            // Let's assume the test triggers callbacks manually via a helper,
            // or we store them by the stringified ref.

            // For simplicity, let's assume we can map the ref string back to the ID or just store it.
            // Since `waitForJob` creates a listener on a specific doc.
            const refStr = ref.toString();
            snapshotCallbacks[refStr] = callback;

            return vi.fn(); // Unsubscribe mock
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should correctly resolve concurrent "Flash" and "Pro" jobs without cross-contamination', async () => {
        // Scenario:
        // 1. User starts Pro job (slow) -> Job ID: 'job-pro'
        // 2. User starts Flash job (fast) -> Job ID: 'job-flash'
        // 3. Flash completes first.
        // 4. Pro completes later.
        // 5. Ensure Pro promise resolves with Pro data, Flash with Flash data.

        const proJobId = 'job-pro';
        const flashJobId = 'job-flash';

        // Start waiting for both
        const proPromise = service.waitForJob(proJobId, 60000);
        const flashPromise = service.waitForJob(flashJobId, 10000);

        // Advance timers a bit to ensure listeners are attached
        await vi.advanceTimersByTimeAsync(100);

        // Trigger Flash Completion (Fast)
        // We need to find the callback for flashJobId
        const flashCallback = snapshotCallbacks[`doc-ref-${flashJobId}`];
        expect(flashCallback).toBeDefined();

        flashCallback({
            exists: () => true,
            id: flashJobId,
            data: () => ({
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

        // Trigger Pro Completion (Slow)
        const proCallback = snapshotCallbacks[`doc-ref-${proJobId}`];
        expect(proCallback).toBeDefined();

        // Let's say Pro completes *after* Flash
        proCallback({
            exists: () => true,
            id: proJobId,
            data: () => ({
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

        // Verify Flash Result
        expect(flashResult.output.url).toBe('http://veo-flash.mp4');
        expect(flashResult.output.metadata.duration_seconds).toBe(4.0);

        // Verify Pro Result
        expect(proResult.output.url).toBe('http://veo-pro.mp4');
        expect(proResult.output.metadata.duration_seconds).toBe(10.0);
        expect(proResult.output.metadata.fps).toBe(60);
    });
});
