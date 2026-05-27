import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from './VideoGenerationService';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

// --- MOCKS ---

// 1. Hoist httpsCallable mock
const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    generateVideoV3: vi.fn(),
}));

// 2. Mock Firebase
vi.mock('@/services/firebase', () => ({
    functionsWest1: {},
    db: {},
    auth: {
        currentUser: { uid: 'test-user' }
    },
    remoteConfig: { defaultConfig: {} },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// 3. Mock Firebase Functions
vi.mock('firebase/functions', () => ({
    httpsCallable: (functionsInstance: any, name: string) => {
        mocks.httpsCallable(name);
        if (name === 'generateVideoV3') {
            return mocks.generateVideoV3;
        }
        return vi.fn();
    }
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({ id: 'mock-doc' })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'mock-doc-id' })),
    setDoc: vi.fn(() => Promise.resolve()),
    updateDoc: vi.fn(() => Promise.resolve()),
    collection: vi.fn(() => ({ id: 'mock-coll' })),
    serverTimestamp: vi.fn(() => new Date()),
    getFirestore: vi.fn(),
    onSnapshot: vi.fn(() => () => {}),
}));

vi.mock('uuid', () => ({
    v4: () => 'mock-uuid'
}));

// 5. Mock Subscription & Cost Control Services
vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true }),
        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: 'pro' })
    }
}));

vi.mock('@/services/billing/CostControlService', () => ({
    CostControlService: {
        checkAndReserve: vi.fn().mockResolvedValue({ 
            allowed: true,
            remainingBudget: 100,
            dailyUsed: 0,
            monthlyUsed: 0
        }),
        getStatus: vi.fn().mockResolvedValue({
            dailyUsed: 0,
            monthlyUsed: 0,
            dailyRemaining: 100,
            monthlyRemaining: 1000,
            tier: 'pro'
        })
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

vi.mock('@/services/intelligence/AutonomousIntelligence', () => {
    return {
        AutonomousIntelligence: {
            generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
            generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
            generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
            generateVideo: vi.fn().mockResolvedValue('https://mock-video.mp4'),
            analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
        }
    };
});

describe('🛡️ Shield: Video Generation PII Security Test', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.generateVideoV3.mockResolvedValue({ data: { jobId: 'job-123' } });
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
        expect(mocks.generateVideoV3).toHaveBeenCalled();
        const callArgs = mocks.generateVideoV3.mock.calls[0]![0];

        expect(callArgs).toBeDefined();
        expect(callArgs?.prompt).toMatch(expectedRedactedPattern);
        expect(callArgs?.prompt).not.toContain("4111 1111 1111 1111");

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
        expect(mocks.generateVideoV3).toHaveBeenCalled();
        const callArgs = mocks.generateVideoV3.mock.calls[0]![0];

        expect(callArgs).toBeDefined();
        expect(callArgs?.prompt).toMatch(expectedRedactedPattern);
        expect(callArgs?.prompt).not.toContain("SuperSecretPassword123!");
    });
});
