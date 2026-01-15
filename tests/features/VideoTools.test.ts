
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoTools } from '@/services/agent/tools/VideoTools';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useStore } from '@/core/store';

// Mock Dependencies
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn(),
        waitForJob: vi.fn(),
        generateLongFormVideo: vi.fn()
    }
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

describe('VideoTools Feature', () => {
    const mockAddToHistory = vi.fn();
    const mockAddAgentMessage = vi.fn();
    const mockUserProfile = { id: 'test-user' };
    const mockCurrentProjectId = 'test-project';

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default store state
        (useStore.getState as any).mockReturnValue({
            userProfile: mockUserProfile,
            addToHistory: mockAddToHistory,
            addAgentMessage: mockAddAgentMessage,
            currentProjectId: mockCurrentProjectId
        });
    });

    describe('generate_video', () => {
        it('should execute successfully with valid input', async () => {
            const validArgs = { prompt: "A cinematic sunset", duration: 5 };
            const mockJob = { id: 'job-123', url: 'https://example.com/video.mp4' };

            (VideoGeneration.generateVideo as any).mockResolvedValue([mockJob]);

            const result = await VideoTools.generate_video(validArgs);

            expect(result.success).toBe(true);
            expect(result.data.url).toBe(mockJob.url);
            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith({
                prompt: validArgs.prompt,
                firstFrame: undefined,
                duration: validArgs.duration,
                userProfile: mockUserProfile
            });
            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                id: mockJob.id,
                url: mockJob.url,
                projectId: mockCurrentProjectId
            }));
        });

        it('should handle async job completion (wait for URL)', async () => {
            const validArgs = { prompt: "Async video" };
            const initialJob = { id: 'job-async', url: undefined };
            const completedJob = { id: 'job-async', videoUrl: 'https://example.com/delayed.mp4' };

            (VideoGeneration.generateVideo as any).mockResolvedValue([initialJob]);
            (VideoGeneration.waitForJob as any).mockResolvedValue(completedJob);

            const result = await VideoTools.generate_video(validArgs);

            expect(result.success).toBe(true);
            expect(result.data.url).toBe(completedJob.videoUrl);
            expect(VideoGeneration.waitForJob).toHaveBeenCalledWith(initialJob.id);
        });

        it('should return error for empty prompt', async () => {
            const invalidArgs = { prompt: "   " };

            const result = await VideoTools.generate_video(invalidArgs);

            expect(result.success).toBe(false);
            expect(result.error).toContain("Prompt cannot be empty");
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
            expect(VideoGeneration.generateVideo).not.toHaveBeenCalled();
        });

        it('should return error for negative duration', async () => {
            const invalidArgs = { prompt: "Test", duration: -5 };

            const result = await VideoTools.generate_video(invalidArgs);

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
        });

        it('should return error for duration > 300', async () => {
            const invalidArgs = { prompt: "Test", duration: 301 };

            const result = await VideoTools.generate_video(invalidArgs);

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
        });

        it('should handle service failure (no results)', async () => {
            (VideoGeneration.generateVideo as any).mockResolvedValue([]);

            const result = await VideoTools.generate_video({ prompt: "Fail me" });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('GENERATION_FAILED');
        });

        it('should handle exception during execution', async () => {
             (VideoGeneration.generateVideo as any).mockRejectedValue(new Error("API Down"));

             const result = await VideoTools.generate_video({ prompt: "Crash test" });

             expect(result.success).toBe(false);
             expect(result.error).toBe("API Down");
             expect(result.metadata?.errorCode).toBe('TOOL_EXECUTION_ERROR');
        });
    });

    describe('generate_video_chain', () => {
        const validBase64 = "data:image/png;base64,ABC";

        it('should execute successfully with valid input', async () => {
            const validArgs = { prompt: "Chain reaction", startImage: validBase64, totalDuration: 60 };
            const mockJob = { id: 'chain-job-1' };

            (VideoGeneration.generateLongFormVideo as any).mockResolvedValue([mockJob]);

            const result = await VideoTools.generate_video_chain(validArgs);

            expect(result.success).toBe(true);
            expect(result.data.jobId).toBe(mockJob.id);
            expect(mockAddAgentMessage).toHaveBeenCalled(); // Should notify user of queue
            expect(VideoGeneration.generateLongFormVideo).toHaveBeenCalledWith({
                prompt: validArgs.prompt,
                totalDuration: validArgs.totalDuration,
                firstFrame: validBase64,
                userProfile: mockUserProfile
            });
        });

        it('should fail with invalid base64 image', async () => {
            const invalidArgs = { prompt: "Chain", startImage: "not-base64", totalDuration: 10 };

            const result = await VideoTools.generate_video_chain(invalidArgs);

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
            expect(VideoGeneration.generateLongFormVideo).not.toHaveBeenCalled();
        });

         it('should fail with excessive duration', async () => {
            const invalidArgs = { prompt: "Chain", startImage: validBase64, totalDuration: 600 };

            const result = await VideoTools.generate_video_chain(invalidArgs);

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
        });
    });
});
