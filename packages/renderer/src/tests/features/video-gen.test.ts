import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoTools } from '@/services/agent/tools/VideoTools';

// Mock the dependencies
vi.mock('@/core/store', () => ({
  useStore: {
    getState: vi.fn(() => ({
      userProfile: { id: 'test-user' },
      whiskState: null, // Disable Whisk path for now
      currentProjectId: 'test-project',
      addToHistory: vi.fn(),
    })),
  },
}));

vi.mock('@/services/video/VideoGenerationService', () => ({
  VideoGeneration: {
    generateVideo: vi.fn(),
    waitForJob: vi.fn(),
  },
}));

// Import the mocked service to set return values
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useStore } from '@/core/store';

describe('VideoTools Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generate_video', () => {
    it('should validate inputs and return error for empty prompt', async () => {
      const result = await VideoTools.generate_video({
          prompt: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Prompt cannot be empty');
      expect(VideoGeneration.generateVideo).not.toHaveBeenCalled();
    });

    it('should validate inputs and return error for invalid duration', async () => {
      const result = await VideoTools.generate_video({
          prompt: 'A cat video',
          duration: -5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('positive number');
      expect(VideoGeneration.generateVideo).not.toHaveBeenCalled();
    });

    it('should validate inputs and return error for invalid aspect ratio', async () => {
      const result = await VideoTools.generate_video({
          prompt: 'A cat video',
          aspectRatio: '100:100',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid aspect ratio');
      expect(VideoGeneration.generateVideo).not.toHaveBeenCalled();
    });

    it('should successfully call generateVideo with valid arguments', async () => {
      const mockJob = { id: 'job-123', url: 'http://example.com/video.mp4', prompt: 'A cat video' };
      (VideoGeneration.generateVideo as any).mockResolvedValue([mockJob]);

      const result = await VideoTools.generate_video({
          prompt: 'A cat video',
          duration: 5,
          aspectRatio: '16:9',
          resolution: '1920x1080',
      });

      expect(VideoGeneration.generateVideo).toHaveBeenCalledWith({
        prompt: 'A cat video',
        firstFrame: undefined,
        duration: 5,
        aspectRatio: '16:9',
        resolution: '1920x1080',
        userProfile: expect.any(Object),
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({
        id: 'job-123',
        url: 'http://example.com/video.mp4',
      }));
    });

    it('should handle async jobs that return empty URL initially', async () => {
      const mockJobAsync = { id: 'job-async', url: '', prompt: 'Async video' };
      const mockJobCompleted = { id: 'job-async', videoUrl: 'http://example.com/async_video.mp4', status: 'completed' };

      (VideoGeneration.generateVideo as any).mockResolvedValue([mockJobAsync]);
      (VideoGeneration.waitForJob as any).mockResolvedValue(mockJobCompleted);

      const result = await VideoTools.generate_video({
          prompt: 'Async video',
      });

      expect(VideoGeneration.generateVideo).toHaveBeenCalled();
      expect(VideoGeneration.waitForJob).toHaveBeenCalledWith('job-async');
      expect(result.success).toBe(true);
      expect(result.data.url).toBe('http://example.com/async_video.mp4');
    });

    it('should handle generation failures gracefully', async () => {
       (VideoGeneration.generateVideo as any).mockRejectedValue(new Error('API Error'));

       const result = await VideoTools.generate_video({
           prompt: 'Crash me',
       });

       expect(result.success).toBe(false);
       expect(result.error).toBe('API Error');
    });
  });
});
