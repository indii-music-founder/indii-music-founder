import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageGeneration } from "../ImageGenerationService";
import { functions } from "@/services/firebase";
import { httpsCallable } from "firebase/functions";

// Mock Firebase functions
vi.mock("@/services/firebase", () => ({
  functions: {},
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}));

describe("ImageGenerationService", () => {
  const mockGenerateImage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(httpsCallable).mockReturnValue(mockGenerateImage);
  });

  describe("generateImages", () => {
    it("should generate images with basic options", async () => {
      const mockResponse = {
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "base64data",
                    },
                  },
                ],
              },
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

      expect(httpsCallable).toHaveBeenCalledWith(functions, "generateImage");
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
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "base64data",
                    },
                  },
                ],
              },
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
        userProfile,
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
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "base64data",
                    },
                  },
                ],
              },
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
          candidates: [],
        },
      };

      mockGenerateImage.mockResolvedValue(mockResponse);

      const results = await ImageGeneration.generateImages({
        prompt: "A test image",
      });

      expect(results).toHaveLength(0);
    });

    it("should throw on generation failure", async () => {
      mockGenerateImage.mockRejectedValue(new Error("Generation failed"));

      await expect(
        ImageGeneration.generateImages({
          prompt: "A test image",
        }),
      ).rejects.toThrow("Generation failed");
    });
  });

  describe("generateCoverArt", () => {
    it("should generate cover art with distributor constraints", async () => {
      const mockResponse = {
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "base64data",
                    },
                  },
                ],
              },
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
        userProfile,
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("constraints");
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          aspectRatio: "1:1",
          userProfile,
        }),
      );
    });
  });

  describe("remixImage", () => {
    it("should remix images with style reference", async () => {
      const mockAIService = {
        generateContent: vi.fn(),
        parseJSON: vi.fn(),
      };

      vi.doMock("../ai/AIService", () => ({
        AI: mockAIService,
      }));

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

      mockAIService.generateContent.mockResolvedValue(mockResponse);

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
      const mockAIService = {
        generateContent: vi.fn(),
        parseJSON: vi.fn(),
      };

      vi.doMock("../ai/AIService", () => ({
        AI: mockAIService,
      }));

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

      mockAIService.generateContent.mockResolvedValue(mockResponse);

      const results = await ImageGeneration.batchRemix({
        styleImage: { mimeType: "image/png", data: "styledata" },
        targetImages: [
          { mimeType: "image/jpeg", data: "target1" },
          { mimeType: "image/jpeg", data: "target2" },
        ],
      });

      expect(results).toHaveLength(2);
      expect(mockAIService.generateContent).toHaveBeenCalledTimes(2);
    });
  });
});
