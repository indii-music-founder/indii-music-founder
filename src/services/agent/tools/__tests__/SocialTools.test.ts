import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialTools } from '../SocialTools';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { SocialService } from '@/services/social/SocialService';

// Mock Dependencies
vi.mock('@/services/ai/FirebaseAIService', () => ({
  firebaseAI: {
    generateContent: vi.fn(),
  },
}));

vi.mock('@/services/social/SocialService', () => ({
  SocialService: {
    createPost: vi.fn(),
  },
}));

vi.mock('@/core/config/ai-models', () => ({
  AI_MODELS: {
    TEXT: {
      AGENT: 'mock-model',
    },
  },
  APPROVED_MODELS: {
    TEXT_AGENT: 'mock-model',
    TEXT_FAST: 'mock-model',
    IMAGE_GEN: 'mock-image-model',
    IMAGE_FAST: 'mock-image-model',
    AUDIO_PRO: 'mock-model',
    AUDIO_FLASH: 'mock-model',
    VIDEO_GEN: 'mock-video-model',
    BROWSER_AGENT: 'mock-model',
    EMBEDDING_DEFAULT: 'models/embedding-001'
  },
  validateModels: () => {},
  ModelIdSchema: { parse: (v: string) => v },
}));

describe('SocialTools', () => {
  const { generate_social_post } = SocialTools;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generate_social_post', () => {
    it('should generate content and persist it successfully', async () => {
      // Setup Mocks
      const mockGeneratedText = 'Exciting news! #LaunchDay';
      const mockPostId = 'post-123';

      vi.mocked(firebaseAI.generateContent).mockResolvedValue({
        response: {
          text: () => mockGeneratedText,
        },
      } as any);

      vi.mocked(SocialService.createPost).mockResolvedValue(mockPostId);

      // Execute Tool
      const result = await generate_social_post({
        platform: 'Twitter',
        topic: 'Product Launch',
        tone: 'excited'
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        platform: 'Twitter',
        content: mockGeneratedText,
        postId: mockPostId,
      });

      // Verify Calls
      expect(firebaseAI.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Twitter'),
        'mock-model'
      );
      expect(SocialService.createPost).toHaveBeenCalledWith(mockGeneratedText);
    });

    it('should return content even if persistence fails (Resilience)', async () => {
      // Setup Mocks
      const mockGeneratedText = 'Resilience check! #Testing';

      vi.mocked(firebaseAI.generateContent).mockResolvedValue({
        response: {
          text: () => mockGeneratedText,
        },
      } as any);

      // Simulate DB Failure
      vi.mocked(SocialService.createPost).mockRejectedValue(new Error('Firestore unavailable'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Execute Tool
      const result = await generate_social_post({
        platform: 'LinkedIn',
        topic: 'Resilience',
      });

      // Assertions
      expect(result.success).toBe(true); // Tool should still succeed
      expect(result.data).toEqual({
        platform: 'LinkedIn',
        content: mockGeneratedText,
        postId: null, // Expect null on failure
      });

      // Verify the warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to persist social post:',
        expect.any(Error)
      );
      expect(result.message).toContain('failed to save');
    });
  });
});
