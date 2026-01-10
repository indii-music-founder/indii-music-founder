import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGeneration } from '../VideoGenerationService';
import { onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

vi.mock('../../ai/FirebaseAIService', () => ({
    firebaseAI: {
        analyzeImage: vi.fn().mockResolvedValue("Mocked temporal analysis result.")
    }
}));

vi.mock('@/services/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-lens-user' }
    },
    db: {},
    functions: {}
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: { jobId: 'mock-veo-job-id' } }))
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    onSnapshot: vi.fn()
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true }),
        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: Promise.resolve('pro') })
    }
}));

// -----------------------------------------------------------------------------
// Test Suite: Lens Veo 3.1 Verification
// -----------------------------------------------------------------------------
describe('🎥 Lens: Veo 3.1 Generation Pipeline', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ✅ Requirement: Assert on Veo 3.1 specific metadata
    it('should strictly validate Veo 3.1 metadata contract (Duration, FPS, MIME)', async () => {
        const mockJobId = 'veo-contract-test-id';

        // Mock a successful Veo 3.1 response
        const validVeoMetadata = {
            status: 'completed',
            url: 'https://storage.googleapis.com/veo-3-1-output/signed-url.mp4?token=123',
            metadata: {
                duration_seconds: 5.0, // Veo specific
                fps: 24,               // Standard cinematic
                mime_type: 'video/mp4', // Required container
                resolution: '1280x720',
                model_version: 'veo-3.1-preview-0520'
            }
        };

        // Simulate async Firestore update
        vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
            // 1. Initial State: Processing
            callback({
                exists: () => true,
                id: mockJobId,
                data: () => ({ status: 'processing', progress: 10 })
            });

            // 2. Final State: Completed (after "network" delay)
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => validVeoMetadata
                });
            }, 1000);

            return vi.fn(); // Unsubscribe
        });

        // Start the wait
        const jobPromise = VideoGeneration.waitForJob(mockJobId);

        // Fast-forward time
        vi.advanceTimersByTime(1100);

        const result = await jobPromise;

        // 🔍 Lens Assertions
        expect(result.status).toBe('completed');
        expect(result.url).toContain('signed-url.mp4'); // Mocked Signed URL

        // Metadata Contract
        expect(result.metadata.duration_seconds).toBeGreaterThan(0);
        expect(result.metadata.mime_type).toBe('video/mp4');
        expect([24, 30, 60]).toContain(result.metadata.fps);
    });

    // ✅ Requirement: Verify the "SafetySettings" handshake
    it('should handle Gemini 3 Native Safety Filter rejections gracefully', async () => {
        const mockJobId = 'unsafe-prompt-id';

        // Mock a safety violation from Google Cloud
        const safetyErrorPayload = {
            status: 'failed',
            error: 'SAFETY_VIOLATION',
            details: {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
        };

        vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => safetyErrorPayload
                });
            }, 500);
            return vi.fn();
        });

        const jobPromise = VideoGeneration.waitForJob(mockJobId);
        vi.advanceTimersByTime(600);

        await expect(jobPromise).rejects.toThrow(/SAFETY_VIOLATION/);
    });

    // ✅ Requirement: Flash vs Pro Timeout Guard
    // Pro models (Veo) take longer (>30s) and should NOT timeout early
    // Flash models (Gemini Flash) should return quickly (<5s)
    it('should allow "Pro" generation to run longer than standard HTTP timeouts', async () => {
        const mockJobId = 'veo-pro-job-slow';

        // Simulate a very slow job (e.g., 45 seconds)
        vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
            callback({
                exists: () => true,
                id: mockJobId,
                data: () => ({ status: 'processing', progress: 50 })
            });

            // Finish after 45s
            setTimeout(() => {
                callback({
                    exists: () => true,
                    id: mockJobId,
                    data: () => ({ status: 'completed', url: 'valid.mp4' })
                });
            }, 45000);

            return vi.fn();
        });

        // Wait with a 60s timeout (Pro setting)
        const jobPromise = VideoGeneration.waitForJob(mockJobId, 60000);

        // Advance past standard 30s HTTP timeout but before 60s
        vi.advanceTimersByTime(46000);

        const result = await jobPromise;
        expect(result.status).toBe('completed');
    });

    it('should enforce strict timeout for "Flash" generation scenarios', async () => {
         const mockJobId = 'gemini-flash-job-stuck';

         // Simulate a stuck job
         vi.mocked(onSnapshot).mockImplementation((ref, callback: any) => {
             callback({
                 exists: () => true,
                 id: mockJobId,
                 data: () => ({ status: 'processing' })
             });
             // Never completes
             return vi.fn();
         });

         // Wait with a 2s timeout (Flash setting)
         const jobPromise = VideoGeneration.waitForJob(mockJobId, 2000);

         vi.advanceTimersByTime(2500);

         await expect(jobPromise).rejects.toThrow(/timeout/i);
    });
});
