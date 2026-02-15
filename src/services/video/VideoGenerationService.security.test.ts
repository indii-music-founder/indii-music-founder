import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from './VideoGenerationService';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { useStore } from '@/core/store';

// --- MOCKS ---

// 1. Hoist httpsCallable mock
const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    triggerVideoJob: vi.fn(),
}));

// 2. Mock Firebase
vi.mock('@/services/firebase', () => ({
    functionsWest1: {},
    db: {},
    auth: {
        currentUser: { uid: 'test-user' }
    }
}));

// 3. Mock Firebase Functions
vi.mock('firebase/functions', () => ({
    httpsCallable: (functionsInstance: any, name: string) => {
        mocks.httpsCallable(name);
        if (name === 'triggerVideoJob') {
            return mocks.triggerVideoJob;
        }
        return vi.fn();
    }
}));

// 4. Mock Subscription Service
vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true }),
        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: 'pro' })
    }
}));

// 5. Mock Store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn(() => ({
            currentOrganizationId: 'org-123'
        }))
    }
}));

// 6. Mock Firebase AI (for temporal context analysis)
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        analyzeImage: vi.fn().mockResolvedValue('Temporal context')
    }
}));

describe('🛡️ Shield: Video Generation PII Security Test', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.triggerVideoJob.mockResolvedValue({ data: { jobId: 'job-123' } });
    });

    it('should REDACT Credit Card numbers from prompt before triggering backend generation', async () => {
        // Arrange: A prompt containing a sensitive credit card number
        const sensitivePrompt = "Generate a cinematic video of a credit card 4111 1111 1111 1111 lying on a table.";
        const expectedRedactedPattern = /\[REDACTED_CREDIT_CARD\]/;

        // Act
        await VideoGeneration.generateVideo({
            prompt: sensitivePrompt,
            duration: 5,
            aspectRatio: '16:9'
        });

        // Assert
        expect(mocks.triggerVideoJob).toHaveBeenCalled();
        const callArgs = mocks.triggerVideoJob.mock.calls[0][0];

        expect(callArgs.prompt).toMatch(expectedRedactedPattern);
        expect(callArgs.prompt).not.toContain("4111 1111 1111 1111");

        console.log("Captured Prompt Payload:", callArgs.prompt);
    });

    it('should REDACT Passwords/Secrets from prompt before triggering backend generation', async () => {
        // Arrange
        const sensitivePrompt = "Show a hacker typing password: SuperSecretPassword123! on a screen.";
        const expectedRedactedPattern = /\[REDACTED_SECRET\]/; // InputSanitizer uses [REDACTED_SECRET] for passwords

        // Act
        await VideoGeneration.generateVideo({
            prompt: sensitivePrompt,
            duration: 5,
            aspectRatio: '16:9'
        });

        // Assert
        expect(mocks.triggerVideoJob).toHaveBeenCalled();
        const callArgs = mocks.triggerVideoJob.mock.calls[0][0];

        expect(callArgs.prompt).toMatch(expectedRedactedPattern);
        expect(callArgs.prompt).not.toContain("SuperSecretPassword123!");
    });
});
