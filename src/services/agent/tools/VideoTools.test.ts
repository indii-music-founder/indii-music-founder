import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoTools } from './VideoTools';

// Mock dependencies
const mockGenerateVideo = vi.fn();
const mockExtractVideoFrame = vi.fn();
const mockAddToHistory = vi.fn();
const mockAddKeyframe = vi.fn();
const mockUpdateKeyframe = vi.fn();
const mockGetState = vi.fn();
const mockGenerateLongFormVideo = vi.fn();

vi.mock('@/services/image/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: any[]) => mockGenerateVideo(...args),
        generateLongFormVideo: (...args: any[]) => mockGenerateLongFormVideo(...args)
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
        it('should call generateLongFormVideo with correct parameters', async () => {
            // Mock generateLongFormVideo which is now used by the tool
            mockGenerateLongFormVideo.mockResolvedValue([{ id: 'job-id', url: '', prompt: 'chain video' }]);

            const result = await VideoTools.generate_video_chain({
                startImage: 'data:image/png;base64,start',
                totalDuration: 9,
                prompt: 'chain video'
            });

            expect(mockGenerateLongFormVideo).toHaveBeenCalledWith({
                prompt: 'chain video',
                totalDuration: 9,
                startImage: 'data:image/png;base64,start',
                orgId: expect.any(String) // or specific mock value if orgId is mocked in store
            });

            expect(result).toContain('Long-form generation job started. Job ID: job-id');
        });
    });
});

