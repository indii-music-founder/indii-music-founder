import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoTools } from '../VideoTools';

// Mock dependencies
const mockAddAgentMessage = vi.fn();
const mockUserProfile = { id: 'test-user', name: 'Test User' };

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            userProfile: mockUserProfile,
            addAgentMessage: mockAddAgentMessage,
            currentProjectId: 'proj-123',
            addToHistory: vi.fn(),
            uploadedImages: []
        })
    }
}));

const mockGenerateLongFormVideo = vi.fn();
const mockGenerateVideo = vi.fn();
const mockWaitForJob = vi.fn();

vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateLongFormVideo: (...args: any[]) => mockGenerateLongFormVideo(...args),
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
        waitForJob: (...args: any[]) => mockWaitForJob(...args)
    }
}));

describe('VideoTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generate_video', () => {
        it('should successfully trigger video generation', async () => {
            const mockJobId = 'job-video-123';
            const mockUrl = 'https://example.com/video.mp4';

            mockGenerateVideo.mockResolvedValue([
                { id: mockJobId, url: mockUrl, prompt: 'test prompt' }
            ]);

            const result = await VideoTools.generate_video({ prompt: 'test prompt' });

            expect(mockGenerateVideo).toHaveBeenCalledWith({
                prompt: 'test prompt',
                firstFrame: undefined,
                userProfile: mockUserProfile
            });

            expect(result.success).toBe(true);
            expect(result.data).toEqual({
                id: mockJobId,
                url: mockUrl,
                prompt: 'test prompt'
            });
        });

        it('should wait for job if URL is missing', async () => {
            const mockJobId = 'job-video-async';
            const finalUrl = 'https://example.com/final.mp4';

            mockGenerateVideo.mockResolvedValue([
                { id: mockJobId, url: undefined, prompt: 'async prompt' }
            ]);
            mockWaitForJob.mockResolvedValue({ videoUrl: finalUrl });

            const result = await VideoTools.generate_video({ prompt: 'async prompt' });

            expect(mockWaitForJob).toHaveBeenCalledWith(mockJobId);
            expect(result.success).toBe(true);
            expect(result.data.url).toBe(finalUrl);
        });
    });

    describe('generate_video_chain', () => {
        const validArgs = {
            prompt: 'A cyberpunk city',
            startImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            totalDuration: 60
        };

        it('should successfully trigger long-form video generation with valid arguments', async () => {
            const mockJobId = 'job-long-123';
            // Mock service response: Array of segments
            mockGenerateLongFormVideo.mockResolvedValue([
                { id: mockJobId, url: 'gs://test/video.mp4', prompt: 'segment 1' }
            ]);

            const result = await VideoTools.generate_video_chain(validArgs);

            // Verify Service Call
            expect(mockGenerateLongFormVideo).toHaveBeenCalledWith({
                prompt: validArgs.prompt,
                totalDuration: validArgs.totalDuration,
                firstFrame: validArgs.startImage,
                userProfile: mockUserProfile
            });

            // Verify Output Schema
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ jobId: mockJobId });
            expect(result.message).toContain(mockJobId);

            // Verify System Message (UI Feedback)
            expect(mockAddAgentMessage).toHaveBeenCalledWith(expect.objectContaining({
                role: 'system',
                text: expect.stringContaining(`Queuing long-form background job for ${validArgs.totalDuration}s`)
            }));
        });

        it('should fail if prompt is empty', async () => {
            const result = await VideoTools.generate_video_chain({ ...validArgs, prompt: '' });
            expect(result.success).toBe(false);
            expect(result.error).toBe("Prompt cannot be empty.");
            expect(result.metadata?.errorCode).toBe("INVALID_INPUT");
            expect(mockGenerateLongFormVideo).not.toHaveBeenCalled();
        });

        it('should fail if duration is zero or negative', async () => {
            const result = await VideoTools.generate_video_chain({ ...validArgs, totalDuration: 0 });
            expect(result.success).toBe(false);
            expect(result.error).toBe("Duration must be a positive number.");
            expect(result.metadata?.errorCode).toBe("INVALID_INPUT");
            expect(mockGenerateLongFormVideo).not.toHaveBeenCalled();
        });

        it('should fail if duration exceeds 300 seconds', async () => {
            const result = await VideoTools.generate_video_chain({ ...validArgs, totalDuration: 301 });
            expect(result.success).toBe(false);
            expect(result.error).toContain("Duration cannot exceed 300 seconds");
            expect(result.metadata?.errorCode).toBe("INVALID_INPUT");
            expect(mockGenerateLongFormVideo).not.toHaveBeenCalled();
        });

        it('should fail if startImage is not a valid base64 data URI', async () => {
            const result = await VideoTools.generate_video_chain({ ...validArgs, startImage: 'https://example.com/image.png' });
            expect(result.success).toBe(false);
            expect(result.error).toContain("Must be a base64 data URI");
            expect(result.metadata?.errorCode).toBe("INVALID_INPUT");
            expect(mockGenerateLongFormVideo).not.toHaveBeenCalled();
        });

        it('should handle service failures gracefully', async () => {
            mockGenerateLongFormVideo.mockRejectedValue(new Error("API Connection Failed"));

            const result = await VideoTools.generate_video_chain(validArgs);

            expect(result.success).toBe(false);
            expect(result.error).toBe("API Connection Failed");
            expect(result.metadata?.errorCode).toBe("TOOL_EXECUTION_ERROR");
        });

        it('should return undefined jobId if service returns empty list', async () => {
            mockGenerateLongFormVideo.mockResolvedValue([]);

            const result = await VideoTools.generate_video_chain(validArgs);

            expect(result.success).toBe(true);
            expect(result.data.jobId).toBeUndefined();
        });
    });
});
