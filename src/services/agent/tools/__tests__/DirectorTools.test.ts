import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DirectorTools } from '../DirectorTools';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Editing } from '@/services/image/EditingService';
import { useStore } from '@/core/store';

// Mock dependencies
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

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

// Default mock store state
const createMockStoreState = (overrides = {}) => ({
    studioControls: {
        resolution: '1024x1024',
        aspectRatio: '1:1',
        negativePrompt: '',
        seed: null
    },
    addToHistory: vi.fn(),
    addAgentMessage: vi.fn(),
    currentProjectId: 'test-project',
    userProfile: {
        uid: 'test-user',
        email: 'test@example.com',
        brandKit: {
            socials: { distributor: 'distrokid' },
            referenceImages: [],
            brandAssets: []
        }
    },
    uploadedImages: [],
    generatedHistory: [],
    entityAnchor: null,
    setEntityAnchor: vi.fn(),
    ...overrides
});

describe('DirectorTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useStore.getState as any).mockReturnValue(createMockStoreState());
    });

    describe('generate_image', () => {
        it('passes userProfile to ImageGenerationService', async () => {
            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,abc123', prompt: 'test' }];
            vi.mocked(ImageGeneration.generateImages).mockResolvedValue(mockResults);

            await DirectorTools.generate_image({ prompt: 'A beautiful landscape' });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    userProfile: expect.objectContaining({ uid: 'test-user' })
                })
            );
        });

        it('adds results to history', async () => {
            const mockAddToHistory = vi.fn();
            (useStore.getState as any).mockReturnValue(createMockStoreState({ addToHistory: mockAddToHistory }));

            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,abc123', prompt: 'test' }];
            vi.mocked(ImageGeneration.generateImages).mockResolvedValue(mockResults);

            await DirectorTools.generate_image({ prompt: 'A beautiful landscape' });

            expect(mockAddToHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'img-1',
                    type: 'image',
                    projectId: 'test-project'
                })
            );
        });

        it('handles reference images from brand kit', async () => {
            const refImages = [{ url: 'data:image/png;base64,refdata', description: 'Reference' }];
            (useStore.getState as any).mockReturnValue(createMockStoreState({
                userProfile: {
                    uid: 'test-user',
                    brandKit: { referenceImages: refImages }
                }
            }));

            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,abc123', prompt: 'test' }];
            vi.mocked(ImageGeneration.generateImages).mockResolvedValue(mockResults);

            await DirectorTools.generate_image({ prompt: 'A scene', referenceImageIndex: 0 });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceImages: [{ mimeType: 'image/png', data: 'refdata' }]
                })
            );
        });

        it('returns error message on failure', async () => {
            vi.mocked(ImageGeneration.generateImages).mockRejectedValue(new Error('API Error'));

            const result = await DirectorTools.generate_image({ prompt: 'test' });

            expect(result).toContain('Image generation failed');
            expect(result).toContain('API Error');
        });
    });

    describe('generate_high_res_asset', () => {
        it('sets isCoverArt=true for jacket template', async () => {
            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,abc123', prompt: 'test' }];
            vi.mocked(ImageGeneration.generateImages).mockResolvedValue(mockResults);

            await DirectorTools.generate_high_res_asset({
                prompt: 'Album art',
                templateType: 'jacket'
            });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    isCoverArt: true,
                    aspectRatio: '1:1'
                })
            );
        });

        it('sets isCoverArt=true for vinyl template', async () => {
            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,abc123', prompt: 'test' }];
            vi.mocked(ImageGeneration.generateImages).mockResolvedValue(mockResults);

            await DirectorTools.generate_high_res_asset({
                prompt: 'Album art',
                templateType: 'vinyl'
            });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    isCoverArt: true,
                    aspectRatio: '1:1'
                })
            );
        });

        it('generates at 4K resolution', async () => {
            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,abc123', prompt: 'test' }];
            vi.mocked(ImageGeneration.generateImages).mockResolvedValue(mockResults);

            await DirectorTools.generate_high_res_asset({
                prompt: 'Poster art',
                templateType: 'poster'
            });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    resolution: '4K'
                })
            );
        });

        it('uses 2:3 aspect ratio for non-cover templates', async () => {
            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,abc123', prompt: 'test' }];
            vi.mocked(ImageGeneration.generateImages).mockResolvedValue(mockResults);

            await DirectorTools.generate_high_res_asset({
                prompt: 'Poster art',
                templateType: 'poster'
            });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    aspectRatio: '2:3',
                    isCoverArt: false
                })
            );
        });
    });

    describe('batch_edit_images', () => {
        it('processes uploaded images with prompt', async () => {
            const uploads = [
                { id: 'up-1', url: 'data:image/png;base64,img1', type: 'image' },
                { id: 'up-2', url: 'data:image/png;base64,img2', type: 'image' }
            ];
            (useStore.getState as any).mockReturnValue(createMockStoreState({ uploadedImages: uploads }));

            const mockResults = [
                { id: 'ed-1', url: 'data:image/png;base64,edited1', prompt: 'edited' },
                { id: 'ed-2', url: 'data:image/png;base64,edited2', prompt: 'edited' }
            ];
            vi.mocked(Editing.batchEdit).mockResolvedValue(mockResults);

            const result = await DirectorTools.batch_edit_images({ prompt: 'Make it brighter' });

            expect(Editing.batchEdit).toHaveBeenCalledWith(
                expect.objectContaining({
                    images: expect.arrayContaining([
                        expect.objectContaining({ data: 'img1' }),
                        expect.objectContaining({ data: 'img2' })
                    ]),
                    prompt: 'Make it brighter'
                })
            );
            expect(result).toContain('Successfully edited 2 images');
        });

        it('returns error when no images uploaded', async () => {
            (useStore.getState as any).mockReturnValue(createMockStoreState({ uploadedImages: [] }));

            const result = await DirectorTools.batch_edit_images({ prompt: 'Edit' });

            expect(result).toContain('No images found');
        });
    });

    describe('render_cinematic_grid', () => {
        it('generates 16:9 aspect ratio grid', async () => {
            const mockResults = [{ id: 'grid-1', url: 'data:image/png;base64,grid', prompt: 'grid' }];
            vi.mocked(ImageGeneration.generateImages).mockResolvedValue(mockResults);

            await DirectorTools.render_cinematic_grid({ prompt: 'Action scene' });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    aspectRatio: '16:9',
                    resolution: '4K'
                })
            );
        });

        it('includes entity anchor as source image when set', async () => {
            const entityAnchor = { url: 'data:image/png;base64,anchor', id: 'anchor-1' };
            (useStore.getState as any).mockReturnValue(createMockStoreState({ entityAnchor }));

            const mockResults = [{ id: 'grid-1', url: 'data:image/png;base64,grid', prompt: 'grid' }];
            vi.mocked(ImageGeneration.generateImages).mockResolvedValue(mockResults);

            await DirectorTools.render_cinematic_grid({ prompt: 'Scene with character' });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceImages: [{ mimeType: 'image/png', data: 'anchor' }]
                })
            );
        });
    });

    describe('extract_grid_frame', () => {
        it('returns error when no grid image exists', async () => {
            (useStore.getState as any).mockReturnValue(createMockStoreState({ generatedHistory: [] }));

            const result = await DirectorTools.extract_grid_frame({ gridIndex: 0 });

            expect(result).toContain('No grid image found');
        });

        it('returns error for invalid grid index when grid exists', async () => {
            // Provide a mock grid image in history
            const mockHistory = [{
                id: 'grid-1',
                url: 'data:image/png;base64,mock',
                prompt: 'cinematic grid test',
                meta: 'cinematic_grid',
                type: 'image',
                timestamp: Date.now()
            }];
            (useStore.getState as any).mockReturnValue(createMockStoreState({ generatedHistory: mockHistory }));

            const result = await DirectorTools.extract_grid_frame({ gridIndex: 5 });

            expect(result).toContain('Invalid grid index');
        });
    });

    describe('set_entity_anchor', () => {
        it('validates base64 data URI format', async () => {
            const result = await DirectorTools.set_entity_anchor({ image: 'invalid-data' });

            expect(result).toContain('Invalid image data');
        });

        it('sets entity anchor and adds to history', async () => {
            const mockSetEntityAnchor = vi.fn();
            const mockAddToHistory = vi.fn();
            (useStore.getState as any).mockReturnValue(createMockStoreState({
                setEntityAnchor: mockSetEntityAnchor,
                addToHistory: mockAddToHistory
            }));

            const result = await DirectorTools.set_entity_anchor({
                image: 'data:image/png;base64,validdata'
            });

            expect(mockSetEntityAnchor).toHaveBeenCalled();
            expect(mockAddToHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'data:image/png;base64,validdata',
                    prompt: 'Entity Anchor (Global Reference)'
                })
            );
            expect(result).toContain('Entity Anchor set successfully');
        });
    });

    describe('run_showroom_mockup', () => {
        it('delegates to generate_image with product prompt', async () => {
            const mockResults = [{ id: 'img-1', url: 'data:image/png;base64,abc123', prompt: 'test' }];
            vi.mocked(ImageGeneration.generateImages).mockResolvedValue(mockResults);

            await DirectorTools.run_showroom_mockup({
                productType: 'vinyl record',
                scenePrompt: 'on a wooden shelf'
            });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: expect.stringContaining('vinyl record')
                })
            );
            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: expect.stringContaining('wooden shelf')
                })
            );
        });
    });
});
