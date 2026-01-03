
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NarrativeTools } from './NarrativeTools';
import { ImageTools } from './ImageTools';
import { VideoTools } from './VideoTools';
import { AI } from '@/services/ai/AIService';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateStructuredData: vi.fn(),
        generateText: vi.fn(),
        analyzeImage: vi.fn()
    }
}));

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn(),
        generateVideo: vi.fn()
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

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn()
    }
}));

import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';

describe('Filmmaking Grammar Tools', () => {

    // Setup Store Mock
    const mockSetEntityAnchor = vi.fn();
    const mockAddToHistory = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useStore.getState).mockReturnValue({
            currentProjectId: 'test-project',
            entityAnchor: null,
            setEntityAnchor: mockSetEntityAnchor,
            addToHistory: mockAddToHistory,
            studioControls: { resolution: '1080p', aspectRatio: '16:9' },
            isSidebarOpen: true,
            activeModule: 'filmmaking',
            sidebarView: 'tools',
            isCommandBarOpen: false,
            isSettingsOpen: false,
            isProfileOpen: false,
            isNotificationsOpen: false,
        } as any);
    });

    describe('NarrativeTools', () => {
        it('generate_visual_script should return structured JSON', async () => {
            const mockResponse = {
                title: "Test Script",
                beats: [{ beat: 1, name: "Intro" }]
            };

            vi.mocked(firebaseAI.generateStructuredData).mockResolvedValue(mockResponse);

            const result = await NarrativeTools.generate_visual_script({ synopsis: "A test story" });
            expect(result).toContain("Test Script");
            expect(firebaseAI.generateStructuredData).toHaveBeenCalled();
        });
    });

    describe('ImageTools', () => {
        it('render_cinematic_grid should include entity anchor if set', async () => {
            // Mock store with entity anchor
            vi.mocked(useStore.getState).mockReturnValue({
                currentProjectId: 'test-project',
                entityAnchor: { url: 'data:image/png;base64,mockanchordata' },
                addToHistory: mockAddToHistory,
                isSidebarOpen: true,
                activeModule: 'filmmaking',
                sidebarView: 'tools',
                isCommandBarOpen: false,
                isSettingsOpen: false,
                isProfileOpen: false,
                isNotificationsOpen: false,
            } as any);

            vi.mocked(ImageGeneration.generateImages).mockResolvedValue([{
                id: 'grid-1',
                url: 'http://grid-url'
            }] as Awaited<ReturnType<typeof ImageGeneration.generateImages>>);

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
            vi.mocked(VideoGeneration.generateVideo).mockResolvedValue([{
                id: 'vid-1',
                url: 'http://video-url'
            }] as Awaited<ReturnType<typeof VideoGeneration.generateVideo>>);

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
