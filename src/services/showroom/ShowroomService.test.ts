import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ShowroomService } from './ShowroomService';
import { Editing } from '@/services/image/EditingService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';

// Mock dependencies
vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        generateComposite: vi.fn()
    }
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
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
        const mockResult = { id: '1', url: 'https://mockup.url', prompt: 'prompt', width: 1024, height: 1024, createdAt: 100 };

        vi.mocked(Editing.generateComposite).mockResolvedValue(mockResult);

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
        const mockResult = [{ id: '1', url: 'https://video.url', prompt: 'prompt', duration: 4, createdAt: 100 }];

        vi.mocked(VideoGeneration.generateVideo).mockResolvedValue(mockResult);

        const url = await ShowroomService.generateVideo(mockImage, mockPrompt);

        expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
            prompt: expect.stringContaining(mockPrompt),
            firstFrame: mockImage
        }));
        expect(url).toBe('https://video.url');
    });

    it('should throw error if mockup generation fails', async () => {
        vi.mocked(Editing.generateComposite).mockResolvedValue(null);
        await expect(ShowroomService.generateMockup('data:image/png;base64,data', 'T-Shirt', 'prompt'))
            .rejects.toThrow('Failed to generate mockup image.');
    });

    it('should throw error if video generation fails', async () => {
        vi.mocked(VideoGeneration.generateVideo).mockResolvedValue([]);
        await expect(ShowroomService.generateVideo('mock.jpg', 'prompt'))
            .rejects.toThrow('Failed to animate scene.');
    });
});
