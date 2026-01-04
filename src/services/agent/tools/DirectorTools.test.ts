
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DirectorTools } from './DirectorTools';
import { useStore } from '@/core/store';
import { ImageGeneration } from '@/services/image/ImageGenerationService';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: vi.fn()
    }
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        batchEdit: vi.fn(),
        editImage: vi.fn()
    }
}));

describe('DirectorTools', () => {
    let mockAddToHistory: any;

    beforeEach(() => {
        mockAddToHistory = vi.fn();
        const mockCreateFileNode = vi.fn();

        (useStore.getState as any).mockReturnValue({
            addToHistory: mockAddToHistory,
            createFileNode: mockCreateFileNode,
            currentProjectId: 'test-project',
            userProfile: { id: 'test-user', brandKit: {} },
            generatedHistory: [],
            setEntityAnchor: vi.fn(),
            studioControls: { resolution: '1024x1024', aspectRatio: '1:1', negativePrompt: '', seed: '' }
        });

        vi.clearAllMocks();
    });

    describe('generate_image', () => {
        it('should return ToolFunctionResult success and add to history', async () => {
            (ImageGeneration.generateImages as any).mockResolvedValue([{
                id: 'generated-id-1',
                url: 'data:image/png;base64,fake-data',
                prompt: 'test prompt'
            }]);

            const result = await DirectorTools.generate_image({ prompt: 'test prompt' });

            // Platinum standard: expect structured result
            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully generated 1 images');
            expect(result.data.urls).toContain('data:image/png;base64,fake-data');

            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                type: 'image',
                prompt: 'test prompt',
                url: 'data:image/png;base64,fake-data'
            }));
        });

        it('should handle errors gracefully using toolError pattern', async () => {
            (ImageGeneration.generateImages as any).mockRejectedValue(new Error('AI failed'));
            const result = await DirectorTools.generate_image({ prompt: 'test' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('AI failed');
        });
    });

    describe('generate_high_res_asset', () => {
        it('should generate image with high-res settings and structured result', async () => {
            (ImageGeneration.generateImages as any).mockResolvedValue([{
                id: 'hires-id-1',
                url: 'data:image/png;base64,hires-content',
                prompt: 'High-Res Asset: cd_front'
            }]);

            const result = await DirectorTools.generate_high_res_asset({
                prompt: 'cool design',
                templateType: 'cd_front'
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('High-resolution asset (cd_front) generated successfully');
            expect(result.data.url).toBe('data:image/png;base64,hires-content');

            // Verify persistence
            expect(mockAddToHistory).toHaveBeenCalledTimes(1);
            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                type: 'image',
                url: 'data:image/png;base64,hires-content',
                projectId: 'test-project',
                meta: 'high_res_asset'
            }));

            // Verify called with correct params
            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(expect.objectContaining({
                resolution: '4K',
                count: 1
            }));
        });
    });
});
