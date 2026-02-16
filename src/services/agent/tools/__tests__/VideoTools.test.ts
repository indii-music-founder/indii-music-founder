import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoTools } from '../VideoTools';

// Mock dependencies
const mockAddAgentMessage = vi.fn();
const mockAddToHistory = vi.fn();
const mockUserProfile = { id: 'test-user', name: 'Test User' };
const mockUploadedImages = [
    { url: 'data:video/mp4;base64,vid1', type: 'video' },
    { url: 'data:video/mp4;base64,vid2', type: 'video' },
    { url: 'data:image/png;base64,img1', type: 'image' }
];

const mockGetState = vi.fn(() => ({
    userProfile: mockUserProfile,
    addAgentMessage: mockAddAgentMessage,
    currentProjectId: 'proj-123',
    addToHistory: mockAddToHistory,
    uploadedImages: mockUploadedImages
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => mockGetState()
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

const mockBatchEditVideo = vi.fn();
vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        batchEditVideo: (...args: any[]) => mockBatchEditVideo(...args)
    }
}));

const mockGenerateMotionBrush = vi.fn();
vi.mock('@/services/video/VideoService', () => ({
    Video: {
        generateMotionBrush: (...args: any[]) => mockGenerateMotionBrush(...args)
    }
}));

const mockExtractVideoFrame = vi.fn();
vi.mock('@/utils/video', () => ({
    extractVideoFrame: (...args: any[]) => mockExtractVideoFrame(...args)
}));

const mockUpdateKeyframe = vi.fn();
const mockAddKeyframe = vi.fn();
const mockProject = {
    clips: [{ id: 'clip-123' }]
};

vi.mock('@/modules/video/store/videoEditorStore', () => ({
    useVideoEditorStore: {
        getState: () => ({
            updateKeyframe: mockUpdateKeyframe,
            addKeyframe: mockAddKeyframe,
            project: mockProject
        })
    }
}));

