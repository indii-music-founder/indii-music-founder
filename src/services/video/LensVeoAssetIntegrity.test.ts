/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'lens-integrity-user' } },
    useStore: {
        getState: vi.fn(() => ({ currentOrganizationId: 'org-lens-integrity' }))
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

vi.mock('../ai/FirebaseAIService', () => ({
    firebaseAI: {
        analyzeImage: vi.fn(),
    }
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: mocks.subscriptionService
}));

vi.mock('@/core/store', () => ({
    useStore: mocks.useStore
}));

vi.mock('uuid', () => ({
    v4: () => 'job-integrity-123'
}));

describe('Lens 🎥 - Veo Asset Integrity & URL Refresh', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        service = new VideoGenerationService();
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });
        // Default happy path for fetch
        fetchMock.mockResolvedValue({ ok: true, status: 200 });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should propagate updated signed URLs (Refresh Token Flow) without resetting quality state', async () => {
        // Scenario:
        // 1. Job completes with "Pro" quality and URL A (expiring in 1 hour).
        // 2. User stays on page.
        // 3. Backend refreshes the URL to URL B (still "Pro" quality).
        // 4. Service MUST propagate this update to the subscriber.

        mocks.doc.mockReturnValue('doc-ref');
        const updates: any[] = [];

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // 1. Initial Pro Result
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-refresh-1',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://storage.googleapis.com/veo/video-expiring-soon.mp4',
                            metadata: { mime_type: 'video/mp4', quality: 'pro' }
                        }
                    })
                });
            }, 100);

            // 2. Refreshed URL Update (Quality stays 'pro')
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-refresh-1',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://storage.googleapis.com/veo/video-refreshed.mp4',
                            metadata: { mime_type: 'video/mp4', quality: 'pro' }
                        }
                    })
                });
            }, 500);

            return vi.fn();
        });

        const updatePromise = new Promise<void>((resolve) => {
            let count = 0;
            service.subscribeToJob('job-refresh-1', (job) => {
                if (job) {
                    updates.push(job);
                    count++;
                    if (count === 2) resolve();
                }
            });
        });

        vi.advanceTimersByTime(1000);
        await updatePromise;

        expect(updates).toHaveLength(2);

        // Assert Integrity of First URL
        expect(updates[0].output.url).toBe('https://storage.googleapis.com/veo/video-expiring-soon.mp4');
        expect(updates[0].output.metadata.quality).toBe('pro');

        // Assert Integrity of Refreshed URL
        expect(updates[1].output.url).toBe('https://storage.googleapis.com/veo/video-refreshed.mp4');
        expect(updates[1].output.metadata.quality).toBe('pro');
    });

    it('should handle massive metadata payloads without blocking (Simulated)', async () => {
        // Scenario: Veo 3.1 returns a massive JSON description or debug data in metadata.
        // We simulate a 4MB payload in the metadata.

        const massivePayload = 'x'.repeat(4 * 1024 * 1024); // 4MB string

        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-massive',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://veo.google.com/video.mp4',
                            metadata: {
                                mime_type: 'video/mp4',
                                quality: 'pro',
                                debug_logs: massivePayload
                            }
                        }
                    })
                });
            }, 100);
            return vi.fn();
        });

        const jobPromise = service.waitForJob('job-massive', 2000);
        vi.advanceTimersByTime(200);

        const result = await jobPromise;

        expect(result.output.metadata.debug_logs).toHaveLength(4194304);
        expect(result.output.metadata.mime_type).toBe('video/mp4');
    });

    it('should reject job if video URL returns 404 (Asset Integrity Guard)', async () => {
        // Scenario: Veo reports success, but the asset is missing (404)
        mocks.doc.mockReturnValue('doc-ref');

        // Mock fetch to return 404
        fetchMock.mockResolvedValue({ ok: false, status: 404 });

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-ghost',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://veo.google.com/ghost.mp4',
                            metadata: { mime_type: 'video/mp4' }
                        }
                    })
                });
            }, 100);
            return vi.fn();
        });

        const jobPromise = service.waitForJob('job-ghost', 2000);
        vi.advanceTimersByTime(200);

        // We expect the integrity check (fetch) to fail the job
        await expect(jobPromise).rejects.toThrow("Asset Integrity Failure: Video URL is unreachable (404).");

        expect(fetchMock).toHaveBeenCalledWith('https://veo.google.com/ghost.mp4', { method: 'HEAD' });
    });

    it('should accept job if video URL returns 200', async () => {
        mocks.doc.mockReturnValue('doc-ref');
        fetchMock.mockResolvedValue({ ok: true, status: 200 });

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-good',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://veo.google.com/good.mp4',
                            metadata: { mime_type: 'video/mp4' }
                        }
                    })
                });
            }, 100);
            return vi.fn();
        });

        const jobPromise = service.waitForJob('job-good', 2000);
        vi.advanceTimersByTime(200);

        await expect(jobPromise).resolves.toHaveProperty('status', 'completed');
        expect(fetchMock).toHaveBeenCalledWith('https://veo.google.com/good.mp4', { method: 'HEAD' });
    });
});
