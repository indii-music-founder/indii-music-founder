/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
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
        batchEdit: vi.fn()
    }
}));

import { ImageTools } from '../ImageTools';
import { useStore } from '@/core/store';
import { ImageGeneration } from '../services/image/ImageGenerationService';
import { Editing } from '../services/image/EditingService';

describe('ImageTools', () => {
    const mockStoreState = {
        studioControls: {
            resolution: '1024x1024',
            aspectRatio: '1:1',
            negativePrompt: '',
            seed: null
        },
        addToHistory: vi.fn(),
        currentProjectId: 'project-123',
        userProfile: {
            brandKit: {
                referenceImages: [
                    { url: 'data:image/png;base64,refImageData', description: 'Reference 1' }
                ],
                brandAssets: [
                    { url: 'data:image/png;base64,brandAssetData', description: 'Logo' }
                ]
            }
        },
        uploadedImages: [
            { url: 'data:image/png;base64,uploadedData', prompt: 'Uploaded Image 1' }
        ],
        entityAnchor: null,
        setEntityAnchor: vi.fn(),
        addAgentMessage: vi.fn()
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (useStore.getState as any).mockReturnValue(mockStoreState);
    });

    describe('generate_image', () => {
        it('should generate images successfully', async () => {
            const mockResults = [
                { id: 'img-1', url: 'data:image/png;base64,generated', prompt: 'test prompt' }
            ];
            (ImageGeneration.generateImages as any).mockResolvedValue(mockResults);

            const result = await ImageTools.generate_image({ prompt: 'test prompt' });

            expect(result).toContain('Successfully generated 1 images');
            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: 'test prompt',
                    count: 1
                })
            );
            expect(mockStoreState.addToHistory).toHaveBeenCalled();
        });

        it('should use reference image when referenceImageIndex is provided', async () => {
            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,gen', prompt: 'test' }];
            (ImageGeneration.generateImages as any).mockResolvedValue(mockResults);

            await ImageTools.generate_image({ prompt: 'test', referenceImageIndex: 0 });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceImages: [{ mimeType: 'image/png', data: 'refImageData' }]
                })
            );
        });

        it('should use brand asset when referenceAssetIndex is provided', async () => {
            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,gen', prompt: 'test' }];
            (ImageGeneration.generateImages as any).mockResolvedValue(mockResults);

            await ImageTools.generate_image({ prompt: 'test', referenceAssetIndex: 0 });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceImages: [{ mimeType: 'image/png', data: 'brandAssetData' }]
                })
            );
        });

        it('should use uploaded image when uploadedImageIndex is provided', async () => {
            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,gen', prompt: 'test' }];
            (ImageGeneration.generateImages as any).mockResolvedValue(mockResults);

            await ImageTools.generate_image({ prompt: 'test', uploadedImageIndex: 0 });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceImages: [{ mimeType: 'image/png', data: 'uploadedData' }]
                })
            );
        });

        it('should handle empty results', async () => {
            (ImageGeneration.generateImages as any).mockResolvedValue([]);

            const result = await ImageTools.generate_image({ prompt: 'test' });

            expect(result).toContain('no images were returned');
        });

        it('should handle generation errors', async () => {
            (ImageGeneration.generateImages as any).mockRejectedValue(new Error('API Error'));

            const result = await ImageTools.generate_image({ prompt: 'test' });

            expect(result).toContain('Image generation failed: API Error');
        });

        it('should use studio controls for defaults', async () => {
            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,gen', prompt: 'test' }];
            (ImageGeneration.generateImages as any).mockResolvedValue(mockResults);

            await ImageTools.generate_image({ prompt: 'test' });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    resolution: '1024x1024',
                    aspectRatio: '1:1'
                })
            );
        });
    });

    describe('batch_edit_images', () => {
        it('should batch edit images successfully', async () => {
            const mockResults = [
                { id: 'edited-1', url: 'data:image/png;base64,edited', prompt: 'edited' }
            ];
            (Editing.batchEdit as any).mockResolvedValue(mockResults);

            const result = await ImageTools.batch_edit_images({
                prompt: 'make it brighter'
            });

            expect(result).toContain('Successfully edited 1 images');
            expect(Editing.batchEdit).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: 'make it brighter'
                })
            );
        });

        it('should handle specific image indices', async () => {
            const stateWithMultipleImages = {
                ...mockStoreState,
                uploadedImages: [
                    { url: 'data:image/png;base64,img1', prompt: 'Image 1' },
                    { url: 'data:image/png;base64,img2', prompt: 'Image 2' },
                    { url: 'data:image/png;base64,img3', prompt: 'Image 3' }
                ]
            };
            (useStore.getState as any).mockReturnValue(stateWithMultipleImages);

            const mockResults = [{ id: 'edited', url: 'data:image/png;base64,edited', prompt: 'edited' }];
            (Editing.batchEdit as any).mockResolvedValue(mockResults);

            await ImageTools.batch_edit_images({
                prompt: 'enhance',
                imageIndices: [0, 2]
            });

            expect(Editing.batchEdit).toHaveBeenCalledWith(
                expect.objectContaining({
                    images: expect.arrayContaining([
                        { mimeType: 'image/png', data: 'img1' },
                        { mimeType: 'image/png', data: 'img3' }
                    ])
                })
            );
        });

        it('should return error when no images uploaded', async () => {
            (useStore.getState as any).mockReturnValue({
                ...mockStoreState,
                uploadedImages: []
            });

            const result = await ImageTools.batch_edit_images({ prompt: 'edit' });

            expect(result).toContain('No images found in uploads');
        });

        it('should handle batch edit errors', async () => {
            (Editing.batchEdit as any).mockRejectedValue(new Error('Edit failed'));

            const result = await ImageTools.batch_edit_images({ prompt: 'edit' });

            expect(result).toContain('Batch edit failed: Edit failed');
        });
    });

    describe('render_cinematic_grid', () => {
        it('should generate cinematic grid', async () => {
            const mockResults = [{ id: 'grid-1', url: 'data:image/png;base64,grid', prompt: 'grid' }];
            (ImageGeneration.generateImages as any).mockResolvedValue(mockResults);

            const result = await ImageTools.render_cinematic_grid({ prompt: 'action scene' });

            expect(result).toContain('Cinematic grid generated');
            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: expect.stringContaining('cinematic grid'),
                    resolution: '4K',
                    aspectRatio: '16:9'
                })
            );
        });

        it('should use entity anchor when available', async () => {
            (useStore.getState as any).mockReturnValue({
                ...mockStoreState,
                entityAnchor: { url: 'data:image/png;base64,anchorData' }
            });

            const mockResults = [{ id: 'grid-1', url: 'data:image/png;base64,grid', prompt: 'grid' }];
            (ImageGeneration.generateImages as any).mockResolvedValue(mockResults);

            await ImageTools.render_cinematic_grid({ prompt: 'scene' });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceImages: [{ mimeType: 'image/png', data: 'anchorData' }],
                    prompt: expect.stringContaining('character consistency')
                })
            );
        });

        it('should handle generation failure', async () => {
            (ImageGeneration.generateImages as any).mockResolvedValue([]);

            const result = await ImageTools.render_cinematic_grid({ prompt: 'scene' });

            expect(result).toContain('Failed to generate cinematic grid');
        });
    });

    describe('set_entity_anchor', () => {
        it('should set entity anchor successfully', async () => {
            const result = await ImageTools.set_entity_anchor({
                image: 'data:image/png;base64,anchorImageData'
            });

            expect(result).toContain('Entity Anchor set successfully');
            expect(mockStoreState.setEntityAnchor).toHaveBeenCalled();
            expect(mockStoreState.addToHistory).toHaveBeenCalled();
        });

        it('should reject invalid image data', async () => {
            const result = await ImageTools.set_entity_anchor({
                image: 'not-a-valid-data-uri'
            });

            expect(result).toContain('Invalid image data');
            expect(mockStoreState.setEntityAnchor).not.toHaveBeenCalled();
        });
    });

    describe('extract_grid_frame', () => {
        it('should acknowledge extraction request', async () => {
            const result = await ImageTools.extract_grid_frame({ gridIndex: 0 });

            expect(result).toContain('not fully implemented');
        });
    });
});