describe('VideoTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset default state
        mockGetState.mockReturnValue({
            userProfile: mockUserProfile,
            addAgentMessage: mockAddAgentMessage,
            currentProjectId: 'proj-123',
            addToHistory: mockAddToHistory,
            uploadedImages: mockUploadedImages
        });
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

        it('should fail if prompt is empty', async () => {
            const result = await VideoTools.generate_video({ prompt: '   ' });
            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
            expect(mockGenerateVideo).not.toHaveBeenCalled();
        });

        it('should pass duration to service if provided', async () => {
            const mockJobId = 'job-video-duration';
            const mockUrl = 'https://example.com/video.mp4';

            mockGenerateVideo.mockResolvedValue([
                { id: mockJobId, url: mockUrl, prompt: 'duration prompt' }
            ]);

            const result = await VideoTools.generate_video({
                prompt: 'duration prompt',
                duration: 5
            });

            expect(mockGenerateVideo).toHaveBeenCalledWith(expect.objectContaining({
                prompt: 'duration prompt',
                duration: 5,
                userProfile: mockUserProfile
            }));

            expect(result.success).toBe(true);
        });

        it('should fail if duration is negative', async () => {
            const result = await VideoTools.generate_video({
                prompt: 'duration prompt',
                duration: -5
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
            expect(mockGenerateVideo).not.toHaveBeenCalled();
        });

        it('should fail if duration exceeds limit', async () => {
            const result = await VideoTools.generate_video({
                prompt: 'duration prompt',
                duration: 301
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
            expect(mockGenerateVideo).not.toHaveBeenCalled();
        });

        it('should fail if aspect ratio is invalid', async () => {
            const result = await VideoTools.generate_video({
                prompt: 'test prompt',
                aspectRatio: '21:9' // Invalid aspect ratio
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
            expect(result.error).toContain('Invalid aspect ratio');
            expect(mockGenerateVideo).not.toHaveBeenCalled();
        });

        it('should fail if resolution is invalid', async () => {
            const result = await VideoTools.generate_video({
                prompt: 'test prompt',
                resolution: '4096x2160' // Invalid resolution
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
            expect(result.error).toContain('Invalid resolution');
            expect(mockGenerateVideo).not.toHaveBeenCalled();
        });
    });

    describe('generate_motion_brush', () => {
        it('should generate motion brush video with valid inputs', async () => {
            const mockUrl = 'https://example.com/motion-brush.mp4';
            mockGenerateMotionBrush.mockResolvedValue(mockUrl);

            const args = {
                image: 'data:image/png;base64,validimage',
                mask: 'data:image/png;base64,validmask',
                prompt: 'Test Motion'
            };

            const result = await VideoTools.generate_motion_brush(args);

            expect(mockGenerateMotionBrush).toHaveBeenCalledWith(
                { mimeType: 'image/png', data: 'validimage' },
                { mimeType: 'image/png', data: 'validmask' }
            );
            expect(result.success).toBe(true);
            expect(result.data.url).toBe(mockUrl);
        });

        it('should fail with invalid base64 inputs', async () => {
            const args = {
                image: 'invalid-image',
                mask: 'data:image/png;base64,validmask'
            };

            const result = await VideoTools.generate_motion_brush(args);

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
            expect(mockGenerateMotionBrush).not.toHaveBeenCalled();
        });
    });

    describe('batch_edit_videos', () => {
        it('should batch edit videos with valid indices', async () => {
            const mockResults = [{ id: 'res-1', url: 'http://res.url', prompt: 'edit' }];
            mockBatchEditVideo.mockResolvedValue(mockResults);

            const args = {
                prompt: 'Add sparkles',
                videoIndices: [0] // Corresponds to first video in mockUploadedImages
            };

            const result = await VideoTools.batch_edit_videos(args);

            expect(mockBatchEditVideo).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.data.processedCount).toBe(1);
        });

        it('should fail if no videos found in uploads', async () => {
            // Override store mock for this test
            mockGetState.mockReturnValue({
                uploadedImages: [{ type: 'image' }], // No videos
                addAgentMessage: mockAddAgentMessage,
                addToHistory: mockAddToHistory,
                userProfile: mockUserProfile,
                currentProjectId: 'proj-123'
            } as any);

            const result = await VideoTools.batch_edit_videos({ prompt: 'test' });
            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('NOT_FOUND');
        });

        it('should fail if indices are invalid', async () => {
            // Reset store mock (handled in beforeEach, but being explicit doesn't hurt)
            mockGetState.mockReturnValue({
                uploadedImages: mockUploadedImages,
                addAgentMessage: mockAddAgentMessage,
                addToHistory: mockAddToHistory,
                currentProjectId: 'proj-123',
                userProfile: mockUserProfile
            } as any);

            const result = await VideoTools.batch_edit_videos({
                prompt: 'test',
                videoIndices: [99] // Invalid index
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INDEX');
        });
    });

    describe('extend_video', () => {
        it('should extend video start', async () => {
            const frameData = 'data:image/png;base64,frame';
            mockExtractVideoFrame.mockResolvedValue(frameData);
            mockGenerateVideo.mockResolvedValue([{ id: 'job-1', url: 'http://url' }]);

            const args = {
                videoUrl: 'http://video.url',
                prompt: 'extend',
                direction: 'start' as const
            };

            const result = await VideoTools.extend_video(args);

            expect(mockExtractVideoFrame).toHaveBeenCalledWith('http://video.url');
            expect(mockGenerateVideo).toHaveBeenCalledWith(expect.objectContaining({
                lastFrame: frameData,
                prompt: 'extend'
            }));
            expect(result.success).toBe(true);
        });

        it('should extend video end', async () => {
            const frameData = 'data:image/png;base64,frame';
            mockExtractVideoFrame.mockResolvedValue(frameData);
            mockGenerateVideo.mockResolvedValue([{ id: 'job-1', url: 'http://url' }]);

            const args = {
                videoUrl: 'http://video.url',
                prompt: 'extend',
                direction: 'end' as const
            };

            const result = await VideoTools.extend_video(args);

            expect(mockExtractVideoFrame).toHaveBeenCalledWith('http://video.url');
            expect(mockGenerateVideo).toHaveBeenCalledWith(expect.objectContaining({
                firstFrame: frameData,
                prompt: 'extend'
            }));
            expect(result.success).toBe(true);
        });

        it('should fail if frame extraction fails', async () => {
            mockExtractVideoFrame.mockResolvedValue(null);

            const args = {
                videoUrl: 'http://video.url',
                prompt: 'extend',
                direction: 'end' as const
            };

            const result = await VideoTools.extend_video(args);

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('EXTRACTION_FAILED');
        });
    });

    describe('update_keyframe', () => {
        it('should update keyframe for existing clip', async () => {
            const args = {
                clipId: 'clip-123',
                property: 'scale' as const,
                frame: 10,
                value: 1.5,
                easing: 'easeInOut' as const
            };

            const result = await VideoTools.update_keyframe(args);

            expect(mockAddKeyframe).toHaveBeenCalledWith('clip-123', 'scale', 10, 1.5);
            expect(mockUpdateKeyframe).toHaveBeenCalledWith('clip-123', 'scale', 10, { easing: 'easeInOut' });
            expect(result.success).toBe(true);
        });

        it('should fail if clip not found', async () => {
            const args = {
                clipId: 'invalid-clip',
                property: 'scale' as const,
                frame: 10,
                value: 1.5
            };

            const result = await VideoTools.update_keyframe(args);

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('NOT_FOUND');
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

        it('should fail if aspect ratio is invalid', async () => {
            const result = await VideoTools.generate_video_chain({
                ...validArgs,
                aspectRatio: '21:9' // Invalid aspect ratio
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');
            expect(result.error).toContain('Invalid aspect ratio');
            expect(mockGenerateLongFormVideo).not.toHaveBeenCalled();
        });

        it('should handle service failures gracefully', async () => {
            mockGenerateLongFormVideo.mockRejectedValue(new Error("API Connection Failed"));

            const result = await VideoTools.generate_video_chain(validArgs);

            expect(result.success).toBe(false);
            expect(result.error).toBe("API Connection Failed");
            expect(result.metadata?.errorCode).toBe("TOOL_EXECUTION_ERROR");
        });

        it('should return error if service returns empty list', async () => {
            mockGenerateLongFormVideo.mockResolvedValue([]);

            const result = await VideoTools.generate_video_chain(validArgs);

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('GENERATION_FAILED');
        });
    });

    describe('interpolate_sequence', () => {
        it('should interpolate sequence successfully', async () => {
            mockGenerateVideo.mockResolvedValue([{ id: 'job-int', url: 'http://url' }]);

            const args = {
                firstFrame: 'data:img',
                lastFrame: 'data:img2',
                prompt: 'morph'
            };

            const result = await VideoTools.interpolate_sequence(args);

            expect(mockGenerateVideo).toHaveBeenCalledWith(expect.objectContaining({
                firstFrame: args.firstFrame,
                lastFrame: args.lastFrame,
                prompt: 'morph'
            }));
            expect(result.success).toBe(true);
        });

        it('should use default prompt if not provided', async () => {
            mockGenerateVideo.mockResolvedValue([{ id: 'job-int', url: 'http://url' }]);

            const args = {
                firstFrame: 'data:img',
                lastFrame: 'data:img2'
            };

            const result = await VideoTools.interpolate_sequence(args);

            expect(mockGenerateVideo).toHaveBeenCalledWith(expect.objectContaining({
                prompt: "Smooth transition between frames"
            }));
            expect(result.success).toBe(true);
        });
    });
});
