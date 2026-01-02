import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoTools } from './VideoTools';

// Mock dependencies
const mockGenerateVideo = vi.fn();
const mockExtractVideoFrame = vi.fn();
const mockAddToHistory = vi.fn();
const mockAddKeyframe = vi.fn();
const mockUpdateKeyframe = vi.fn();
const mockGetState = vi.fn();

vi.mock('@/services/image/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args)
    }
}));

vi.mock('@/utils/video', () => ({
    extractVideoFrame: (...args: any[]) => mockExtractVideoFrame(...args)
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            addToHistory: mockAddToHistory,
            addAgentMessage: vi.fn(), // Added missing mock
            currentProjectId: 'test-project-id'
        })
    }
}));

vi.mock('@/modules/video/store/videoEditorStore', () => ({
    useVideoEditorStore: {
        getState: () => mockGetState()
    }
}));

describe('VideoTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetState.mockReturnValue({
            addKeyframe: mockAddKeyframe,
            updateKeyframe: mockUpdateKeyframe,
            project: {
                clips: [
                    { id: 'clip-1', type: 'video', startFrame: 0, durationInFrames: 100 }
                ]
            }
        });
    });

    describe('extend_video', () => {
        it('should extract frame and call generateVideo with correct options for start direction', async () => {
            mockExtractVideoFrame.mockResolvedValue('data:image/png;base64,frame-data');
            mockGenerateVideo.mockResolvedValue([{ url: 'http://new-video.mp4' }]);

            const result = await VideoTools.extend_video({
                videoUrl: 'http://original.mp4',
                prompt: 'extend this',
                direction: 'start'
            });

            expect(mockExtractVideoFrame).toHaveBeenCalledWith('http://original.mp4');
            expect(mockGenerateVideo).toHaveBeenCalledWith({
                prompt: 'extend this',
                lastFrame: 'data:image/png;base64,frame-data'
            });
            expect(result).toContain('Video extended successfully');
        });

        it('should extract frame and call generateVideo with correct options for end direction', async () => {
            mockExtractVideoFrame.mockResolvedValue('data:image/png;base64,frame-data');
            mockGenerateVideo.mockResolvedValue([{ url: 'http://new-video.mp4' }]);

            const result = await VideoTools.extend_video({
                videoUrl: 'http://original.mp4',
                prompt: 'extend this',
                direction: 'end'
            });

            expect(mockGenerateVideo).toHaveBeenCalledWith({
                prompt: 'extend this',
                firstFrame: 'data:image/png;base64,frame-data'
            });
        });

        it('should return error if frame extraction fails', async () => {
            mockExtractVideoFrame.mockResolvedValue(null);

            const result = await VideoTools.extend_video({
                videoUrl: 'http://original.mp4',
                prompt: 'extend this',
                direction: 'start'
            });

            expect(result).toBe('Failed to extract frame from the provided video URL.');
        });
    });

    describe('update_keyframe', () => {
        it('should add keyframe and update easing', async () => {
            const result = await VideoTools.update_keyframe({
                clipId: 'clip-1',
                property: 'scale',
                frame: 10,
                value: 1.5,
                easing: 'easeIn'
            });

            expect(mockAddKeyframe).toHaveBeenCalledWith('clip-1', 'scale', 10, 1.5);
            expect(mockUpdateKeyframe).toHaveBeenCalledWith('clip-1', 'scale', 10, { easing: 'easeIn' });
            expect(result).toContain('Keyframe updated');
        });

        it('should return error if clip not found', async () => {
            const result = await VideoTools.update_keyframe({
                clipId: 'non-existent',
                property: 'scale',
                frame: 10,
                value: 1.5
            });

            expect(result).toBe('Clip with ID non-existent not found.');
        });
    });

    describe('generate_video_chain', () => {
        it('should chain overlapping video generation steps', async () => {
            // Mock sequence:
            // 1. Generate segment 1 (8s)
            mockGenerateVideo.mockResolvedValueOnce([{ url: 'http://segment1.mp4' }]);
            mockExtractVideoFrame.mockResolvedValueOnce('data:image/png;base64,frame1');

            // 2. Generate segment 2 (8s) using frame1
            mockGenerateVideo.mockResolvedValueOnce([{ url: 'http://segment2.mp4' }]);
            mockExtractVideoFrame.mockResolvedValueOnce('data:image/png;base64,frame2');

            // We request 16s total.
            // Loop 1: duration < 16. Current time 0. Gen 8s. New time 8.
            // Loop 2: duration < 16. Current time 8. Gen 8s. New time 16.
            // Stop.

            const result = await VideoTools.generate_video_chain({
                startImage: 'data:image/png;base64,start',
                totalDuration: 9, // < 10 (2 * 5s)
                prompt: 'chain video'
            });

            expect(mockGenerateVideo).toHaveBeenCalledTimes(2);

            // First call uses start image
            expect(mockGenerateVideo).toHaveBeenNthCalledWith(1, {
                firstFrame: 'data:image/png;base64,start',
                prompt: 'chain video'
            });

            // Second call uses extracted frame from segment 1
            expect(mockGenerateVideo).toHaveBeenNthCalledWith(2, {
                firstFrame: 'data:image/png;base64,frame1',
                prompt: 'chain video (Part 2, continuation)'
            });

            expect(result).toContain('Generated 2 segments');
        });
    });
});

