import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from './VideoGenerationService';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { httpsCallable } from 'firebase/functions';

// -----------------------------------------------------------------------------
// LEDGER'S TEST SUITE: SERVICE LAYER CIRCUIT BREAKER
// -----------------------------------------------------------------------------
// "If the Agent can't explain the cost, the Agent can't spend the money."
// This test verifies that the VideoGenerationService strictly respects the
// subscription quota and aborts BEFORE invoking any cost-incurring Cloud Functions.
// -----------------------------------------------------------------------------

// Mock dependencies
vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'ledger-test-user' } },
    functionsWest1: {},
    db: {},
    remoteConfig: { defaultConfig: {} },
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({ currentOrganizationId: 'ledger-org' })
    }
}));

// Mock SubscriptionService
vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn()
    }
}));

// Mock Firebase Functions
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: vi.fn()
}));

// Mock Firebase AI (used in analyzeTemporalContext)
vi.mock('../ai/FirebaseAIService', () => ({
    firebaseAI: {
        analyzeImage: vi.fn()
    }
}));

// Mock Utils
vi.mock('@/utils/video', () => ({
    extractVideoFrame: vi.fn()
}));

describe('VideoGenerationService (Ledger Circuit Breaker)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('💸 "Cost Circuit Breaker": Halts generation when quota is exceeded', async () => {
        // 1. Setup: Simulate "Quota Exceeded" / "Circuit Breaker Active"
        // The Accountant says NO.
        (subscriptionService.canPerformAction as any).mockResolvedValue({
            allowed: false,
            reason: 'Circuit Breaker Active: Monthly limit reached.'
        });

        // Mock the Cloud Function (The "Spend" Button)
        const mockTriggerJob = vi.fn();
        (httpsCallable as any).mockReturnValue(mockTriggerJob);

        // 2. Action: Attempt to generate video
        const options: any = {
            prompt: 'A cinematic shot of a ledger book closing firmly.',
            resolution: '1080p',
            aspectRatio: '16:9',
            duration: 4,
            fps: 24,
            cameraMovement: 'Static',
            motionStrength: 0.5
        };

        console.log('\n💸 [Ledger] Testing Service Layer Circuit Breaker...');

        // 3. Verification: Expect Error & No Spending
        await expect(VideoGeneration.generateVideo(options)).rejects.toThrow(
            'Quota exceeded: Circuit Breaker Active: Monthly limit reached.'
        );

        console.log('   ✅ Circuit Breaker tripped successfully.');

        // "If the Agent can't explain the cost, the Agent can't spend the money."
        // Verify that the cloud function (the cost center) was NEVER called.
        // httpsCallable is called to create the function reference, but the function itself (mockTriggerJob) should not be called.
        // Actually, logic is: `const triggerVideoJob = httpsCallable(...)` then `await triggerVideoJob(...)`.
        // If we stop before creating the reference, `httpsCallable` might not even be called if it's inside `triggerVideoGeneration`.

        // VideoGenerationService.ts: `generateVideo` calls `triggerVideoGeneration` at the end.
        // `triggerVideoGeneration` calls `httpsCallable`.
        // So `httpsCallable` should NOT be called.

        expect(httpsCallable).not.toHaveBeenCalled();
        expect(mockTriggerJob).not.toHaveBeenCalled();

        console.log('   ✅ "Spend" Button (Cloud Function) was NOT pressed.');
    });
});
