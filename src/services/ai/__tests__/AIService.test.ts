import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AIService, AI } from "../AIService";
import { AppErrorCode } from "@/shared/types/errors";

// Mock the GoogleGenerativeAI module
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn(),
    }),
  })),
}));

describe("AIService", () => {
  let service: AIService;
  let mockModel: any;

  beforeEach(() => {
    service = new AIService();

    // Setup mock model
    mockModel = {
      generateContent: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateContent", () => {
    it("should generate content successfully", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: "Hello, world!" }],
            },
            finishReason: "STOP",
          },
        ],
      };

      mockModel.generateContent.mockResolvedValue({
        response: mockResponse,
      });

      const result = await service.generateContent({
        model: "gemini-3-pro-preview",
        contents: { role: "user", parts: [{ text: "test" }] },
      });

      expect(result.text()).toBe("Hello, world!");
      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: [{ role: "user", parts: [{ text: "test" }] }],
      });
    });

    it("should handle tool calls in response", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  functionCall: {
                    name: "test_tool",
                    args: { param: "value" },
                  },
                },
              ],
            },
          },
        ],
      };

      mockModel.generateContent.mockResolvedValue({
        response: mockResponse,
      });

      const result = await service.generateContent({
        model: "gemini-3-pro-preview",
        contents: { role: "user", parts: [{ text: "test" }] },
      });

      const calls = result.functionCalls();
      expect(calls).toHaveLength(1);
      expect(calls![0]).toEqual({
        name: "test_tool",
        args: { param: "value" },
      });
    });

    it("should retry on retryable errors", async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: "Success after retry" }],
            },
          },
        ],
      };

      mockModel.generateContent
        .mockRejectedValueOnce({ code: "resource-exhausted" })
        .mockResolvedValueOnce({ response: mockResponse });

      const result = await service.generateContent({
        model: "gemini-3-pro-preview",
        contents: { role: "user", parts: [{ text: "test" }] },
      });

      expect(result.text()).toBe("Success after retry");
      expect(mockModel.generateContent).toHaveBeenCalledTimes(2);
    });

    it("should throw AppException on fatal errors", async () => {
      mockModel.generateContent.mockRejectedValue(
        new Error("Non-retryable error"),
      );

      await expect(
        service.generateContent({
          model: "gemini-3-pro-preview",
          contents: { role: "user", parts: [{ text: "test" }] },
        }),
      ).rejects.toThrow(AppException);
    });
  });

  describe("parseJSON", () => {
    it("should parse valid JSON strings", () => {
      const text = '{"key": "value"}';
      const result = AI.parseJSON<{ key: string }>(text);

      expect(result).toEqual({ key: "value" });
    });

    it("should parse JSON with markdown code blocks", () => {
      const text = '```json\n{"key": "value"}\n```';
      const result = AI.parseJSON<{ key: string }>(text);

      expect(result).toEqual({ key: "value" });
    });

    it("should return empty object on invalid JSON", () => {
      const text = "invalid json";
      const result = AI.parseJSON(text);

      expect(result).toEqual({});
    });

    it("should return empty object on empty input", () => {
      const result = AI.parseJSON(undefined);

      expect(result).toEqual({});
    });
  });

  describe("withRetry", () => {
    it("should not retry on first success", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await (service as any).withRetry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce({ code: "resource-exhausted" })
        .mockRejectedValueOnce({ code: "unavailable" })
        .mockResolvedValueOnce("success");

      const result = await (service as any).withRetry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should not retry on non-retryable errors", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Non-retryable"));

      await expect((service as any).withRetry(operation)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should throw error after max retries", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue({ code: "resource-exhausted" });

      await expect((service as any).withRetry(operation, 2)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});
