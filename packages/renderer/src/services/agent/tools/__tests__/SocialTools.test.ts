import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialTools } from '../SocialTools';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

// Mock Dependencies
vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'Mock response' } }),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateContent: vi.fn()
    },
    getResponseText: vi.fn().mockImplementation((r) => r?.response?.text ? r.response.text() : (typeof r === 'string' ? r : JSON.stringify(r)))
}));

vi.mock('@/core/config/intelligence-models', () => ({

  INTELLIGENCE_MODELS: {
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
    EMBEDDING_DEFAULT: 'gemini-embedding-001'
  },
  validateModels: () => { },
  ModelIdSchema: { parse: (v: string) => v },
}));

describe('SocialTools', () => {
  const { generate_social_post } = SocialTools;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generate_social_post', () => {
    // Structural-only regression: the AI response is mocked, so this does not
    // prove a signed-in customer path or production feed state.
    it('returns reviewable draft copy without claiming a saved post', async () => {
      const mockGeneratedText = 'Exciting news! #LaunchDay';

      vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValueOnce({
        response: {
          text: () => mockGeneratedText,
        },
      } as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

      const result = await generate_social_post({
        platform: 'Twitter',
        topic: 'Product Launch',
        tone: 'excited'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        platform: 'Twitter',
        content: mockGeneratedText,
      });
      expect(result.message).toContain('not saved or posted');
    });
  });
});
