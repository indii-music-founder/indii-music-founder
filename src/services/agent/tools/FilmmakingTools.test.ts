
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NarrativeTools } from './NarrativeTools';
import { ImageTools } from './ImageTools';
import { VideoTools } from './VideoTools';
import { AI } from '@/services/ai/AIService';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        generateVideo: vi.fn() // Only if called directly, but tools usually call VideoGenerationService
    }
}));

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

vi.mock('@/services/image/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn()
    }
}));

import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { VideoGeneration } from '@/services/image/VideoGenerationService';

describe('Filmmaking Grammar Tools', () => {

    // Setup Store Mock
    const mockSetEntityAnchor = vi.fn();
    const mockAddToHistory = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore.getState as any).mockReturnValue({
            currentProjectId: 'test-project',
            entityAnchor: null,
            setEntityAnchor: mockSetEntityAnchor,
            addToHistory: mockAddToHistory,
            studioControls: { resolution: '1080p', aspectRatio: '16:9' }
        });
    });

    describe('NarrativeTools', () => {
        it('generate_visual_script should return structured JSON', async () => {
            const mockResponse = {
                title: "Test Script",
                beats: [{ beat: 1, name: "Intro" }]
            };

            (AI.generateContent as any).mockResolvedValue({
                text: () => JSON.stringify(mockResponse)
            });

            const result = await NarrativeTools.generate_visual_script({ synopsis: "A test story" });
            expect(result).toContain("Test Script");
            expect(AI.generateContent).toHaveBeenCalled();
        });
    });

    describe('ImageTools', () => {
        it('render_cinematic_grid should include entity anchor if set', async () => {
            // Mock store with entity anchor
            (useStore.getState as any).mockReturnValue({
                currentProjectId: 'test-project',
                entityAnchor: { url: 'data:image/png;base64,mockanchordata' },
                addToHistory: mockAddToHistory
            });

            (ImageGeneration.generateImages as any).mockResolvedValue([{
                id: 'grid-1',
                url: 'http://grid-url'
            }]);

            await ImageTools.render_cinematic_grid({ prompt: "A forest scene" });

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(expect.objectContaining({
                sourceImages: [{ mimeType: 'image/png', data: 'mockanchordata' }],
                prompt: expect.stringContaining("Maintain strict character consistency")
            }));
        });

        it('set_entity_anchor should update store state', async () => {
            const result = await ImageTools.set_entity_anchor({ image: "data:image/png;base64,newdata" });

            expect(mockSetEntityAnchor).toHaveBeenCalledWith(expect.objectContaining({
                url: "data:image/png;base64,newdata",
                type: 'image'
            }));
            expect(result).toContain("Entity Anchor set successfully");
        });
    });

    describe('VideoTools', () => {
        it('interpolate_sequence should call generateVideo with first and last frames', async () => {
            (VideoGeneration.generateVideo as any).mockResolvedValue([{
                id: 'vid-1',
                url: 'http://video-url'
            }]);

            await VideoTools.interpolate_sequence({
                firstFrame: "data:image/png;base64,start",
                lastFrame: "data:image/png;base64,end"
            });

            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
                firstFrame: "data:image/png;base64,start",
                lastFrame: "data:image/png;base64,end"
            }));
        });
    });
});
