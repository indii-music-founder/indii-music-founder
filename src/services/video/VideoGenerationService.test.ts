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
});
