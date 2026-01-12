/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';
import { QuotaExceededError } from '@/shared/types/errors';

// ------------------------------------------------------------------
// 🎥 Lens's Mock Studio
// ------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    onSnapshot: vi.fn(),
    doc: vi.fn(),
    auth: { currentUser: { uid: 'lens-director' } },
    subscriptionService: {
        canPerformAction: vi.fn(),
        getCurrentSubscription: vi.fn()
    },
    useStore: {
        getState: vi.fn(() => ({ currentOrganizationId: 'org-lens-studio' }))
    },
    uuid: vi.fn(() => 'lens-uuid-fixed')
}));

// Mock Firebase & Internal Services
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

vi.mock('uuid', () => ({
    v4: mocks.uuid
}));

// ------------------------------------------------------------------
// 🎥 Lens's Verification Suite
// ------------------------------------------------------------------

describe('Lens: Veo 3.1 & Gemini 3 Native Generation', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        service = new VideoGenerationService();

        // Default: Allow actions
        mocks.subscriptionService.canPerformAction.mockResolvedValue({ allowed: true });

        // Default: Successful trigger
        mocks.httpsCallable.mockReturnValue(async () => ({ data: { jobId: 'job-123' } }));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ------------------------------------------------------------------
    // 📼 Scenario 1: Long-Form Payload Integrity (Veo 3.1)
    // ------------------------------------------------------------------
    it('Veo 3.1 Segmentation: Should split 24s prompt into exactly 3 Veo blocks', async () => {
        // Arrange
        const options = {
            prompt: "A futuristic chase sequence",
            totalDuration: 24, // 24 / 8 = 3 blocks
            userProfile: { id: 'user-1' } as any
        };
        const triggerMock = vi.fn().mockResolvedValue({ data: { jobId: 'long_lens-uuid-fixed' } });
        mocks.httpsCallable.mockReturnValue(triggerMock);

        // Act
        await service.generateLongFormVideo(options);

        // Assert
        const callArgs = triggerMock.mock.calls[0][0];

        // 1. Verify Block Math
        expect(callArgs.prompts).toHaveLength(3);

        // 2. Verify Prompt Suffixing (Lens Journal Learning)
        expect(callArgs.prompts[0]).toContain('(Part 1/3)');
        expect(callArgs.prompts[1]).toContain('(Part 2/3)');
        expect(callArgs.prompts[2]).toContain('(Part 3/3)');

        // 3. Verify Job ID convention
        expect(callArgs.jobId).toBe('long_lens-uuid-fixed');
    });

    // ------------------------------------------------------------------
    // 🛡️ Scenario 2: SafetySettings Handshake (Gemini 3)
    // ------------------------------------------------------------------
    it('Gemini 3 Safety: Should explicitly reject jobs blocked by safety filters', async () => {
        // Arrange
        mocks.doc.mockReturnValue('doc-ref');

        // Simulate Firestore immediately returning a "failed" status due to Safety
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            callback({
                exists: () => true,
                id: 'job-unsafe',
                data: () => ({
                    status: 'failed',
                    error: 'SAFETY_VIOLATION: Prompt violates usage policy.'
                })
            });
            return () => {};
        });

        // Act & Assert
        await expect(service.waitForJob('job-unsafe')).rejects.toThrow('SAFETY_VIOLATION');
    });

    // ------------------------------------------------------------------
    // ⚡ Scenario 3: Flash vs Pro Latency Handling
    // ------------------------------------------------------------------
    it('Latency: Should handle "Pro" generation times (25s) without timeout', async () => {
        // Arrange
        mocks.doc.mockReturnValue('doc-ref');

        // Simulate a delay before completion
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            // Initial Pending State
            callback({
                exists: () => true,
                id: 'job-pro',
                data: () => ({ status: 'processing' })
            });

            // Delayed Completion (25s later)
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-pro',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://mock.veo.pro/video.mp4',
                            metadata: {
                                duration_seconds: 5.0,
                                fps: 24,
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 25000);

            return () => {};
        });

        // Act
        const jobPromise = service.waitForJob('job-pro');

        // Fast-forward time by 25s
        vi.advanceTimersByTime(25000);

        const result = await jobPromise;

        // Assert
        expect(result.status).toBe('completed');
        expect(result.output.metadata.mime_type).toBe('video/mp4');
    });

    it('Latency: Should handle "Flash" generation times (<2s)', async () => {
        // Arrange
        mocks.doc.mockReturnValue('doc-ref');

        mocks.onSnapshot.mockImplementation((ref, callback) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: 'job-flash',
                    data: () => ({
                        status: 'completed',
                        output: {
                            url: 'https://mock.veo.flash/video.mp4',
                            metadata: {
                                duration_seconds: 2.0,
                                fps: 30,
                                mime_type: 'video/mp4'
                            }
                        }
                    })
                });
            }, 1000); // 1s
            return () => {};
        });

        // Act
        const jobPromise = service.waitForJob('job-flash');
        vi.advanceTimersByTime(1000);
        const result = await jobPromise;

        // Assert
        expect(result.status).toBe('completed');
    });

    // ------------------------------------------------------------------
    // 📝 Scenario 4: Metadata Contract (Lens Principle)
    // ------------------------------------------------------------------
    it('Metadata Contract: Should validate Veo 3.1 specific metadata', async () => {
        // Arrange
        mocks.doc.mockReturnValue('doc-ref');
        mocks.onSnapshot.mockImplementation((ref, callback) => {
            callback({
                exists: () => true,
                id: 'job-meta',
                data: () => ({
                    status: 'completed',
                    output: {
                        url: 'https://storage.googleapis.com/veo/output.mp4',
                        metadata: {
                            duration_seconds: 6.0,
                            fps: 60, // High frame rate check
                            mime_type: 'video/mp4'
                        }
                    }
                })
            });
            return () => {};
        });

        // Act
        const job = await service.waitForJob('job-meta');

        // Assert
        expect(job.output.metadata).toMatchObject({
            duration_seconds: expect.any(Number),
            fps: 60,
            mime_type: 'video/mp4'
        });

        // Lens specific check: Ensure duration is positive
        expect(job.output.metadata.duration_seconds).toBeGreaterThan(0);
    });
});
