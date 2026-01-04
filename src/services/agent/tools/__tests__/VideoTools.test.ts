import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VideoTools } from '../VideoTools';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { Editing } from '@/services/image/EditingService';
import { useStore } from '@/core/store';

// Mock dependencies
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: vi.fn(),
        generateLongFormVideo: vi.fn(),
        waitForJob: vi.fn()
    }
}));

vi.mock('@/services/video/VideoService', () => ({
    Video: {
        generateMotionBrush: vi.fn()
    }
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        batchEditVideo: vi.fn()
    }
}));

vi.mock('@/utils/video', () => ({
    extractVideoFrame: vi.fn()
}));

vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

vi.mock('@/modules/video/store/videoEditorStore', () => ({
    useVideoEditorStore: {
        getState: vi.fn()
    }
}));

// Default mock store state
const createMockStoreState = (overrides = {}) => ({
    addToHistory: vi.fn(),
    addAgentMessage: vi.fn(),
    currentProjectId: 'test-project',
    userProfile: {
        uid: 'test-user',
        email: 'test@example.com',
        brandKit: {
            socials: { distributor: 'distrokid' }
        }
    },
    uploadedImages: [],
    ...overrides
});

describe('VideoTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useStore.getState as any).mockReturnValue(createMockStoreState());
    });

    describe('generate_video', () => {
        it('passes userProfile to VideoGenerationService', async () => {
            const mockResults = [{ id: 'vid-1', url: 'https://example.com/video.mp4', prompt: 'test' }];
            vi.mocked(VideoGeneration.generateVideo).mockResolvedValue(mockResults);

            await VideoTools.generate_video({ prompt: 'A beautiful sunset' });

            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    userProfile: expect.objectContaining({ uid: 'test-user' })
                })
            );
        });

        it('waits for job completion when URL is empty', async () => {
            const mockResults = [{ id: 'vid-1', url: '', prompt: 'test' }];
            vi.mocked(VideoGeneration.generateVideo).mockResolvedValue(mockResults);
            vi.mocked(VideoGeneration.waitForJob).mockResolvedValue({
                videoUrl: 'https://example.com/completed.mp4'
            });

            const result = await VideoTools.generate_video({ prompt: 'A scene' });

            expect(VideoGeneration.waitForJob).toHaveBeenCalledWith('vid-1');
            expect(result).toContain('https://example.com/completed.mp4');
        });

        it('adds result to history', async () => {
            const mockAddToHistory = vi.fn();
            (useStore.getState as any).mockReturnValue(createMockStoreState({ addToHistory: mockAddToHistory }));

            const mockResults = [{ id: 'vid-1', url: 'https://example.com/video.mp4', prompt: 'test' }];
            vi.mocked(VideoGeneration.generateVideo).mockResolvedValue(mockResults);

            await VideoTools.generate_video({ prompt: 'A sunset' });

            expect(mockAddToHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'vid-1',
                    type: 'video',
                    projectId: 'test-project'
                })
            );
        });

        it('returns error message on failure', async () => {
            vi.mocked(VideoGeneration.generateVideo).mockRejectedValue(new Error('API Error'));

            await expect(VideoTools.generate_video({ prompt: 'test' })).rejects.toThrow('Video generation failed');
        });
    });

    describe('generate_motion_brush', () => {
        it('validates base64 data URIs for image and mask', async () => {
            const result = await VideoTools.generate_motion_brush({
                image: 'invalid-data',
                mask: 'invalid-mask'
            });

            expect(result).toContain('Invalid image or mask data');
        });

        it('returns success message on valid input', async () => {
            const { Video } = await import('@/services/video/VideoService');
            vi.mocked(Video.generateMotionBrush).mockResolvedValue('https://example.com/motion.mp4');

            const result = await VideoTools.generate_motion_brush({
                image: 'data:image/png;base64,imgdata',
                mask: 'data:image/png;base64,maskdata',
                prompt: 'Animate the water'
            });

            expect(result).toContain('Motion Brush video generated successfully');
        });
    });

    describe('generate_video_chain', () => {
        it('passes userProfile to long-form generation', async () => {
            const mockResults = [{ id: 'long-1', url: '', prompt: 'test' }];
            vi.mocked(VideoGeneration.generateLongFormVideo).mockResolvedValue(mockResults);

            await VideoTools.generate_video_chain({
                prompt: 'An epic journey',
                startImage: 'data:image/png;base64,startframe',
                totalDuration: 30
            });

            expect(VideoGeneration.generateLongFormVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    userProfile: expect.objectContaining({ uid: 'test-user' }),
                    totalDuration: 30,
                    firstFrame: 'data:image/png;base64,startframe'
                })
            );
        });

        it('returns job ID for tracking', async () => {
            const mockResults = [{ id: 'long-job-123', url: '', prompt: 'test' }];
            vi.mocked(VideoGeneration.generateLongFormVideo).mockResolvedValue(mockResults);

            const result = await VideoTools.generate_video_chain({
                prompt: 'Long video',
                startImage: 'data:image/png;base64,start',
                totalDuration: 60
            });

            expect(result).toContain('long-job-123');
            expect(result).toContain('Long-form generation job started');
        });
    });

    describe('extend_video', () => {
        it('extracts frame and sets as firstFrame for end extension', async () => {
            const { extractVideoFrame } = await import('@/utils/video');
            vi.mocked(extractVideoFrame).mockResolvedValue('data:image/png;base64,extracted');

            const mockResults = [{ id: 'ext-1', url: 'https://example.com/extended.mp4', prompt: 'test' }];
            vi.mocked(VideoGeneration.generateVideo).mockResolvedValue(mockResults);

            await VideoTools.extend_video({
                videoUrl: 'https://example.com/original.mp4',
                prompt: 'Continue the scene',
                direction: 'end'
            });

            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    firstFrame: 'data:image/png;base64,extracted'
                })
            );
        });

        it('extracts frame and sets as lastFrame for start extension', async () => {
            const { extractVideoFrame } = await import('@/utils/video');
            vi.mocked(extractVideoFrame).mockResolvedValue('data:image/png;base64,extracted');

            const mockResults = [{ id: 'ext-1', url: 'https://example.com/extended.mp4', prompt: 'test' }];
            vi.mocked(VideoGeneration.generateVideo).mockResolvedValue(mockResults);

            await VideoTools.extend_video({
                videoUrl: 'https://example.com/original.mp4',
                prompt: 'Add prequel',
                direction: 'start'
            });

            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    lastFrame: 'data:image/png;base64,extracted'
                })
            );
        });

        it('passes userProfile for distributor context', async () => {
            const { extractVideoFrame } = await import('@/utils/video');
            vi.mocked(extractVideoFrame).mockResolvedValue('data:image/png;base64,frame');

            const mockResults = [{ id: 'ext-1', url: 'https://example.com/extended.mp4', prompt: 'test' }];
            vi.mocked(VideoGeneration.generateVideo).mockResolvedValue(mockResults);

            await VideoTools.extend_video({
                videoUrl: 'https://example.com/video.mp4',
                prompt: 'Extend',
                direction: 'end'
            });

            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    userProfile: expect.objectContaining({ uid: 'test-user' })
                })
            );
        });

        it('returns error when frame extraction fails', async () => {
            const { extractVideoFrame } = await import('@/utils/video');
            vi.mocked(extractVideoFrame).mockResolvedValue(null);

            const result = await VideoTools.extend_video({
                videoUrl: 'https://example.com/video.mp4',
                prompt: 'Extend',
                direction: 'end'
            });

            expect(result).toContain('Failed to extract frame');
        });
    });

    describe('batch_edit_videos', () => {
        it('processes uploaded videos with prompt', async () => {
            const uploads = [
                { id: 'vid-1', url: 'data:video/mp4;base64,video1', type: 'video' },
                { id: 'vid-2', url: 'data:video/mp4;base64,video2', type: 'video' }
            ];
            (useStore.getState as any).mockReturnValue(createMockStoreState({ uploadedImages: uploads }));

            const mockResults = [
                { id: 'ed-1', url: 'data:video/mp4;base64,edited1', prompt: 'edited' }
            ];
            vi.mocked(Editing.batchEditVideo).mockResolvedValue(mockResults);

            const result = await VideoTools.batch_edit_videos({ prompt: 'Add color grade' });

            expect(Editing.batchEditVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: 'Add color grade'
                })
            );
            expect(result).toContain('Successfully processed');
        });

        it('returns error when no videos uploaded', async () => {
            (useStore.getState as any).mockReturnValue(createMockStoreState({ uploadedImages: [] }));

            const result = await VideoTools.batch_edit_videos({ prompt: 'Edit' });

            expect(result).toContain('No videos found');
        });
    });

    describe('interpolate_sequence', () => {
        it('passes both firstFrame and lastFrame', async () => {
            const mockResults = [{ id: 'interp-1', url: 'https://example.com/interp.mp4', prompt: 'test' }];
            vi.mocked(VideoGeneration.generateVideo).mockResolvedValue(mockResults);

            await VideoTools.interpolate_sequence({
                firstFrame: 'data:image/png;base64,frame1',
                lastFrame: 'data:image/png;base64,frame2',
                prompt: 'Smooth transition'
            });

            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    firstFrame: 'data:image/png;base64,frame1',
                    lastFrame: 'data:image/png;base64,frame2'
                })
            );
        });

        it('passes userProfile for distributor context', async () => {
            const mockResults = [{ id: 'interp-1', url: 'https://example.com/interp.mp4', prompt: 'test' }];
            vi.mocked(VideoGeneration.generateVideo).mockResolvedValue(mockResults);

            await VideoTools.interpolate_sequence({
                firstFrame: 'data:image/png;base64,frame1',
                lastFrame: 'data:image/png;base64,frame2'
            });

            expect(VideoGeneration.generateVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    userProfile: expect.objectContaining({ uid: 'test-user' })
                })
            );
        });
    });

    describe('update_keyframe', () => {
        it('updates keyframe in video editor store', async () => {
            const mockAddKeyframe = vi.fn();
            const mockUpdateKeyframe = vi.fn();
            const { useVideoEditorStore } = await import('@/modules/video/store/videoEditorStore');
            vi.mocked(useVideoEditorStore.getState).mockReturnValue({
                addKeyframe: mockAddKeyframe,
                updateKeyframe: mockUpdateKeyframe,
                project: {
                    clips: [{ id: 'clip-1', keyframes: {} }]
                }
            } as any);

            const result = await VideoTools.update_keyframe({
                clipId: 'clip-1',
                property: 'opacity',
                frame: 30,
                value: 0.5,
                easing: 'easeInOut'
            });

            expect(mockAddKeyframe).toHaveBeenCalledWith('clip-1', 'opacity', 30, 0.5);
            expect(mockUpdateKeyframe).toHaveBeenCalledWith('clip-1', 'opacity', 30, { easing: 'easeInOut' });
            expect(result).toContain('Keyframe updated');
        });

        it('returns error for non-existent clip', async () => {
            const { useVideoEditorStore } = await import('@/modules/video/store/videoEditorStore');
            vi.mocked(useVideoEditorStore.getState).mockReturnValue({
                project: { clips: [] }
            } as any);

            const result = await VideoTools.update_keyframe({
                clipId: 'non-existent',
                property: 'opacity',
                frame: 30,
                value: 0.5
            });

            expect(result).toContain('not found');
        });
    });
});
