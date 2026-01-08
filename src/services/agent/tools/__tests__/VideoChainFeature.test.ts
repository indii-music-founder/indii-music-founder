import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoTools } from '@/services/agent/tools/VideoTools';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useStore } from '@/core/store';

// Mock the VideoGenerationService
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateLongFormVideo: vi.fn(),
    }
}));

// Mock the Store
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

describe('VideoChainFeature (Hardened)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default store state
        (useStore.getState as any).mockReturnValue({
            addAgentMessage: vi.fn(),
            userProfile: { uid: 'test-user' },
            currentProjectId: 'test-project',
            addToHistory: vi.fn()
        });
    });

    it('should execute successfully with valid inputs', async () => {
        // Setup successful response
        const mockJobId = 'job-123';
        vi.mocked(VideoGeneration.generateLongFormVideo).mockResolvedValue([
            { id: mockJobId, url: '', prompt: 'valid prompt' }
        ]);

        const result = await VideoTools.generate_video_chain({
            prompt: 'A cinematic masterpiece',
            startImage: 'data:image/png;base64,validdata',
            totalDuration: 10
        });

        // Assert Success
        expect(result.success).toBe(true);
        expect(result.data.jobId).toBe(mockJobId);
        expect(VideoGeneration.generateLongFormVideo).toHaveBeenCalledWith(expect.objectContaining({
            totalDuration: 10
        }));
    });

    it('should reject non-positive duration (<= 0)', async () => {
        const result = await VideoTools.generate_video_chain({
            prompt: 'Invalid duration',
            startImage: 'data:image/png;base64,validdata',
            totalDuration: -5
        });

        // Expect Tool to fail gracefully BEFORE calling API
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/duration/i);
        expect(VideoGeneration.generateLongFormVideo).not.toHaveBeenCalled();
    });

    it('should reject duration that is too long (> 300s)', async () => {
        // Assuming a reasonable upper limit for the tool to prevent abuse/timeout
        const result = await VideoTools.generate_video_chain({
            prompt: 'Too long',
            startImage: 'data:image/png;base64,validdata',
            totalDuration: 1000
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/duration/i);
        expect(VideoGeneration.generateLongFormVideo).not.toHaveBeenCalled();
    });

    it('should reject empty prompts', async () => {
        const result = await VideoTools.generate_video_chain({
            prompt: '',
            startImage: 'data:image/png;base64,validdata',
            totalDuration: 10
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/prompt/i);
        expect(VideoGeneration.generateLongFormVideo).not.toHaveBeenCalled();
    });

    it('should reject invalid startImage format', async () => {
        const result = await VideoTools.generate_video_chain({
            prompt: 'Bad image',
            startImage: 'https://example.com/image.jpg', // Should be base64 data URI usually, based on other tools
            totalDuration: 10
        });

        // If the tool expects base64 specifically (like generate_motion_brush does), it should fail.
        // If it allows URLs, this test might need adjustment.
        // Based on `generate_motion_brush` implementation which checks regex, let's assume strictness for now or check what generateLongFormVideo expects.
        // `generateLongFormVideo` doc says `startImage` must be Base64 (from memory).

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/image/i);
        expect(VideoGeneration.generateLongFormVideo).not.toHaveBeenCalled();
    });
});
