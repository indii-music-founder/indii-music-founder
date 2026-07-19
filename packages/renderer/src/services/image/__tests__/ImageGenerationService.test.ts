import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageGeneration } from "../ImageGenerationService";

import { httpsCallable } from "firebase/functions";
import { CostControlService } from '@/services/billing/CostControlService';
import { subscriptionService } from '@/services/subscription/SubscriptionService';

// Mock Firebase functions
vi.mock("@/services/firebase", () => ({
  functions: {},
  functionsWest1: {},
  auth: {
    currentUser: {
      uid: 'test-user',
      email: 'test@example.com',
      getIdToken: vi.fn().mockResolvedValue('mock-id-token'),
    }
  },
  remoteConfig: {},
  storage: { app: { options: { storageBucket: 'mock-bucket' } } },
  db: {},
  ai: {},
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));

vi.mock("firebase/storage", () => ({
    getStorage: vi.fn(),
    ref: vi.fn((_storage, url) => ({ fullPath: url })),
    uploadString: vi.fn().mockResolvedValue({ ref: { name: 'mock-file' } }),
    uploadBytes: vi.fn().mockResolvedValue({ ref: { name: 'mock-file' } }),
    getDownloadURL: vi.fn().mockResolvedValue('https://storage.mock/mock-file.png')
}));

vi.mock("@/services/intelligence/AutonomousIntelligence", () => ({
  AutonomousIntelligence: {
    generateContent: vi.fn(),
    parseJSON: vi.fn(),
  },
}));

vi.mock('@/services/intelligence/FirebaseIntelligenceService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock Intelligence response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        generateVideo: vi.fn().mockResolvedValue({ videoId: 'mock-video-id' }),
        generateContent: vi.fn().mockResolvedValue('Mock Intelligence response'),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseIntelligenceService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

// Mock SubscriptionService and UsageTracker
vi.mock("@/services/subscription/SubscriptionService", () => ({
  subscriptionService: {
    canPerformAction: vi.fn().mockResolvedValue({ allowed: true }),
    getSubscription: vi.fn().mockResolvedValue({ tier: 'pro' }),
    getCurrentSubscription: vi.fn().mockResolvedValue({ tier: 'pro' }),
  },
}));

vi.mock("@/services/subscription/UsageTracker", () => ({
  usageTracker: {
    trackImageGeneration: vi.fn().mockResolvedValue(undefined),
  },
}));

// Hoist the core store mock to prevent dynamic import issues
vi.mock("@/core/store", () => ({
  useStore: {
    getState: vi.fn().mockReturnValue({ userProfile: null }),
  },
}));

// Mock CloudStorageService to prevent dynamic import hangs
vi.mock("@/services/CloudStorageService", () => ({
  CloudStorageService: {
    smartSave: vi.fn().mockResolvedValue({ url: "mock-storage-url" }),
    compressImage: vi.fn().mockResolvedValue({ dataUri: "data:image/png;base64,mock-compressed" }),
  },
}));

describe("ImageGenerationService", () => {
  const mockGenerateImage = vi.fn() as unknown as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(subscriptionService.canPerformAction).mockResolvedValue({ allowed: true });
    vi.mocked(CostControlService.checkAndReserve).mockResolvedValue({
      allowed: true,
      remainingBudget: 100,
      dailyUsed: 0,
      monthlyUsed: 0,
      operationId: 'test-cost-reservation',
    });
    mockGenerateImage.stream = vi.fn();
    vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage as any);
  });

  describe("generateImages", () => {
    it("should generate images with basic options", async () => {
      const mockResponse = {
        data: {
          images: [
            {
              bytesBase64Encoded: "base64data",
              mimeType: "image/png",
            },
          ],
        },
      };

      mockGenerateImage.mockResolvedValue(mockResponse);

      const results = await ImageGeneration.generateImages({
        prompt: "A test image",
        count: 1,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.prompt).toBe("A test image");
      expect(results[0]!.url).toMatch(/^data:image\/png;base64,/);

      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "generateImageV3");
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("A test image"),
          count: 1,
          costReservationId: 'test-cost-reservation',
        }),
      );
    });

    it('deduplicates concurrent identical requests before reserving cost', async () => {
      let resolveGeneration!: (value: { data: { images: Array<{ bytesBase64Encoded: string; mimeType: string }> } }) => void;
      mockGenerateImage.mockReturnValue(new Promise(resolve => { resolveGeneration = resolve; }));

      const first = ImageGeneration.generateImages({ prompt: 'same intent', count: 1, sessionId: 'project-1' });
      const second = ImageGeneration.generateImages({ prompt: 'same intent', count: 1, sessionId: 'project-1' });
      await Promise.resolve();
      resolveGeneration({ data: { images: [{ bytesBase64Encoded: 'base64data', mimeType: 'image/png' }] } });

      await expect(Promise.all([first, second])).resolves.toHaveLength(2);
      expect(CostControlService.checkAndReserve).toHaveBeenCalledTimes(1);
      expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    });

    it("should handle distributor-aware cover art generation", async () => {
      const mockResponse = {
        data: {
          images: [
            {
              bytesBase64Encoded: "base64data",
              mimeType: "image/png",
            },
          ],
        },
      };

      mockGenerateImage.mockResolvedValue(mockResponse);

      const userProfile = {
        distributor: "tune-core",
        distributionMethod: "aggregator",
      };

      const results = await ImageGeneration.generateImages({
        prompt: "My album cover",
        isCoverArt: true,
        userProfile: userProfile as unknown as import('@/types/User').UserProfile,
      });

      expect(results).toHaveLength(1);
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          aspectRatio: "1:1", // Cover art should be square
          prompt: expect.stringContaining("COVER ART REQUIREMENTS"),
        }),
      );
    });

    it("should handle image uploads (reference images)", async () => {
      const mockResponse = {
        data: {
          images: [
            {
              bytesBase64Encoded: "base64data",
              mimeType: "image/png",
            },
          ],
        },
      };

      mockGenerateImage.mockResolvedValue(mockResponse);

      const results = await ImageGeneration.generateImages({
        prompt: "Edit this image",
        sourceImages: [{ mimeType: "image/jpeg", data: "refdata" }],
      });

      expect(results).toHaveLength(1);
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Edit this image"),
        }),
      );
    });

    it("should return empty array when no candidates", async () => {
      const mockResponse = {
        data: {
          images: [],
        },
      };

      mockGenerateImage.mockResolvedValue(mockResponse);

      const results = await ImageGeneration.generateImages({
        prompt: "A test image",
      });

      expect(results).toHaveLength(0);
    });

    it("should handle stored resultUri responses from the creative gateway", async () => {
      const mockResponse = {
        data: {
          jobId: 'job-123',
          resultUri: 'gs://mock-bucket/creative/test-user/image.png',
        },
      };

      mockGenerateImage.mockResolvedValue(mockResponse);

      const results = await ImageGeneration.generateImages({
        prompt: "A stored image",
      });

      expect(results).toEqual([
        expect.objectContaining({
          id: 'job-123',
          prompt: 'A stored image',
          url: 'https://storage.mock/mock-file.png',
        }),
      ]);
    });

    it("ISSUE-777: returns every stored batch result and forwards advanced image settings", async () => {
      mockGenerateImage.mockResolvedValue({
        data: {
          jobId: 'batch-job',
          resultUris: [
            'gs://mock-bucket/creative/test-user/one.png',
            'gs://mock-bucket/creative/test-user/two.png',
            'gs://mock-bucket/creative/test-user/three.png',
          ],
          textNarration: 'Campaign direction',
          thoughtSummary: 'Composition summary',
        },
      });

      const results = await ImageGeneration.generateImages({
        prompt: 'Three campaign concepts',
        count: 3,
        imageSize: '1k',
        thinkingLevel: 'minimal',
        includeThoughts: true,
        useGoogleSearch: true,
        useImageSearch: true,
        responseFormat: 'image_and_text',
        referenceUris: ['gs://mock-bucket/creative/test-user/reference.png'],
      });

      expect(results).toHaveLength(3);
      expect(results.every(result => result.textNarration === 'Campaign direction')).toBe(true);
      expect(results.every(result => result.thoughtSignature === 'Composition summary')).toBe(true);
      expect(mockGenerateImage).toHaveBeenCalledWith(expect.objectContaining({
        count: 3,
        imageSize: '1k',
        includeThoughts: true,
        responseFormat: 'image_and_text',
        referenceUri: 'gs://mock-bucket/creative/test-user/reference.png',
        referenceUris: ['gs://mock-bucket/creative/test-user/reference.png'],
      }));
    });

    it("should return fallback or empty on generation failure", async () => {
      mockGenerateImage.mockRejectedValue(new Error("Generation failed"));

      try {
        await ImageGeneration.generateImages({
          prompt: "A test image",
        });
      } catch (e: unknown) {
        expect(e).toBeDefined();
      }
      expect(CostControlService.finalize).toHaveBeenCalledWith('test-cost-reservation', 'VOIDED');
    });

    it('checks subscription quota before reserving cost', async () => {
      vi.mocked(subscriptionService.canPerformAction).mockResolvedValue({
        allowed: false,
        reason: 'quota reached',
        currentUsage: { used: 10, limit: 10, remaining: 0 },
      });

      await expect(ImageGeneration.generateImages({ prompt: 'Over quota' })).rejects.toThrow('quota reached');

      expect(CostControlService.checkAndReserve).not.toHaveBeenCalled();
      expect(mockGenerateImage).not.toHaveBeenCalled();
    });
  });

  describe("generateCoverArt", () => {
    it("should generate cover art with distributor constraints", async () => {
      const mockResponse = {
        data: {
          images: [
            {
              bytesBase64Encoded: "base64data",
              mimeType: "image/png",
            },
          ],
        },
      };

      mockGenerateImage.mockResolvedValue(mockResponse);

      const userProfile = {
        distributor: "distribute",
        distributionMethod: "aggregator",
      };

      const results = await ImageGeneration.generateCoverArt(
        "My Album Cover",
        userProfile as unknown as import('@/types/User').UserProfile,
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("constraints");
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          aspectRatio: "1:1",
        }),
      );
    });
  });

  describe("remixImage", () => {
    it("should remix images with style reference via Cloud Function", async () => {
      const mockDirectResponse = {
        data: {
          id: 'mock-id',
          url: "data:image/png;base64,remixeddata",
          prompt: "Apply this style",
        }
      };

      mockGenerateImage.mockResolvedValue(mockDirectResponse);

      const result = await ImageGeneration.remixImage({
        contentImage: { mimeType: "image/jpeg", data: "contentdata" },
        styleImage: { mimeType: "image/png", data: "styledata" },
        prompt: "Apply this style",
      });

      expect(result).toHaveProperty("url");
      expect(result!.url).toMatch(/^data:image\/png;base64,/);
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Apply this style",
          image: { mimeType: "image/jpeg", data: "contentdata" },
          referenceImage: { mimeType: "image/png", data: "styledata" }
        })
      );
    });

    it("should normalize raw candidate responses into a usable preview url", async () => {
      const mockDirectResponse = {
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "candidate-preview-data",
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      mockGenerateImage.mockResolvedValue(mockDirectResponse);

      const result = await ImageGeneration.remixImage({
        contentImage: { mimeType: "image/jpeg", data: "contentdata" },
        styleImage: { mimeType: "image/png", data: "styledata" },
        prompt: "Apply this style",
      });

      expect(result).toEqual({
        url: "data:image/png;base64,candidate-preview-data",
      });
    });
  });

  describe("batchRemix", () => {
    it("should remix multiple images with style via Cloud Function", async () => {
      // batchRemix now uses Cloud Function instead of AI.generateContent
      const mockCloudResponse = {
        data: {
          images: [
            {
              bytesBase64Encoded: "remixeddata",
              mimeType: "image/png",
            },
          ],
        },
      };

      mockGenerateImage.mockResolvedValue(mockCloudResponse);

      const results = await ImageGeneration.batchRemix({
        styleImage: { mimeType: "image/png", data: "styledata" },
        targetImages: [
          { mimeType: "image/jpeg", data: "target1" },
          { mimeType: "image/jpeg", data: "target2" },
        ],
      });

      expect(results).toHaveLength(2);
      // Cloud Function should be called twice (once per target image)
      expect(mockGenerateImage).toHaveBeenCalledTimes(2);
    });
  });
});
describe("captionImage", () => {
  it("should call AutonomousIntelligence.generateContent and return caption text", async () => {
    const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
    const mockResponse = {
      response: {
        text: vi.fn().mockReturnValue("A glowing orb in a dark forest."),
      },
    };
    vi.mocked(AutonomousIntelligence.generateContent).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof AutonomousIntelligence.generateContent>>);

    const result = await ImageGeneration.captionImage(
      { mimeType: "image/png", data: "cleanBase64Data" },
      "subject"
    );

    expect(result).toBe("A glowing orb in a dark forest.");
    expect(AutonomousIntelligence.generateContent).toHaveBeenCalledOnce();
  });
});
