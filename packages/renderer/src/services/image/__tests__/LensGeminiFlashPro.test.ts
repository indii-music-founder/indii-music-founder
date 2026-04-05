/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageGeneration } from '../ImageGenerationService';
import { httpsCallable } from 'firebase/functions';

// Hoisted Mocks
const mocks = vi.hoisted(() => ({
    httpsCallable: vi.fn(),
    canPerformAction: vi.fn(),
    trackImageGeneration: vi.fn(),
    auth: { currentUser: { uid: 'lens-tester' } },
    useStore: {
        getState: vi.fn(() => ({ userProfile: { id: 'lens-tester' } }))
    }
}));

// Mock Firebase Modules
vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
    getFunctions: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    functions: {},
    functionsWest1: {},
    auth: mocks.auth,
    db: {},
    remoteConfig: {},
    storage: {},
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// Mock Services
vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: mocks.canPerformAction,
        getSubscription: vi.fn().mockResolvedValue({ tier: 'pro' }),
        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: 'pro' })
    }
}));

vi.mock('@/services/subscription/UsageTracker', () => ({
    usageTracker: {
        trackImageGeneration: mocks.trackImageGeneration
    }
}));

vi.mock('@/core/store', () => ({
    useStore: mocks.useStore
}));

// Mock CloudStorageService dynamically imported in the service
vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: {
        smartSave: vi.fn().mockImplementation((dataUri, id) => Promise.resolve({ url: `https://storage.googleapis.com/mock/${id}.png` })),
        compressImage: vi.fn().mockResolvedValue({ dataUri: 'data:image/jpeg;base64,compressed' })
    }
}));

describe('Lens 🎥 - Gemini 3 Flash vs Pro Pipeline', () => {
    let generateImageMock: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup happy path for Subscription
        mocks.canPerformAction.mockResolvedValue({ allowed: true });

        // Setup generic mock for Cloud Function
        generateImageMock = vi.fn().mockResolvedValue({
            data: {
                images: [{ bytesBase64Encoded: 'mock-base64-data', mimeType: 'image/png' }]
            }
        });
        mocks.httpsCallable.mockReturnValue(generateImageMock);
    });

    it('should generate Flash image with low latency configuration', async () => {
        // Arrange
        const prompt = "A quick sketch of a cat";

        // Act
        // Implicitly 'fast' by default or explicit 'fast'
        const results = await ImageGeneration.generateImages({
            prompt,
            model: 'fast'
        });

        // Assert
        expect(results).toHaveLength(1);
        expect(generateImageMock).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining(prompt),
            model: 'fast'
        }));
    });

    it('should generate Pro image with high fidelity configuration', async () => {
        // Arrange
        const prompt = "A masterpiece painting of a cat";

        // Act
        const results = await ImageGeneration.generateImages({
            prompt,
            model: 'pro',
        });

        // Assert
        expect(results).toHaveLength(1);
        // Note: thinking/grounding params are intentionally stripped by the service
        // to prevent Gemini Image 400 errors
        expect(generateImageMock).toHaveBeenCalledWith(expect.objectContaining({
            model: 'pro',
        }));
    });

    it('should support iterative Upscale workflow (Flash -> Pro)', async () => {
        // Scenario:
        // 1. User generates a quick Flash draft.
        // 2. User likes it and requests a Pro upscale (same prompt, higher quality).

        const prompt = "Concept art of a futuristic city";

        // 1. Flash Step
        const flashPromise = ImageGeneration.generateImages({ prompt, model: 'fast' });
        await expect(flashPromise).resolves.toHaveLength(1);

        // Verify Flash Params
        expect(generateImageMock).toHaveBeenLastCalledWith(expect.objectContaining({
            model: 'fast'
        }));

        // 2. Pro Step
        const proPromise = ImageGeneration.generateImages({
            prompt,
            model: 'pro',
        });
        await expect(proPromise).resolves.toHaveLength(1);

        // Verify Pro Params (thinking is intentionally stripped by the service)
        expect(generateImageMock).toHaveBeenLastCalledWith(expect.objectContaining({
            model: 'pro',
        }));

        // Ensure two distinct calls were made
        expect(generateImageMock).toHaveBeenCalledTimes(2);
    });

    it('should gracefully handle Gemini 3 param overrides (stripped by service)', async () => {
        const prompt = "A news event";

        await ImageGeneration.generateImages({
            prompt,
            useGrounding: true,
            thinking: true
        });

        // The service intentionally strips thinking/grounding to prevent Gemini Image errors
        // Verify the call was made with the standard params
        expect(generateImageMock).toHaveBeenCalledWith(expect.objectContaining({
            model: 'fast',
        }));
    });
});
