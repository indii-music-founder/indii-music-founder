import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoGeneration } from '../VideoGenerationService';
import { AI } from '../../ai/AIService';

// Mock dependencies
vi.mock('../../ai/AIService', () => ({
    AI: {
        generateVideo: vi.fn(),
        generateContent: vi.fn(),
    }
}));

// Mock MembershipService to allow quota checks in tests
vi.mock('@/services/MembershipService', () => ({
    MembershipService: {
        checkQuota: vi.fn().mockResolvedValue({ allowed: true, currentUsage: 0, maxAllowed: 100 }),
        checkVideoDurationQuota: vi.fn().mockResolvedValue({ allowed: true, maxDuration: 3600, tierName: 'Pro' }),
        getCurrentTier: vi.fn().mockResolvedValue('pro'),
        getUpgradeMessage: vi.fn().mockReturnValue('Upgrade to Pro for more'),
    }
}));

describe('VideoGenerationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateVideo', () => {
        it('should generate video successfully', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.url');

            const result = await VideoGeneration.generateVideo({ prompt: 'test video' });

            expect(result).toHaveLength(1);
            expect(result[0].url).toBe('http://video.url');
            expect(AI.generateVideo).toHaveBeenCalled();
        });

        it('should throw error if video generation fails', async () => {
            (AI.generateVideo as any).mockRejectedValue(new Error('Video Error'));

            await expect(VideoGeneration.generateVideo({ prompt: 'test video' }))
                .rejects.toThrow('Video Error');
        });

        it('should throw error if video generation returns no result', async () => {
            (AI.generateVideo as any).mockResolvedValue(null);

            await expect(VideoGeneration.generateVideo({ prompt: 'test video' }))
                .rejects.toThrow('Video generation returned no result');
        });
        it('should include ingredients in the prompt', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.url');

            await VideoGeneration.generateVideo({
                prompt: 'test video',
                ingredients: ['data:image/png;base64,1', 'data:image/png;base64,2']
            });

            const callArgs = (AI.generateVideo as any).mock.calls[0][0];
            expect(callArgs.prompt).toContain('Reference Ingredients');
            expect(callArgs.prompt).toContain('2 reference images');
        });

        it('should handle empty ingredients array gracefully', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.url');

            await VideoGeneration.generateVideo({
                prompt: 'test video',
                ingredients: []
            });

            const callArgs = (AI.generateVideo as any).mock.calls[0][0];
            expect(callArgs.prompt).not.toContain('Reference Ingredients');
        });

        it('should handle mixed inputs (firstFrame + ingredients)', async () => {
            (AI.generateVideo as any).mockResolvedValue('http://video.url');

            await VideoGeneration.generateVideo({
                prompt: 'test video',
                firstFrame: 'data:image/png;base64,start',
                ingredients: ['data:image/png;base64,ref1']
            });

            const callArgs = (AI.generateVideo as any).mock.calls[0][0];
            expect(callArgs.image).toBeDefined(); // firstFrame
            expect(callArgs.prompt).toContain('Reference Ingredients');
            expect(callArgs.prompt).toContain('1 reference images');
        });
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService, VideoJob } from './VideoGenerationService';
import { db, functions } from '@/services/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

// Mock dependencies
vi.mock('@/services/firebase', () => ({
  db: {
    collection: vi.fn(),
  },
  functions: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
    fromDate: vi.fn((date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }))
  }
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn()
}));

describe('VideoGenerationService', () => {
  const mockHttpsCallable = httpsCallable as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateVideo', () => {
    it('should successfully trigger the cloud function and return a uuid', async () => {
      const mockTriggerFn = vi.fn().mockResolvedValue({ data: { success: true } });

      mockHttpsCallable.mockReturnValue(mockTriggerFn);

      const result = await VideoGenerationService.generateVideo(
        'Test prompt',
        {
          aspectRatio: '16:9',
          duration: '5s',
        }
      );

      expect(typeof result).toBe('string');
      // Verify correct function name is called
      expect(mockHttpsCallable).toHaveBeenCalledWith(functions, 'triggerVideoJob');
      expect(mockTriggerFn).toHaveBeenCalledWith(expect.objectContaining({
        prompt: 'Test prompt',
        aspectRatio: '16:9',
        duration: '5s'
      }));
    });

    it('should throw error if cloud function fails', async () => {
      const mockTriggerFn = vi.fn().mockRejectedValue(new Error('Cloud error'));

      mockHttpsCallable.mockReturnValue(mockTriggerFn);

      await expect(VideoGenerationService.generateVideo(
        'Test prompt',
      )).rejects.toThrow('Cloud error');
    });
});
