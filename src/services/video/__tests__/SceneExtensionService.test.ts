import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneExtensionService } from '../SceneExtensionService';
import { AI } from '../../ai/AIService';
import { MembershipService } from '../../MembershipService';

// Mock dependencies
vi.mock('../../ai/AIService', () => ({
    AI: {
        generateVideo: vi.fn(),
    },
}));

vi.mock('../../MembershipService', () => ({
    MembershipService: {
        checkQuota: vi.fn(),
        checkVideoDurationQuota: vi.fn(),
        incrementUsage: vi.fn(),
        getCurrentTier: vi.fn(),
        getUpgradeMessage: vi.fn(),
        formatDuration: vi.fn(),
    },
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: { id: 'test-user-id' },
        }),
    },
}));

describe('SceneExtensionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should generate a 24s video in 3 segments about "dogs having fun"', async () => {
        // 1. Mock MembershipService to allow the operation
        vi.mocked(MembershipService.checkQuota).mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 10 });
        vi.mocked(MembershipService.checkVideoDurationQuota).mockResolvedValue({ allowed: true, maxDuration: 60, tierName: 'pro' });
        vi.mocked(MembershipService.getCurrentTier).mockResolvedValue('pro');

        // 2. Mock AI.generateVideo to return a fake URI
        vi.mocked(AI.generateVideo).mockResolvedValue('https://mock-storage.com/video.mp4');

        // 3. Mock extractLastFrame to avoid DOM/Canvas issues in test env
        // Accessing private method via type assertion
        const extractLastFrameSpy = vi.spyOn(SceneExtensionService as any, 'extractLastFrame')
            .mockResolvedValue({ mimeType: 'image/png', data: 'fake-base64-image-data' });

        // 4. Run the function under test
        const result = await SceneExtensionService.createExtendedVideo({
            prompt: 'dogs having fun',
            totalDurationSeconds: 24,
            segmentDurationSeconds: 8, // Explicitly setting 8s as per requirement, though it is default
        });

        // 5. Verifications

        // Should return a project with 3 segments (24 / 8 = 3)
        expect(result.project.segments).toHaveLength(3);
        expect(result.videoUris).toHaveLength(3);
        expect(result.totalDurationSeconds).toBe(24);

        // Verify AI generation was called 3 times
        expect(AI.generateVideo).toHaveBeenCalledTimes(3);

        // Verify calls to AI Service
        // First call: No image (unless provided in options), just prompt
        expect(AI.generateVideo).toHaveBeenNthCalledWith(1, expect.objectContaining({
            prompt: 'dogs having fun',
            image: undefined,
        }));

        // Second call: Should use the "last frame" from the first segment
        expect(AI.generateVideo).toHaveBeenNthCalledWith(2, expect.objectContaining({
            prompt: expect.stringContaining('Continue the scene'),
            image: {
                mimeType: 'image/png',
                imageBytes: 'fake-base64-image-data', // The mock data returned by extractLastFrame
            },
        }));

        // Third call: Should also use the "last frame" (mocked same return)
        expect(AI.generateVideo).toHaveBeenNthCalledWith(3, expect.objectContaining({
            prompt: expect.stringContaining('Continue the scene'),
            image: {
                mimeType: 'image/png',
                imageBytes: 'fake-base64-image-data',
            },
        }));

        // Verify extractLastFrame was called twice (after segment 1 and after segment 2)
        // It is not called after the last segment because there is no next segment to feed into.
        expect(extractLastFrameSpy).toHaveBeenCalledTimes(2);
    });
});
