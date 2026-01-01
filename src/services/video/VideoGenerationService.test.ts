import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoGenerationService } from './VideoGenerationService';
import { db, functions, auth } from '@/services/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { MembershipService } from '@/services/MembershipService';
import { AI } from '@/services/ai/AIService';

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-job-id')
}));

// Mock dependencies
vi.mock('@/services/firebase', () => ({
  db: {
    collection: vi.fn(),
  },
  functions: {},
  auth: {
    currentUser: { uid: 'test-user' }
  }
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

vi.mock('@/services/MembershipService', () => ({
  MembershipService: {
    checkQuota: vi.fn().mockResolvedValue({ allowed: true }),
    getUpgradeMessage: vi.fn(),
    getCurrentTier: vi.fn().mockResolvedValue('pro'),
    checkVideoDurationQuota: vi.fn().mockResolvedValue({ allowed: true })
  }
}));

vi.mock('@/services/ai/AIService', () => ({
  AI: {
    generateContent: vi.fn().mockResolvedValue({ text: () => 'Temporal analysis result' })
  }
}));

vi.mock('@/core/store', () => ({
  useStore: {
    getState: vi.fn().mockReturnValue({ currentOrganizationId: 'test-org' })
  }
}));

vi.mock('@/utils/video', () => ({
    extractVideoFrame: vi.fn().mockResolvedValue('data:image/png;base64,mockframe')
}));

describe('VideoGenerationService', () => {
  const mockHttpsCallable = httpsCallable as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateVideo', () => {
    it('should successfully trigger the cloud function and return a uuid', async () => {
      const mockTriggerFn = vi.fn().mockResolvedValue({ data: { jobId: 'test-job-id' } });
      mockHttpsCallable.mockReturnValue(mockTriggerFn);

      const result = await VideoGenerationService.generateVideo({
        prompt: 'Test prompt',
        aspectRatio: '16:9',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-job-id');

      // Verify correct function name is called
      expect(mockHttpsCallable).toHaveBeenCalledWith(functions, 'triggerVideoJob');

      // Verify trigger arguments
      expect(mockTriggerFn).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringContaining('Test prompt'), // It might be enriched
        aspectRatio: '16:9',
        jobId: expect.any(String),
        orgId: 'test-org'
      }));
    });

    it('should throw error if user is not authenticated', async () => {
       // @ts-ignore
       auth.currentUser = null;
       await expect(VideoGenerationService.generateVideo({
         prompt: 'Test prompt',
       })).rejects.toThrow('must be signed in');

       // Restore auth
       // @ts-ignore
       auth.currentUser = { uid: 'test-user' };
    });

    it('should throw error if quota exceeded', async () => {
      // @ts-ignore
      MembershipService.checkQuota.mockResolvedValueOnce({ allowed: false });

      await expect(VideoGenerationService.generateVideo({
        prompt: 'Test prompt',
      })).rejects.toThrow('Quota exceeded');
    });

    it('should throw error if cloud function fails', async () => {
      const mockTriggerFn = vi.fn().mockRejectedValue(new Error('Cloud error'));
      mockHttpsCallable.mockReturnValue(mockTriggerFn);

      await expect(VideoGenerationService.generateVideo({
        prompt: 'Test prompt',
      })).rejects.toThrow('Cloud error');
    });
  });
});
