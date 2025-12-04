import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from '../VideoGenerationService';
import { AI } from '../../ai/AIService';
import { ImageGeneration } from '../ImageGenerationService';

// Mock dependencies
vi.mock('../../ai/AIService', () => ({
    AI: {
        generateVideo: vi.fn(),
        generateContent: vi.fn(),
    }
}));

vi.mock('../ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: vi.fn()
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

        it('should fallback to storyboard if video generation fails', async () => {
            (AI.generateVideo as any).mockRejectedValue(new Error('Video Error'));
            (ImageGeneration.generateImages as any).mockResolvedValue([{
                id: '1',
                url: 'data:image/png;base64,storyboard',
                prompt: 'storyboard'
            }]);

            const result = await VideoGeneration.generateVideo({ prompt: 'test video' });

            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('data:image/png;base64,storyboard');
            expect(result[0].prompt).toContain('[Storyboard Fallback]');
            expect(ImageGeneration.generateImages).toHaveBeenCalled();
        });

        it('should use ultimate fallback if everything fails', async () => {
            (AI.generateVideo as any).mockRejectedValue(new Error('Video Error'));
            (ImageGeneration.generateImages as any).mockRejectedValue(new Error('Image Error'));

            const result = await VideoGeneration.generateVideo({ prompt: 'test video' });

            expect(result).toHaveLength(1);
            expect(result[0].url).toContain('BigBuckBunny.mp4');
            expect(result[0].prompt).toContain('[ERROR:');
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
