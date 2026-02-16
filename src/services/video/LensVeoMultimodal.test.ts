/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';

// Mocks
const mocks = vi.hoisted(() => ({
    analyzeImage: vi.fn(),
    triggerVideoJob: vi.fn(),
    canPerformAction: vi.fn(),
    currentUser: { uid: 'lens-user' },
    getState: vi.fn(() => ({ currentOrganizationId: 'org-lens' }))
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: mocks.currentUser },
    functions: {},
    functionsWest1: {},
    db: {},
    remoteConfig: { defaultConfig: {} },
}));

vi.mock('../firebase', () => ({
    auth: { currentUser: mocks.currentUser },
    functions: {},
    functionsWest1: {},
    db: {}
}));

vi.mock('../ai/FirebaseAIService', () => ({
    firebaseAI: {
        analyzeImage: mocks.analyzeImage
    }
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: mocks.canPerformAction
    }
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: mocks.getState
    }
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: () => mocks.triggerVideoJob,
    getFunctions: vi.fn()
}));

vi.mock('uuid', () => ({
    v4: () => 'job-lens-multimodal'
}));

describe('Lens 🎥 - Gemini 3 Native Multimodal Pipeline', () => {
    let service: VideoGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new VideoGenerationService();
        mocks.canPerformAction.mockResolvedValue({ allowed: true });
        mocks.triggerVideoJob.mockResolvedValue({ data: { jobId: 'job-lens-multimodal' } });
    });

    it('should inject Gemini 3 temporal analysis into Veo prompt when `firstFrame` is present', async () => {
        // Arrange
        const userPrompt = "A cybernetic cat jumping";
        const geminiAnalysis = "The cat compresses its hydraulic legs preparing for a vertical leap.";
        const firstFrame = "data:image/png;base64,mock";

        mocks.analyzeImage.mockResolvedValue(geminiAnalysis);

        // Act
        await service.generateVideo({
            prompt: userPrompt,
            firstFrame: firstFrame,
            timeOffset: 2
        });

        // Assert
        // 1. Verify Gemini was consulted
        expect(mocks.analyzeImage).toHaveBeenCalledWith(
            expect.stringContaining("Analyze this image frame"),
            firstFrame
        );

        // 2. Verify Veo received the enriched prompt
        expect(mocks.triggerVideoJob).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining(geminiAnalysis),
            jobId: 'job-lens-multimodal'
        }));

        // 3. Verify original prompt is preserved
        expect(mocks.triggerVideoJob).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining(userPrompt)
        }));
    });

    it('should bypass temporal analysis if no reference frame is provided', async () => {
        // Arrange
        const userPrompt = "Pure text generation";

        // Act
        await service.generateVideo({
            prompt: userPrompt
        });

        // Assert
        expect(mocks.analyzeImage).not.toHaveBeenCalled();
        expect(mocks.triggerVideoJob).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.not.stringContaining("undefined") // basic sanity check
        }));
    });
});
