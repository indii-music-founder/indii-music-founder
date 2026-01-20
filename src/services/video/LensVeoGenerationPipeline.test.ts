
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

vi.mock('uuid', () => ({
    v4: () => 'lens-veo-job-id'
}));

describe('Lens 🎥 - Veo Generation Pipeline', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new VideoGenerationService();
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should generate "Flash" video within 2 seconds (simulated) and verify Veo 3.1 metadata contract', async () => {
        // Setup: Mock onSnapshot to return success quickly
        const flashUrl = 'https://storage.googleapis.com/veo-generations/flash-123.mp4?signature=mock-signed-url';

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
                                fps: 30, // Veo 3.1 standard
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 1500); // 1.5s simulated
            return vi.fn();
        });

        const start = Date.now();
        const jobPromise = service.waitForJob('job-id-flash', 5000);

        // Advance time
        vi.advanceTimersByTime(1500);

        const result = await jobPromise;
        const duration = Date.now() - start;

        // Verify Speed (< 2s)
        expect(duration).toBeLessThan(2000);

        // Verify Metadata Contract
        expect(result.output.metadata).toBeDefined();
        expect(result.output.metadata.mime_type).toBe('video/mp4');
        expect(result.output.metadata.duration_seconds).toBe(4.0);
        expect([24, 30, 60]).toContain(result.output.metadata.fps);
        expect(result.output.url).toBe(flashUrl);
    });

    it('should generate "Pro" video within 30 seconds (simulated) and verify high-fidelity metadata', async () => {
        const proUrl = 'https://storage.googleapis.com/veo-generations/pro-456.mp4?signature=mock-signed-url';

        // Setup: Mock onSnapshot to return success slowly
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
                                fps: 60, // Pro often 60fps
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 25000); // 25s simulated
            return vi.fn();
        });

        const start = Date.now();
        const jobPromise = service.waitForJob('job-id-pro', 60000);

        // Advance time
        vi.advanceTimersByTime(25000);

        const result = await jobPromise;
        const duration = Date.now() - start;

        // Verify Speed (Pro takes time but < 30s target for this test)
        expect(duration).toBeGreaterThan(2000);
        expect(duration).toBeLessThan(30000);

        // Verify Metadata Contract
        expect(result.output.metadata.fps).toBe(60);
        expect(result.output.metadata.mime_type).toBe('video/mp4');
        expect(result.output.url).toBe(proUrl);
    });

    it('should handle SafetySettings violation gracefully via "Safety Handshake"', async () => {
        // Setup: Mock onSnapshot to return a failure with safety info
        // This mimics the "Safety Handshake" where the backend returns structured safety ratings
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-unsafe',
                    data: () => ({
                        status: 'failed',
                        error: 'Safety violation: Content blocked by safety filters.',
                        safety_ratings: [
                            { category: 'HARM_CATEGORY_VIOLENCE', probability: 'HIGH' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', probability: 'MEDIUM' }
                        ]
                    })
                });
            }, 1000);
            return vi.fn();
        });

        const jobPromise = service.waitForJob('job-id-unsafe', 5000);
        vi.advanceTimersByTime(1000);

        // Expect rejection.
        // In a real app, we might check for a custom error class, but here we check the message.
        // The service wraps the error in `new Error(job.error)`.
        await expect(jobPromise).rejects.toThrow(/Safety violation/);

        // We implicitly verified the handshake by confirming the service correctly identified the 'failed' status
        // and propagated the error message derived from the backend's safety response.
    });

    it('should return empty URL on missing asset (Client must handle 404)', async () => {
        // Setup: Job completes, but URL is invalid/empty (e.g. upload failed but job marked complete)
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-404',
                    data: () => ({
                        status: 'completed',
                        output: {
                            // Missing URL or empty
                            url: ''
                        }
                    })
                });
            }, 500);
            return vi.fn();
        });

        const jobPromise = service.waitForJob('job-id-404', 5000);
        vi.advanceTimersByTime(500);

        const result = await jobPromise;

        // Assert that the service returns the result as-is (empty URL)
        // This confirms the service layer is passive and the UI/Consumer is responsible for the "Critical Failure" check
        expect(result.output.url).toBe('');
    });
});
