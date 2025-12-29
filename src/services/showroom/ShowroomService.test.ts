import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ShowroomService } from './ShowroomService';
import { Editing } from '@/services/image/EditingService';
import { VideoGeneration } from '@/services/image/VideoGenerationService';

// Mock dependencies
vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        generateComposite: vi.fn()
    }
}));

vi.mock('@/services/image/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn()
    }
}));

describe('ShowroomService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate a mockup using EditingService', async () => {
        const mockAsset = 'data:image/png;base64,mockdata';
        const mockPrompt = 'A cozy living room';
        const mockResult = { id: '1', url: 'https://mockup.url', prompt: 'prompt' };

        (Editing.generateComposite as any).mockResolvedValue(mockResult);

        const url = await ShowroomService.generateMockup(mockAsset, 'T-Shirt', mockPrompt);

        expect(Editing.generateComposite).toHaveBeenCalledWith(expect.objectContaining({
            images: [{ mimeType: 'image/png', data: 'mockdata' }],
            prompt: expect.stringContaining('T-SHIRT')
        }));
        expect(url).toBe('https://mockup.url');
    });

    it('should animate a scene using VideoGenerationService', async () => {
        const mockImage = 'https://mockup.url';
        const mockPrompt = 'Camera pans around';
        const mockResult = [{ id: '1', url: 'https://video.url', prompt: 'prompt' }];

        (VideoGeneration.generateVideo as any).mockResolvedValue(mockResult);

        const url = await ShowroomService.generateVideo(mockImage, mockPrompt);

        expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining(mockPrompt),
            firstFrame: mockImage
        }));
        expect(url).toBe('https://video.url');
    });

    it('should throw error if mockup generation fails', async () => {
        (Editing.generateComposite as any).mockResolvedValue(null);
        await expect(ShowroomService.generateMockup('data:image/png;base64,data', 'T-Shirt', 'prompt'))
            .rejects.toThrow('Failed to generate mockup image.');
    });

    it('should throw error if video generation fails', async () => {
        (VideoGeneration.generateVideo as any).mockResolvedValue([]);
        await expect(ShowroomService.generateVideo('mock.jpg', 'prompt'))
            .rejects.toThrow('Failed to animate scene.');
    });
});
