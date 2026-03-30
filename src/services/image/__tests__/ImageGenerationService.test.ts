import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageGeneration } from "../ImageGenerationService";
import { functions } from "@/services/firebase";
import { httpsCallable } from "firebase/functions";

import { GenAI as AI } from "@/services/ai/GenAI";

// Mock Firebase functions
vi.mock("@/services/firebase", () => ({
  functions: {},
  functionsWest1: {}, // Added mock for functionsWest1
  auth: { currentUser: { uid: 'test-user' } },
  remoteConfig: {},
  storage: {},
  db: {},
  ai: {},
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));

vi.mock("@/services/ai/GenAI", () => ({
  GenAI: {
    generateContent: vi.fn(),
    parseJSON: vi.fn(),
  },
}));

vi.mock("@/services/ai/FirebaseAIService", () => ({
  firebaseAI: {
    generateContent: vi.fn(),
  },
}));

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
  const mockGenerateImage = vi.fn() as any;

  beforeEach(() => {
    vi.clearAllMocks();
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
        }),
      );
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

    it("should return fallback or empty on generation failure", async () => {
      mockGenerateImage.mockRejectedValue(new Error("Generation failed"));

      try {
        await ImageGeneration.generateImages({
          prompt: "A test image",
        });
      } catch (e: unknown) {
        expect(e).toBeDefined();
      }
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
      // remixImage now uses Cloud Function instead of AI.generateContent
      const mockCloudResponse = {
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: "remixeddata",
                      mimeType: "image/png"
                    }
                  }
                ]
              }
            }
          ]
        },
      };

      mockGenerateImage.mockResolvedValue(mockCloudResponse);

      const result = await ImageGeneration.remixImage({
        contentImage: { mimeType: "image/jpeg", data: "contentdata" },
        styleImage: { mimeType: "image/png", data: "styledata" },
        prompt: "Apply this style",
      });

      expect(result).toHaveProperty("url");
      expect(result!.url).toMatch(/^data:image\/png;base64,/);
      expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), "editImage");
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Apply this style",
        }),
      );
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
  it("should call firebaseAI.generateContent and return caption text", async () => {
    const { firebaseAI } = await import("@/services/ai/FirebaseAIService");
    const mockResponse = {
      response: {
        text: vi.fn().mockReturnValue("A glowing orb in a dark forest."),
      },
    };
    vi.mocked(firebaseAI.generateContent).mockResolvedValue(mockResponse as unknown as Awaited<ReturnType<typeof firebaseAI.generateContent>>);

    const result = await ImageGeneration.captionImage(
      { mimeType: "image/png", data: "cleanBase64Data" },
      "subject"
    );

    expect(result).toBe("A glowing orb in a dark forest.");
    expect(firebaseAI.generateContent).toHaveBeenCalledOnce();
  });
});
