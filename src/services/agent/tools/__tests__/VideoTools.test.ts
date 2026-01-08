import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoTools } from '../VideoTools';

// Mocks
vi.mock('@/services/video/VideoGenerationService', () => ({
    VideoGenerationService: {
        generateLongFormVideo: vi.fn(),
        subscribeToJob: vi.fn(),
        getJobStatus: vi.fn()
    }
}));

describe('VideoTools', () => {
    let VideoGenerationService: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const module = await import('@/services/video/VideoGenerationService');
        VideoGenerationService = module.VideoGenerationService;
    });

    describe('generate_music_video', () => {
        it('should trigger long-form video generation', async () => {
            const mockJobId = 'job-123';
            // Mock return value structure: { id, url, prompt }[]
            VideoGenerationService.generateLongFormVideo.mockResolvedValue([
                { id: mockJobId, url: '', prompt: 'test' }
            ]);

            const args = {
                prompt: 'A cinematic music video',
                style: 'cinematic',
                duration: '30s',
                aspectRatio: '16:9'
            };

            const result = await VideoTools.generate_music_video(args);

            expect(VideoGenerationService.generateLongFormVideo).toHaveBeenCalledWith(
                expect.objectContaining({
                    prompt: args.prompt,
                    durationSeconds: 30, // Parsed from '30s'
                    aspectRatio: '16:9'
                })
            );

            expect(result.success).toBe(true);
            expect(result.data.jobId).toBe(mockJobId);
            expect(result.data.status).toBe('queued');
        });

        it('should handle missing job ID gracefully', async () => {
             VideoGenerationService.generateLongFormVideo.mockResolvedValue([]); // Empty array

             const args = { prompt: 'test' };
             const result = await VideoTools.generate_music_video(args);

             expect(result.success).toBe(false);
             expect(result.error).toContain('Failed to retrieve Job ID');
        });

        it('should handle service errors', async () => {
            VideoGenerationService.generateLongFormVideo.mockRejectedValue(new Error('Service Down'));

            const result = await VideoTools.generate_music_video({ prompt: 'test' });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Service Down');
        });
    });

    describe('check_video_status', () => {
        it('should return job status', async () => {
            VideoGenerationService.getJobStatus.mockResolvedValue({
                id: 'job-123',
                status: 'processing',
                progress: 50
            });

            const result = await VideoTools.check_video_status({ jobId: 'job-123' });

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('processing');
            expect(result.data.progress).toBe(50);
        });

        it('should handle not found errors', async () => {
            VideoGenerationService.getJobStatus.mockResolvedValue(null);

            const result = await VideoTools.check_video_status({ jobId: 'job-999' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Job not found');
        });
    });
});
