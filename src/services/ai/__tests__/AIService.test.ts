import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AIService, AI } from "../AIService";
import { AppErrorCode, AppException } from "@/shared/types/errors";

// Mock FirebaseAIService
vi.mock('../FirebaseAIService', () => ({
  firebaseAI: {
    generateContent: vi.fn(),
    generateContentStream: vi.fn(),
    generateText: vi.fn(),
    generateStructuredData: vi.fn(),
    generateVideo: vi.fn(),
    embedContent: vi.fn(),
  },
}));

vi.mock('@/utils/async', () => ({
  delay: vi.fn().mockResolvedValue(undefined),
}));

import { firebaseAI } from "../FirebaseAIService";

describe("AIService", () => {
  let service: AIService;

  beforeEach(() => {
    // Access private constructor for testing
    service = new (AIService as any)();
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.spyOn(console, 'warn').mockImplementation(() => { });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

      vi.mocked(firebaseAI.generateContent).mockResolvedValue({
        response: mockResponse as any,
      });

      const result = await service.generateContent({
        model: "gemini-3-pro-preview",
        contents: { role: "user", parts: [{ text: "test" }] },
      });

      expect(result.text()).toBe("Hello, world!");
      expect(firebaseAI.generateContent).toHaveBeenCalled();
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

      vi.mocked(firebaseAI.generateContent).mockResolvedValue({
        response: mockResponse as any,
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

      vi.mocked(firebaseAI.generateContent)
        .mockRejectedValueOnce({ code: "resource-exhausted" })
        .mockResolvedValueOnce({ response: mockResponse as any });

      const result = await service.generateContent({
        model: "gemini-3-pro-preview",
        contents: { role: "user", parts: [{ text: "test" }] },
      });

      expect(result.text()).toBe("Success after retry");
      expect(firebaseAI.generateContent).toHaveBeenCalledTimes(2);
    });

    it("should throw AppException on fatal errors", async () => {
      vi.mocked(firebaseAI.generateContent).mockRejectedValue(
        new Error("Non-retryable error"),
      );

      await expect(
        service.generateContent({
          model: "gemini-3-pro-preview",
          contents: { role: "user", parts: [{ text: "test" }] },
        }),
      ).rejects.toThrow(AppException);
    });

    it("should coalesce identical requests", async () => {
      const mockResponse = {
        response: {
          candidates: [
            {
              content: { parts: [{ text: "Coalesced" }] },
              finishReason: "STOP",
              index: 0,
            },
          ],
        },
      };

      let resolveGenerate: (value: any) => void;
      const generatePromise = new Promise(resolve => {
        resolveGenerate = resolve;
      });

      // Mock implementation to wait for signal
      vi.mocked(firebaseAI.generateContent).mockImplementation(() => generatePromise as any);

      const options = {
        model: "gemini-3-pro-preview",
        contents: { role: "user", parts: [{ text: "shared prompt" }] }
      };

      // Fire two identical requests
      const p1 = service.generateContent(options);
      const p2 = service.generateContent(options);

      // Must be same promise instance
      expect(p1).toBe(p2);

      // Resolve underlying call
      // @ts-expect-error
      resolveGenerate(mockResponse);

      const r1 = await p1;
      const r2 = await p2;

      expect(r1.text()).toBe("Coalesced");
      expect(r2.text()).toBe("Coalesced");
      expect(firebaseAI.generateContent).toHaveBeenCalledTimes(1);
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
