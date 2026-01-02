import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from '../VideoGenerationService';
import { AI } from '../../ai/AIService';

// Mock dependencies
vi.mock('../../ai/AIService', () => ({
    AI: {
        generateVideo: vi.fn(),
        generateContent: vi.fn(),
    }
}));

// Mock MembershipService to allow quota checks in tests
vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkQuota: vi.fn().mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 100 }),
        checkVideoDurationQuota: vi.fn().mockResolvedValue({ allowed: true, maxDuration: 3600, tierName: 'Pro' }),
        getCurrentTier: vi.fn().mockResolvedValue('pro'),
        getUpgradeMessage: vi.fn().mockReturnValue('Upgrade to Pro for more'),
    }
}));

describe('VideoGenerationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateVideo', () => {
        it('should generate video successfully', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.url');

            const result = await VideoGeneration.generateVideo({ prompt: 'test video' });

            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('http://video.url');
            expect(AI.generateVideo).toHaveBeenCalled();
        });

        it('should throw error if video generation fails', async () => {
            (AI.generateVideo as any).mockRejectedValue(new Error('Video Error'));

            await expect(VideoGeneration.generateVideo({ prompt: 'test video' }))
                .rejects.toThrow('Video Error');
        });

        it('should throw error if video generation returns no result', async () => {
            (AI.generateVideo as any).mockResolvedValue(null);

            await expect(VideoGeneration.generateVideo({ prompt: 'test video' }))
                .rejects.toThrow('Video generation returned no result');
        });
        it('should include ingredients in the prompt', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.url');

            await VideoGeneration.generateVideo({
                prompt: 'test video',
                ingredients: ['data:image/png;base64,1', 'data:image/png;base64,2']
            });

            const callArgs = (AI.generateVideo as any).mock.calls[0][0];
            expect(callArgs.prompt).toContain('Reference Ingredients');
            expect(callArgs.prompt).toContain('2 reference images');
        });

        it('should handle empty ingredients array gracefully', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.url');

            await VideoGeneration.generateVideo({
                prompt: 'test video',
                ingredients: []
            });

            const callArgs = (AI.generateVideo as any).mock.calls[0][0];
            expect(callArgs.prompt).not.toContain('Reference Ingredients');
        });

        it('should handle mixed inputs (firstFrame + ingredients)', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.url');

            await VideoGeneration.generateVideo({
                prompt: 'test video',
                firstFrame: 'data:image/png;base64,start',
                ingredients: ['data:image/png;base64,ref1']
            });

            const callArgs = (AI.generateVideo as any).mock.calls[0][0];
            expect(callArgs.image).toBeDefined(); // firstFrame
            expect(callArgs.prompt).toContain('Reference Ingredients');
            expect(callArgs.prompt).toContain('1 reference images');
        });
    });
});
