
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
        getState: vi.fn(() => ({
            currentOrganizationId: 'org-lens'
        }))
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
    functions: {},
    functionsWest1: {},
    db: {},
    auth: mocks.auth,
    remoteConfig: {},
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

describe('Lens 🎥 - Veo Safety & Integrity', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new VideoGenerationService();
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });

        // Mock global fetch
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    it('should reject with detailed Safety Violation if Gemini filters block generation', async () => {
        // Scenario: Job fails with specific safety ratings
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-unsafe',
                    data: () => ({
                        status: 'failed',
                        error: 'Content blocked by safety filters',
                        safety_ratings: [
                            { category: 'HARM_CATEGORY_VIOLENCE', probability: 'HIGH', blocked: true },
                            { category: 'HARM_CATEGORY_SEXUAL', probability: 'NEGLIGIBLE', blocked: false }
                        ]
                    })
                });
            }, 1000);
            return vi.fn();
        });

        const jobPromise = service.waitForJob('job-id-unsafe', 5000);
        vi.advanceTimersByTime(1000);

        // Expect specific error message parsing the ratings
        await expect(jobPromise).rejects.toThrow(/Safety Violation: HARM_CATEGORY_VIOLENCE \(HIGH\)/);
    });

    it('should reject with Critical Failure (404) if video URL is not accessible', async () => {
        const brokenUrl = 'https://storage.googleapis.com/veo-generations/ghost.mp4';

        // 1. Mock Fetch to return 404
        (global.fetch as import("vitest").Mock).mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });

        // 2. Mock Job Completion with "valid" metadata but broken URL
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-404',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: brokenUrl,
                            metadata: {
                                duration_seconds: 4.0,
                                fps: 30,
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 1000);
            return vi.fn();
        });

        const jobPromise = service.waitForJob('job-id-404', 5000);
        vi.advanceTimersByTime(1000);

        // Expect rejection due to URL check
        await expect(jobPromise).rejects.toThrow(/Asset Integrity Failure: Video URL is unreachable \(404\)/);

        // Verify fetch was called
        expect(global.fetch).toHaveBeenCalledWith(brokenUrl, expect.objectContaining({ method: 'HEAD' }));
    });

    it('should resolve successfully if video URL is accessible (200 OK)', async () => {
        const validUrl = 'https://storage.googleapis.com/veo-generations/valid.mp4';

        // 1. Mock Fetch to return 200
        (global.fetch as import("vitest").Mock).mockResolvedValue({
            ok: true,
            status: 200
        });

        // 2. Mock Job Completion
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-id-success',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: validUrl,
                            metadata: {
                                duration_seconds: 4.0,
                                fps: 30,
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 1000);
            return vi.fn();
        });

        const jobPromise = service.waitForJob('job-id-success', 5000);
        vi.advanceTimersByTime(1000);

        const result = await jobPromise;
        expect(result.output!.url).toBe(validUrl);
        expect(global.fetch).toHaveBeenCalledWith(validUrl, expect.objectContaining({ method: 'HEAD' }));
    });
});
