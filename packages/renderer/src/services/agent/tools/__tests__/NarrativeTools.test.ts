
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NarrativeTools } from '../NarrativeTools';
import { DirectorTools } from '../DirectorTools';
import { VideoTools } from '../VideoTools';
import { GenAI } from '@/services/ai/GenAI';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/services/ai/FirebaseAIService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock AI response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'Mock response' } }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseAIService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
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

import { GenAI } from '@/services/ai/GenAI';
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
            characterReferences: [],
            addCharacterReference: mockSetEntityAnchor,
            addToHistory: mockAddToHistory,
            studioControls: { resolution: '1080p', aspectRatio: '16:9' },
            isSidebarOpen: true,
            activeModule: 'filmmaking',
            sidebarView: 'tools',
            isCommandBarOpen: false,
            isSettingsOpen: false,
            isProfileOpen: false,
            isNotificationsOpen: false,
        } as unknown as ReturnType<typeof useStore.getState>);
    });

    describe('NarrativeTools', () => {
        it('generate_visual_script should return structured JSON within ToolFunctionResult', async () => {
            const mockResponse = {
                title: "Test Script",
                beats: [{ beat: 1, name: "Intro" }]
            };

            vi.mocked(GenAI.generateStructuredData).mockResolvedValueOnce(mockResponse);

            const result = await NarrativeTools.generate_visual_script({ synopsis: "A test story" });

            expect(result.success).toBe(true);
            expect(result.message).toContain("Test Script");
            expect(result.data.title).toBe("Test Script");
        });
    });

    describe('Image/DirectorTools', () => {
        it('render_cinematic_grid should include entity anchor and return ToolFunctionResult', async () => {
            // Mock store with entity anchor
            vi.mocked(useStore.getState).mockReturnValue({
                currentProjectId: 'test-project',
                characterReferences: [{ image: { url: 'data:image/png;base64,mockanchordata', id: 'mock', type: 'image' }, referenceType: 'subject' }],
                addToHistory: mockAddToHistory,
                isSidebarOpen: true,
                activeModule: 'filmmaking',
                sidebarView: 'tools',
                isCommandBarOpen: false,
                isSettingsOpen: false,
                isProfileOpen: false,
                isNotificationsOpen: false,
            } as unknown as ReturnType<typeof useStore.getState>);

            vi.mocked(ImageGeneration.generateImages).mockResolvedValue([{
                id: 'grid-1',
                url: 'data:image/png;base64,gridurl'
            }] as Awaited<ReturnType<typeof ImageGeneration.generateImages>>);

            const result = await DirectorTools.render_cinematic_grid!({ prompt: "A forest scene" });

            expect(result.success).toBe(true);
            expect(result.message).toContain("Cinematic grid generated");

            expect(ImageGeneration.generateImages).toHaveBeenCalledWith(expect.objectContaining({
                sourceImages: [{ mimeType: 'image/png', data: 'mockanchordata' }],
                prompt: expect.stringContaining("2x2 cinematic grid")
            }));
        });

        it('add_character_reference should update store state and return ToolFunctionResult', async () => {
            const result = await DirectorTools.add_character_reference!({ image: "data:image/png;base64,newdata" });

            expect(mockSetEntityAnchor).toHaveBeenCalledWith(expect.objectContaining({
                image: expect.objectContaining({
                    url: "data:image/png;base64,newdata",
                    type: 'image'
                }),
                referenceType: 'subject'
            }));

            expect(result.success).toBe(true);
            expect(result.message).toContain("Entity Anchor (Character Reference) set successfully");
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
