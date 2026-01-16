
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoTools } from '@/services/agent/tools/VideoTools';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { Editing } from '@/services/image/EditingService';
import { useStore } from '@/core/store';

// Mock Dependencies
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn(),
        waitForJob: vi.fn(),
        generateLongFormVideo: vi.fn()
    }
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        batchEditVideo: vi.fn()
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
            currentProjectId: mockCurrentProjectId,
            uploadedImages: [] // Default empty uploads
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

    describe('batch_edit_videos', () => {
        const validVideoData = "data:video/mp4;base64,AAAA";
        const mockVideo1 = { id: 'v1', type: 'video', url: validVideoData };
        const mockVideo2 = { id: 'v2', type: 'video', url: validVideoData };

        it('should execute successfully with valid input and uploads', async () => {
            // Setup store with videos
            (useStore.getState as any).mockReturnValue({
                userProfile: mockUserProfile,
                addToHistory: mockAddToHistory,
                addAgentMessage: mockAddAgentMessage,
                currentProjectId: mockCurrentProjectId,
                uploadedImages: [mockVideo1, mockVideo2]
            });

            const validArgs = { prompt: "Make it black and white", videoIndices: [0] };
            const mockResult = { id: 'res-1', url: 'http://edited.mp4', prompt: validArgs.prompt };

            (Editing.batchEditVideo as any).mockResolvedValue([mockResult]);

            const result = await VideoTools.batch_edit_videos(validArgs);

            expect(result.success).toBe(true);
            expect(result.data.processedCount).toBe(1);
            expect(Editing.batchEditVideo).toHaveBeenCalledWith(expect.objectContaining({
                prompt: validArgs.prompt,
                videos: expect.arrayContaining([expect.objectContaining({ mimeType: 'video/mp4' })])
            }));
            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                id: mockResult.id,
                url: mockResult.url
            }));
        });

        it('should return NOT_FOUND error if no videos uploaded', async () => {
            // Store has no videos (default in beforeEach)
             const result = await VideoTools.batch_edit_videos({ prompt: "edit" });

             expect(result.success).toBe(false);
             expect(result.metadata?.errorCode).toBe('NOT_FOUND');
             expect(Editing.batchEditVideo).not.toHaveBeenCalled();
        });

        it('should return INVALID_INDEX error for out of bounds indices', async () => {
            (useStore.getState as any).mockReturnValue({
                userProfile: mockUserProfile,
                uploadedImages: [mockVideo1], // Only 1 video (index 0)
                addToHistory: mockAddToHistory, // Need to mock these as they are destructured
                currentProjectId: mockCurrentProjectId
            });

            const result = await VideoTools.batch_edit_videos({ prompt: "edit", videoIndices: [99] });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INDEX');
            expect(Editing.batchEditVideo).not.toHaveBeenCalled();
        });

        it('should return PROCESSING_FAILED if video data is invalid', async () => {
            const invalidVideo = { id: 'v3', type: 'video', url: "http://external.com/video.mp4" }; // Not base64
             (useStore.getState as any).mockReturnValue({
                userProfile: mockUserProfile,
                uploadedImages: [invalidVideo],
                addToHistory: mockAddToHistory,
                currentProjectId: mockCurrentProjectId
            });

            const result = await VideoTools.batch_edit_videos({ prompt: "edit" });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('PROCESSING_FAILED');
            expect(Editing.batchEditVideo).not.toHaveBeenCalled();
        });

        it('should handle service returning no results', async () => {
             (useStore.getState as any).mockReturnValue({
                userProfile: mockUserProfile,
                uploadedImages: [mockVideo1],
                addToHistory: mockAddToHistory,
                currentProjectId: mockCurrentProjectId
            });

            (Editing.batchEditVideo as any).mockResolvedValue([]);

            const result = await VideoTools.batch_edit_videos({ prompt: "edit" });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('PROCESSING_FAILED');
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
