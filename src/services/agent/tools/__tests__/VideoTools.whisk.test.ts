import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoTools } from '../VideoTools';

// Mock dependencies
const mockAddAgentMessage = vi.fn();
const mockAddToHistory = vi.fn();
const mockUserProfile = { id: 'test-user', name: 'Test User' };

// Whisk Mock
const mockSynthesizeVideoPrompt = vi.fn();
const mockGetVideoParameters = vi.fn();

vi.mock('@/services/WhiskService', () => ({
    WhiskService: {
        synthesizeVideoPrompt: (...args: any[]) => mockSynthesizeVideoPrompt(...args),
        getVideoParameters: (...args: any[]) => mockGetVideoParameters(...args)
    }
}));

// Video Generation Mock
const mockGenerateVideo = vi.fn();
const mockWaitForJob = vi.fn();

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
        waitForJob: (...args: any[]) => mockWaitForJob(...args)
    }
}));

// Store Mock
const mockGetState = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockGetState()
    }
}));

describe('VideoTools - Whisk Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default Mock State with Whisk enabled
        mockGetState.mockReturnValue({
            userProfile: mockUserProfile,
            addAgentMessage: mockAddAgentMessage,
            currentProjectId: 'proj-whisk',
            addToHistory: mockAddToHistory,
            whiskState: {
                targetMedia: 'video',
                concept: 'A futuristic city',
                // Add other necessary whisk state properties if needed by the real code,
                // but based on VideoTools.ts usage, it just checks existence and targetMedia.
            }
        });

        // Default Whisk Service behavior
        mockSynthesizeVideoPrompt.mockReturnValue('Synthesized Prompt by Whisk');
        mockGetVideoParameters.mockResolvedValue({
            duration: 10,
            aspectRatio: '16:9'
        });

        // Default Video Gen behavior
        mockGenerateVideo.mockResolvedValue([
            { id: 'job-whisk-1', url: 'http://whisk.video/1.mp4', prompt: 'Synthesized Prompt by Whisk' }
        ]);
    });

    it('should use WhiskService to synthesize prompt and parameters when whiskState is active', async () => {
        const inputPrompt = 'Base prompt';

        const result = await VideoTools.generate_video({ prompt: inputPrompt });

        // Verify Whisk Service calls
        expect(mockSynthesizeVideoPrompt).toHaveBeenCalledWith(inputPrompt, expect.objectContaining({ targetMedia: 'video' }));
        expect(mockGetVideoParameters).toHaveBeenCalledWith(expect.objectContaining({ targetMedia: 'video' }));

        // Verify Video Generation uses synthesized values
        expect(mockGenerateVideo).toHaveBeenCalledWith({
            prompt: 'Synthesized Prompt by Whisk',
            firstFrame: undefined,
            duration: 10, // From Whisk
            aspectRatio: '16:9', // From Whisk
            resolution: undefined,
            userProfile: mockUserProfile
        });

        expect(result.success).toBe(true);
        // Note: The tool currently returns the original input prompt in the response,
        // even though it uses the synthesized prompt for generation.
        expect(result.data.prompt).toBe(inputPrompt);
    });

    it('should prefer explicit user arguments over Whisk presets (except prompt)', async () => {
        // Whisk returns defaults
        mockGetVideoParameters.mockResolvedValue({
            duration: 10,
            aspectRatio: '16:9'
        });

        // User provides explicit overrides
        const result = await VideoTools.generate_video({
            prompt: 'Base prompt',
            duration: 5,
            aspectRatio: '9:16'
        });

        // Verify Whisk Service calls (Prompt is still synthesized)
        expect(mockSynthesizeVideoPrompt).toHaveBeenCalled();

        // Verify Video Generation uses USER overrides for params
        expect(mockGenerateVideo).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'Synthesized Prompt by Whisk', // Still whisk synthesized
            duration: 5, // User override
            aspectRatio: '9:16' // User override
        }));

        expect(result.success).toBe(true);
    });

    it('should not use WhiskService if whiskState is missing', async () => {
        // Mock state WITHOUT whiskState
        mockGetState.mockReturnValue({
            userProfile: mockUserProfile,
            addAgentMessage: mockAddAgentMessage,
            currentProjectId: 'proj-no-whisk',
            addToHistory: mockAddToHistory,
            whiskState: undefined
        });

        const result = await VideoTools.generate_video({ prompt: 'Raw prompt' });

        expect(mockSynthesizeVideoPrompt).not.toHaveBeenCalled();
        expect(mockGetVideoParameters).not.toHaveBeenCalled();

        expect(mockGenerateVideo).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'Raw prompt',
            duration: undefined,
            aspectRatio: undefined
        }));

        expect(result.success).toBe(true);
    });

    it('should not use WhiskService if targetMedia is strictly "audio"', async () => {
         // Mock state with audio-only whiskState
         mockGetState.mockReturnValue({
            userProfile: mockUserProfile,
            addAgentMessage: mockAddAgentMessage,
            currentProjectId: 'proj-audio',
            addToHistory: mockAddToHistory,
            whiskState: {
                targetMedia: 'audio'
            }
        });

        await VideoTools.generate_video({ prompt: 'Raw prompt' });

        expect(mockSynthesizeVideoPrompt).not.toHaveBeenCalled();
    });
});
