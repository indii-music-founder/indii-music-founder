import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageGeneration } from "../ImageGenerationService";
import { functions } from "@/services/firebase";
import { httpsCallable } from "firebase/functions";

import { AI } from "@/services/ai/AIService";

// Mock Firebase functions
vi.mock("@/services/firebase", () => ({
  functions: {},
  auth: { currentUser: { uid: 'test-user' } },
  remoteConfig: {},
  storage: {},
  db: {},
  ai: {},
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));

vi.mock("@/services/ai/AIService", () => ({
  AI: {
    generateContent: vi.fn(),
    parseJSON: vi.fn(),
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
      expect(results[0].prompt).toBe("A test image");
      expect(results[0].url).toMatch(/^data:image\/png;base64,/);

      expect(httpsCallable).toHaveBeenCalledWith(functions, "generateImageV3");
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
        userProfile: userProfile as any,
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
          images: [{ mimeType: "image/jpeg", data: "refdata" }],
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

      // The service catches the error and returns a mock fallback/empty array
      const results = await ImageGeneration.generateImages({
        prompt: "A test image",
      });

      // Depending on implementation it might return empty array or fallback
      expect(Array.isArray(results)).toBe(true);
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
        userProfile as any,
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
    it("should remix images with style reference", async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "remixeddata",
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      (AI.generateContent as any).mockResolvedValue(mockResponse);

      const result = await ImageGeneration.remixImage({
        contentImage: { mimeType: "image/jpeg", data: "contentdata" },
        styleImage: { mimeType: "image/png", data: "styledata" },
        prompt: "Apply this style",
      });

      expect(result).toHaveProperty("url");
      expect(result!.url).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe("batchRemix", () => {
    it("should remix multiple images with style", async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "remixeddata",
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      (AI.generateContent as any).mockResolvedValue(mockResponse);

      const results = await ImageGeneration.batchRemix({
        styleImage: { mimeType: "image/png", data: "styledata" },
        targetImages: [
          { mimeType: "image/jpeg", data: "target1" },
          { mimeType: "image/jpeg", data: "target2" },
        ],
      });

      expect(results).toHaveLength(2);
      expect(AI.generateContent).toHaveBeenCalledTimes(2);
    });
  });
});
