/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';
import { delay } from '@/utils/async';

// Mock dependencies
const mocks = vi.hoisted(() => ({
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'lens-tester' } },
    // Mock other dependencies used by the service but not critical for this specific test
    httpsCallable: vi.fn(),
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

// We need to mock subscription service because VideoGenerationService uses it in other methods
// enabling clean instantiation
vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: mocks.subscriptionService
}));

vi.mock('@/core/store', () => ({
    useStore: mocks.useStore
}));

vi.mock('../ai/FirebaseAIService', () => ({
    firebaseAI: mocks.firebaseAI
}));

describe('Veo Timeout Handler (Lens)', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        service = new VideoGenerationService();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should throw a timeout error if Veo generation hangs beyond the limit', async () => {
        // Arrange
        const jobId = 'job-hung-123';
        const timeoutMs = 5000; // 5 seconds for test
        mocks.doc.mockReturnValue('doc-ref');

        // Mock onSnapshot to NEVER call the callback with 'completed'
        // It simulates a "pending" or "processing" state that never changes
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // Immediately report "processing"
            callback({
                exists: () => true,
                id: jobId,
                data: () => ({ status: 'processing' })
            });
            // Never report completion
            return () => {}; // unsubscribe mock
        });

        // Act & Assert
        const pendingPromise = service.waitForJob(jobId, timeoutMs);
        pendingPromise.catch(() => {}); // Suppress unhandled rejection

        // Fast-forward time past the timeout
        await vi.advanceTimersByTimeAsync(timeoutMs + 100);

        await expect(pendingPromise).rejects.toThrow(`Video generation timeout for Job ID: ${jobId}`);
    });

    it('should resolve immediately when Veo generation completes within timeout', async () => {
        // Arrange
        const jobId = 'job-flash-123';
        const timeoutMs = 5000;
        mocks.doc.mockReturnValue('doc-ref');

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // Simulate async completion after 1s (Flash speed)
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: jobId,
                    data: () => ({
                        status: 'completed',
                        output: { url: 'https://veo.generated/video.mp4' }
                    })
                });
            }, 1000);
            return () => {};
        });

        // Act
        const pendingPromise = service.waitForJob(jobId, timeoutMs);

        // Fast-forward time by 1.1s
        await vi.advanceTimersByTimeAsync(1100);

        // Assert
        const result = await pendingPromise;
        expect(result.status).toBe('completed');
        expect(result.output.url).toBe('https://veo.generated/video.mp4');
    });

    it('should reject immediately if Veo generation fails', async () => {
        // Arrange
        const jobId = 'job-fail-123';
        mocks.doc.mockReturnValue('doc-ref');

        mocks.onSnapshot.mockImplementation((ref, callback) => {
             // Simulate immediate failure
             callback({
                exists: () => true,
                id: jobId,
                data: () => ({
                    status: 'failed',
                    error: 'Safety violation: Copyrighted content'
                })
            });
            return () => {};
        });

        // Act & Assert
        await expect(service.waitForJob(jobId)).rejects.toThrow('Safety violation: Copyrighted content');
    });

    it('should handle "Pro" generation duration correctly (mocked)', async () => {
         // Arrange
         const jobId = 'job-pro-123';
         const timeoutMs = 60000; // 60s
         mocks.doc.mockReturnValue('doc-ref');

         mocks.onSnapshot.mockImplementation((ref, callback) => {
             // Simulate "processing" initially
             callback({
                 exists: () => true,
                 id: jobId,
                 data: () => ({ status: 'processing' })
             });

             // Simulate completion after 29s (Pro speed)
             setTimeout(() => {
                 callback({
                     exists: () => true,
                     id: jobId,
                     data: () => ({ status: 'completed', output: {} })
                 });
             }, 29000);

             return () => {};
         });

         // Act
         const pendingPromise = service.waitForJob(jobId, timeoutMs);

         // Advance time by 30s
         await vi.advanceTimersByTimeAsync(30000);

         // Assert
         await expect(pendingPromise).resolves.toMatchObject({ status: 'completed' });
    });
});
