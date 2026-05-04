import { describe, it, expect, vi } from 'vitest';
import { ImageGeneration } from '../ImageGenerationService';

// Match the project's mock pattern
vi.mock('@/services/firebase', () => ({
    functions: {},
    functionsWest1: {},
    auth: { currentUser: { uid: 'test-user' } },
    remoteConfig: {},
    storage: {},
    db: {},
    ai: {},
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(),
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: { generateContent: vi.fn(), parseJSON: vi.fn() },
}));

vi.mock('@/services/ai/FirebaseAIService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock AI response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseAIService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true }),
        getSubscription: vi.fn().mockResolvedValue({ tier: 'pro' }),
        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: 'pro' }),
    },
}));

vi.mock('@/services/subscription/UsageTracker', () => ({
    usageTracker: { trackImageGeneration: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/core/store', () => ({
    useStore: { getState: vi.fn().mockReturnValue({ userProfile: null }) },
}));

vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: {
        smartSave: vi.fn().mockResolvedValue({ url: 'mock-url' }),
        compressImage: vi.fn().mockResolvedValue({ dataUri: 'data:image/png;base64,mock' }),
    },
}));

describe('Image Resolution Normalization', () => {
    /**
     * Access the private normalizer via the prototype.
     * This is the method that fixes the "Expected '1k' | '2k' | '4k', received '720P'" bug.
     */
    const normalizer = (ImageGeneration as unknown as {
        normalizeImageResolution: (res?: string) => string | undefined;
    }).normalizeImageResolution.bind(ImageGeneration);

    describe('Video-style → Image API mapping', () => {
        it('maps "720p" to "1k"', () => {
            expect(normalizer('720p')).toBe('1k');
        });

        it('maps "1080p" to "2k"', () => {
            expect(normalizer('1080p')).toBe('2k');
        });

        it('maps "4k" to "4k"', () => {
            expect(normalizer('4k')).toBe('4k');
        });
    });

    describe('Direct passthrough for already-correct values', () => {
        it('"1K" passes through', () => {
            expect(normalizer('1K')).toBe('1k');
        });

        it('"2K" passes through', () => {
            expect(normalizer('2K')).toBe('2k');
        });

        it('"4K" passes through', () => {
            expect(normalizer('4K')).toBe('4k');
        });

        it('"512" passes through', () => {
            expect(normalizer('512')).toBe('512');
        });
    });

    describe('Case-insensitive handling', () => {
        it('"1k" (lowercase) → "1k"', () => {
            expect(normalizer('1k')).toBe('1k');
        });

        it('"2k" (lowercase) → "2k"', () => {
            expect(normalizer('2k')).toBe('2k');
        });
    });

    describe('Edge cases', () => {
        it('returns undefined for undefined input', () => {
            expect(normalizer(undefined)).toBeUndefined();
        });

        it('returns undefined for empty string (falsy)', () => {
            expect(normalizer('')).toBeUndefined();
        });

        it('defaults unknown value "720P" to "1k"', () => {
            // This was the exact bug: studioControls.resolution '720p' → .toUpperCase() → '720P'
            expect(normalizer('720P')).toBe('1k');
        });

        it('defaults unknown value "ULTRA" to "1k"', () => {
            expect(normalizer('ULTRA')).toBe('1k');
        });
    });
});
