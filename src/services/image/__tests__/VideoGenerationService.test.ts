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
    });
});
