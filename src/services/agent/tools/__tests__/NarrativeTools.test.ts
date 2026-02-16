
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NarrativeTools } from '../NarrativeTools';
import { DirectorTools } from '../DirectorTools';
import { VideoTools } from '../VideoTools';
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
        it('generate_visual_script should return structured JSON within ToolFunctionResult', async () => {
            const mockResponse = {
                title: "Test Script",
                beats: [{ beat: 1, name: "Intro" }]
            };

            vi.mocked(firebaseAI.generateStructuredData).mockResolvedValue(mockResponse);

            const result = await NarrativeTools.generate_visual_script({ synopsis: "A test story" });

            expect(result.success).toBe(true);
            expect(result.message).toContain("Test Script");
            expect(result.data.title).toBe("Test Script");
            expect(firebaseAI.generateStructuredData).toHaveBeenCalled();
        });
    });

    describe('Image/DirectorTools', () => {
        it('render_cinematic_grid should include entity anchor and return ToolFunctionResult', async () => {
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
                url: 'data:image/png;base64,gridurl'
            }] as Awaited<ReturnType<typeof ImageGeneration.generateImages>>);

            const result = await DirectorTools.render_cinematic_grid({ prompt: "A forest scene" });

            expect(result.success).toBe(true);
            expect(result.message).toContain("Cinematic grid generated");

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(expect.objectContaining({
                sourceImages: [{ mimeType: 'image/png', data: 'mockanchordata' }],
                prompt: expect.stringContaining("Maintain strict character consistency")
            }));
        });

        it('set_entity_anchor should update store state and return ToolFunctionResult', async () => {
            const result = await DirectorTools.set_entity_anchor({ image: "data:image/png;base64,newdata" });

            expect(mockSetEntityAnchor).toHaveBeenCalledWith(expect.objectContaining({
                url: "data:image/png;base64,newdata",
                type: 'image'
            }));

            expect(result.success).toBe(true);
            expect(result.message).toContain("Entity Anchor set successfully");
        });
    });

    describe('VideoTools', () => {
        it('interpolate_sequence should call generateVideo and return ToolFunctionResult', async () => {
            vi.mocked(VideoGeneration.generateVideo).mockResolvedValue([{
                id: 'vid-1',
                url: 'http://video-url'
            }] as Awaited<ReturnType<typeof VideoGeneration.generateVideo>>);

            const result = await VideoTools.interpolate_sequence({
                firstFrame: "data:image/png;base64,start",
                lastFrame: "data:image/png;base64,end"
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain("Sequence interpolated successfully");

            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(expect.objectContaining({
                firstFrame: "data:image/png;base64,start",
                lastFrame: "data:image/png;base64,end"
            }));
        });
    });
});
