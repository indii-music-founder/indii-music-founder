import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FUNCTION_INTELLIGENCE_MODELS, NANO_BANANA_CAPABILITIES } from '../config/models';
import { getVertexAIClient, getVertexAIBaseUrl, resetVertexAIClient } from './vertexClient';
import { normalizeVideoAspectRatio, normalizeVideoDuration, normalizePersonGeneration } from '../shared/creativeNormalizers';
import { z } from 'zod';

const {
  mockGenerateContent,
  mockGenerateVideos,
  mockGetVideosOperation,
  mockGoogleGenAI,
} = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockGenerateVideos = vi.fn();
  const mockGetVideosOperation = vi.fn();

  const mockGoogleGenAI = vi.fn(function GoogleGenAI(options: unknown) {
    return {
      options,
      models: {
        generateContent: mockGenerateContent,
        generateVideos: mockGenerateVideos,
      },
      operations: {
        getVideosOperation: mockGetVideosOperation,
      },
    };
  });

  return {
    mockGenerateContent,
    mockGenerateVideos,
    mockGetVideosOperation,
    mockGoogleGenAI,
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: mockGoogleGenAI,
}));

describe('indiiOS Layer 1: Vertex AI Integrations for indii.music', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGoogleGenAI.mockClear();
    mockGenerateContent.mockClear();
    mockGenerateVideos.mockClear();
    mockGetVideosOperation.mockClear();
    resetVertexAIClient();
  });

  describe('1. Gemini 3 Pro: Track & Release Metadata Processing', () => {
    const MusicMetadataSchema = z.object({
      trackTitle: z.string().min(1),
      artistName: z.string().min(1),
      isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/),
      ddexGenre: z.string().min(1),
      ddexSubGenre: z.string().min(1),
      bpm: z.number().positive(),
      key: z.string(),
      isExplicit: z.boolean(),
      language: z.string().length(3), // ISO 639-2
      mood: z.array(z.string()).nonempty(),
      marketingComment: z.string().min(10),
    });

    it('processes and validates audio metadata against the indii.music publishing schema', async () => {
      const simulatedModelResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    trackTitle: 'Motor City Horizon',
                    artistName: 'Wiil',
                    isrc: 'USND12600001',
                    ddexGenre: 'Electronic',
                    ddexSubGenre: 'Techno',
                    bpm: 132,
                    key: 'F minor',
                    isExplicit: false,
                    language: 'eng',
                    mood: ['Driving', 'Euphoric', 'Hypnotic'],
                    marketingComment: 'High-energy Detroit Techno peak-hour cut featuring analog modular synths.',
                  }),
                },
              ],
            },
          },
        ],
      };

      mockGenerateContent.mockResolvedValueOnce(simulatedModelResponse);

      const ai = getVertexAIClient('indii-music-founder', 'global');
      const response = await ai.models.generateContent({
        model: FUNCTION_INTELLIGENCE_MODELS.TEXT.PRO, // gemini-3.1-pro-preview
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Analyze audio metadata for distribution to DSPs' }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.model).toBe(FUNCTION_INTELLIGENCE_MODELS.TEXT.PRO);

      // Validate schema parsing
      const rawText = (response as any).candidates[0].content.parts[0].text;
      const parsedJson = JSON.parse(rawText);
      const validationResult = MusicMetadataSchema.safeParse(parsedJson);

      expect(validationResult.success).toBe(true);
      if (validationResult.success) {
        expect(validationResult.data.isrc).toBe('USND12600001');
        expect(validationResult.data.bpm).toBe(132);
        expect(validationResult.data.ddexGenre).toBe('Electronic');
      }
    });

    it('rejects invalid ISRC or missing DDEX genre to prevent automated publishing failure', () => {
      const invalidData = {
        trackTitle: 'Bad Metadata',
        artistName: 'Wiil',
        isrc: 'INVALID_ISRC', // Violates regex
        ddexGenre: '',        // Empty genre
        ddexSubGenre: 'Techno',
        bpm: 120,
        key: 'C major',
        isExplicit: false,
        language: 'en',       // 2 letters instead of 3
        mood: [],             // Empty mood
        marketingComment: 'Too short',
      };

      const result = MusicMetadataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorFields = result.error.errors.map(e => e.path.join('.'));
        expect(errorFields).toContain('isrc');
        expect(errorFields).toContain('ddexGenre');
        expect(errorFields).toContain('language');
        expect(errorFields).toContain('mood');
      }
    });
  });

  describe('2. Imagen 4.0 & Nano Banana: Artwork Generation', () => {
    it('verifies Imagen 4.0 model definitions and capabilities', () => {
      // Imagen 4.0 generation models
      const proModel = FUNCTION_INTELLIGENCE_MODELS.IMAGE.GENERATION; // gemini-3-pro-image (Nano Banana Pro)
      const fastModel = FUNCTION_INTELLIGENCE_MODELS.IMAGE.FAST;       // gemini-3.1-flash-image (Nano Banana 2)

      expect(proModel).toBe('gemini-3-pro-image');
      expect(fastModel).toBe('gemini-3.1-flash-image');

      const proCaps = NANO_BANANA_CAPABILITIES['gemini-3-pro-image'];
      expect(proCaps.maxResolution).toBe('4K');
      expect(proCaps.supportedAspectRatios).toContain('1:1');
      expect(proCaps.supportedAspectRatios).toContain('16:9');
      expect(proCaps.maxReferenceImages).toBe(14);
    });

    it('formats generation payload with 4K resolution and 1:1 aspect ratio for album cover art', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: 'fake-cover-art-base64',
                  },
                },
              ],
            },
          },
        ],
      });

      const ai = getVertexAIClient('indii-music-founder', 'global');
      await ai.models.generateContent({
        model: FUNCTION_INTELLIGENCE_MODELS.IMAGE.GENERATION,
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Album cover for Detroit Techno vinyl release, minimalist geometric typography' }],
          },
        ],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '4k',
          },
        },
      });

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.model).toBe('gemini-3-pro-image');
      expect(callArgs.config.imageConfig.aspectRatio).toBe('1:1');
      expect(callArgs.config.imageConfig.imageSize).toBe('4k');
      expect(callArgs.config.responseModalities).toEqual(['IMAGE']);
    });
  });

  describe('3. Veo 3.1: Video Asset Generation', () => {
    it('normalizes Veo 3.1 aspect ratios, durations, and personGeneration safety policies', () => {
      expect(normalizeVideoAspectRatio('16:9')).toBe('16:9');
      expect(normalizeVideoAspectRatio('9:16')).toBe('9:16');
      expect(normalizeVideoAspectRatio('1:1')).toBe('16:9'); // Falls back to supported 16:9

      expect(normalizeVideoDuration(4, '720p', false)).toBe(4);
      expect(normalizeVideoDuration(6, '720p', false)).toBe(6);
      expect(normalizeVideoDuration(8, '720p', false)).toBe(8);
      expect(normalizeVideoDuration(15, '720p', false)).toBe(8); // Bounded to max 8
      expect(normalizeVideoDuration(4, '1080p', false)).toBe(8); // Non-720p requires 8s
      expect(normalizeVideoDuration(4, '720p', true)).toBe(8);   // Frame input requires 8s

      expect(normalizePersonGeneration('allow_adult')).toBe('allow_adult');
      expect(normalizePersonGeneration('dont_allow')).toBe('dont_allow');
    });

    it('submits compliant video generation operation to Vertex AI Veo 3.1 endpoint', async () => {
      mockGenerateVideos.mockResolvedValueOnce({
        done: false,
        name: 'projects/123/locations/us-central1/operations/veo-op-456',
      });

      const ai = getVertexAIClient('indii-music-founder', 'us-central1');
      const operation = await ai.models.generateVideos({
        model: FUNCTION_INTELLIGENCE_MODELS.VIDEO.GENERATION, // veo-3.1-generate-001
        prompt: 'Cinematic visualizer of rain on neon cityscape, 24fps, shallow depth of field',
        config: {
          aspectRatio: '16:9',
          durationSeconds: 8,
          personGeneration: 'dont_allow',
          resolution: '1080p',
          numberOfVideos: 1,
        },
      });

      expect(mockGenerateVideos).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateVideos.mock.calls[0][0];
      expect(callArgs.model).toBe('veo-3.1-generate-001');
      expect(callArgs.config.durationSeconds).toBe(8);
      expect(callArgs.config.personGeneration).toBe('dont_allow');
      expect(operation.name).toBe('projects/123/locations/us-central1/operations/veo-op-456');
    });
  });

  describe('4. Gemini Omni Flash: Multimodal Video Continuity & Remix', () => {
    it('uses gemini-omni-flash-preview for conversational remix and visual QA', () => {
      expect(FUNCTION_INTELLIGENCE_MODELS.VIDEO.OMNI).toBe('gemini-omni-flash-preview');
    });

    it('executes multimodal visual analysis across sequential video frames', async () => {
      const mockAnalysisResult = {
        score: 0.92,
        subjectMatch: true,
        lightingConsistency: true,
        recommendation: 'accept',
        reasoning: 'Consistent subject morphology and lighting angle across cut.',
      };

      mockGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockAnalysisResult) }],
            },
          },
        ],
      });

      const ai = getVertexAIClient('indii-music-founder', 'global');
      const result = await ai.models.generateContent({
        model: FUNCTION_INTELLIGENCE_MODELS.VIDEO.OMNI,
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Analyze cinematic continuity between Frame A and Frame B' },
              { inlineData: { mimeType: 'image/png', data: 'frame-a-bytes' } },
              { inlineData: { mimeType: 'image/png', data: 'frame-b-bytes' } },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.model).toBe('gemini-omni-flash-preview');
      expect(callArgs.contents[0].parts).toHaveLength(3);
    });
  });

  describe('5. Automated Publishing Workflows: ISWC & DDEX Schema Integrity', () => {
    const ISWCSplitSchema = z.object({
      title: z.string().min(1),
      composers: z.array(
        z.object({
          name: z.string().min(1),
          ipiNumber: z.string().regex(/^\d{9,11}$/).nullable(),
          share: z.number().min(1).max(100),
          role: z.enum(['C', 'A', 'CA']),
          pro: z.string().min(1),
        })
      ).min(1),
      publisher: z.object({
        name: z.string().min(1),
        share: z.number().min(0).max(100).nullable(),
      }).nullable(),
      associatedISRCs: z.array(z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/)),
    }).refine((data) => {
      const totalWriter = data.composers.reduce((sum, c) => sum + c.share, 0);
      const publisher = data.publisher?.share ?? 0;
      return Math.abs((totalWriter + publisher) - 100) < 0.01;
    }, {
      message: 'Total composition splits (writer + publisher) must sum to exactly 100%',
    });

    it('validates a distribution-ready ISWC composition record with 100% split', () => {
      const validPublishingWork = {
        title: 'Motor City Horizon',
        composers: [
          {
            name: 'Wiil',
            ipiNumber: '00123456789',
            share: 50,
            role: 'CA' as const,
            pro: 'ASCAP',
          },
          {
            name: 'Collaborator',
            ipiNumber: '00987654321',
            share: 50,
            role: 'C' as const,
            pro: 'BMI',
          },
        ],
        publisher: {
          name: 'indii.music publishing',
          share: 0,
        },
        associatedISRCs: ['USND12600001'],
      };

      const result = ISWCSplitSchema.safeParse(validPublishingWork);
      expect(result.success).toBe(true);
    });

    it('rejects composition records where shares do not equal 100%', () => {
      const invalidPublishingWork = {
        title: 'Imbalanced Track',
        composers: [
          {
            name: 'Wiil',
            ipiNumber: '00123456789',
            share: 45, // 45 + 45 = 90% != 100%
            role: 'CA' as const,
            pro: 'ASCAP',
          },
          {
            name: 'Collaborator',
            ipiNumber: '00987654321',
            share: 45,
            role: 'C' as const,
            pro: 'BMI',
          },
        ],
        publisher: null,
        associatedISRCs: ['USND12600001'],
      };

      const result = ISWCSplitSchema.safeParse(invalidPublishingWork);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('must sum to exactly 100%');
      }
    });
  });
});
