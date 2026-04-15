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

vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: { generateContent: vi.fn() },
}));

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
        it('maps "720p" to "1K"', () => {
            expect(normalizer('720p')).toBe('1K');
        });

        it('maps "1080p" to "2K"', () => {
            expect(normalizer('1080p')).toBe('2K');
        });

        it('maps "4k" to "4K"', () => {
            expect(normalizer('4k')).toBe('4K');
        });
    });

    describe('Direct passthrough for already-correct values', () => {
        it('"1K" passes through', () => {
            expect(normalizer('1K')).toBe('1K');
        });

        it('"2K" passes through', () => {
            expect(normalizer('2K')).toBe('2K');
        });

        it('"4K" passes through', () => {
            expect(normalizer('4K')).toBe('4K');
        });

        it('"512" passes through', () => {
            expect(normalizer('512')).toBe('512');
        });
    });

    describe('Case-insensitive handling', () => {
        it('"1k" (lowercase) → "1K"', () => {
            expect(normalizer('1k')).toBe('1K');
        });

        it('"2k" (lowercase) → "2K"', () => {
            expect(normalizer('2k')).toBe('2K');
        });
    });

    describe('Edge cases', () => {
        it('returns undefined for undefined input', () => {
            expect(normalizer(undefined)).toBeUndefined();
        });

        it('returns undefined for empty string (falsy)', () => {
            expect(normalizer('')).toBeUndefined();
        });

        it('defaults unknown value "720P" to "1K"', () => {
            // This was the exact bug: studioControls.resolution '720p' → .toUpperCase() → '720P'
            expect(normalizer('720P')).toBe('1K');
        });

        it('defaults unknown value "ULTRA" to "1K"', () => {
            expect(normalizer('ULTRA')).toBe('1K');
        });
    });
});
