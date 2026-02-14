
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService } from '@/services/ai/AIService';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { WrappedResponse, GenerateContentResponse, Candidate } from '@/shared/types/ai.dto';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

// Mock RateLimiter to prevent blocking
vi.mock('@/services/ai/RateLimiter', () => {
    return {
        RateLimiter: class {
            acquire = vi.fn().mockResolvedValue(undefined);
            tryAcquire = vi.fn().mockReturnValue(true);
            getRemainingTokens = vi.fn().mockReturnValue(100);
        }
    };
});

// Mock FirebaseAIService
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
        generateText: vi.fn(),
        generateStructuredData: vi.fn(),
        generateVideo: vi.fn(),
        generateImage: vi.fn(),
        analyzeImage: vi.fn(),
        generateSpeech: vi.fn(),
        embedContent: vi.fn(),
        batchEmbedContents: vi.fn(),
        initializeFallbackMode: vi.fn(),
    }
}));

describe('AIService Integration Tests', () => {
    let aiService: AIService;

    // Helper to create a mock response
    const createMockResponse = (text: string): GenerateContentResponse => ({
        candidates: [{
            content: {
                role: 'model',
                parts: [{ text }]
            },
            finishReason: 'STOP',
            index: 0
        }],
        usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30
        }
    });

    // Helper to create a mock WrappedResponse
    const createMockWrappedResponse = (text: string): WrappedResponse => {
        const rawResponse = createMockResponse(text);
        return {
            response: rawResponse,
            text: () => text,
            functionCalls: () => [],
            usage: () => rawResponse.usageMetadata
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset singleton instance if possible, or just get the instance handling cache manually
        // Since AIService is a singleton, we might need to clear its internal state if it wasn't recreated.
        // However, we can just access it.
        aiService = AIService.getInstance();

        // Clear cache by accessing private property if needed, or by ensuring unique prompts/options
        // Ideally we'd have a public clearCache method, but for now we'll rely on skipping cache in tests or using unique keys.
        // For "skipCache" options.
    });

    describe('generateContent', () => {
        it('should successfully generate content', async () => {
            const mockText = 'Test response from AI';
            const mockResponse = createMockWrappedResponse(mockText);

            // Setup mock implementation
            vi.mocked(firebaseAI.generateContent).mockResolvedValue({
                response: mockResponse.response
            } as any);

            const result = await aiService.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
                model: 'gemini-pro',
                skipCache: true
            });

            expect(result.text()).toBe(mockText);
            expect(firebaseAI.generateContent).toHaveBeenCalledTimes(1);
            expect(firebaseAI.generateContent).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
                'gemini-pro',
                undefined,
                undefined,
                undefined,
                expect.objectContaining({
                    signal: undefined
                })
            );
        });

        it('should handle rate limiting errors with retry', async () => {
            const mockText = 'Success after retry';
            const mockResponse = createMockWrappedResponse(mockText);

            // Mock rate limiter to avoid waiting in tests? 
            // The actual RateLimiter uses a real timer. We might need to mock RateLimiter or just simple retry logic.
            // Since we mocked firebaseAI, the internal AIService logic (rateLimiter.acquire) is still running.
            // We should fast-forward time or mock RateLimiter if it delays too long.
            // But AIService.ts imports RateLimiter.

            // Mock failures then success
            const error429: any = new Error('429 Too Many Requests');
            error429.code = 'resource-exhausted'; // Simulate gRPC error code style if needed

            vi.mocked(firebaseAI.generateContent)
                .mockRejectedValueOnce(error429)
                .mockResolvedValueOnce({ response: mockResponse.response } as any);

            // Use fake timers to skip the retry delay
            vi.useFakeTimers();

            const promise = aiService.generateContent({
                prompt: 'Retry me',
                skipCache: true
            });

            // Fast-forward through delays
            await vi.runAllTimersAsync();

            const result = await promise;

            expect(result.text()).toBe(mockText);
            expect(firebaseAI.generateContent).toHaveBeenCalledTimes(2);

            vi.useRealTimers();
        });

        it('should return cached response if available', async () => {
            const mockText = 'Cached response';
            const mockResponse = createMockWrappedResponse(mockText);

            vi.mocked(firebaseAI.generateContent).mockResolvedValue({
                response: mockResponse.response
            } as any);

            const options = {
                prompt: 'Cache me',
                model: 'gemini-pro'
            };

            // First call - misses cache
            await aiService.generateContent(options);

            // Second call - should hit cache
            const result2 = await aiService.generateContent(options);

            expect(result2.text()).toBe(mockText);
            expect(firebaseAI.generateContent).toHaveBeenCalledTimes(1); // Only called once
        });

        it('should handle timeout correctly', async () => {
            vi.mocked(firebaseAI.generateContent).mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 500)); // Simulate slow response
                return { response: createMockResponse('Slow') } as any;
            });

            // Use real timers, short timeout
            const promise = aiService.generateContent({
                prompt: 'Timeout me',
                timeout: 100, // 100ms timeout
                skipCache: true
            });

            await expect(promise).rejects.toThrow(AppException);
            await expect(promise).rejects.toThrow(/timed out/);
        });

        it('should handle AbortSignal', async () => {
            const controller = new AbortController();

            // Fix signature: prompt, model, config, systemInstruction, tools, options
            vi.mocked(firebaseAI.generateContent).mockImplementation(async (_prompt, _model, _config, _sys, _tools, options) => {
                const signal = options?.signal;
                return new Promise((resolve, reject) => {
                    // Check if already aborted
                    if (signal?.aborted) {
                        reject(new Error('AbortError'));
                        return;
                    }
                    signal?.addEventListener('abort', () => reject(new Error('AbortError')));
                });
            });

            const promise = aiService.generateContent({
                prompt: 'Abort me',
                signal: controller.signal,
                skipCache: true
            });

            // Abort immediately
            controller.abort();

            await expect(promise).rejects.toThrow(AppException);
            // Error message might vary depending on whether it was caught in `race` or `before start`
            await expect(promise).rejects.toThrow(/(cancelled)|(AbortError)/i);
        });
    });

    describe('generateContentStream', () => {
        it('should stream content successfully', async () => {
            const mockStream = {
                stream: new ReadableStream({
                    start(controller) {
                        controller.enqueue({ text: () => 'Chunk 1' });
                        controller.enqueue({ text: () => 'Chunk 2' });
                        controller.close();
                    }
                }),
                response: Promise.resolve({
                    response: createMockResponse('Chunk 1Chunk 2'),
                    text: () => 'Chunk 1Chunk 2',
                    functionCalls: () => [],
                    usage: () => undefined
                })
            };

            vi.mocked(firebaseAI.generateContentStream).mockResolvedValue(mockStream as any);

            const result = await aiService.generateContentStream({
                contents: [{ role: 'user', parts: [{ text: 'Stream me' }] }],
                model: 'gemini-pro'
            });

            expect(result.stream).toBeDefined();
            expect(result.response).toBeDefined();

            // Read stream
            const reader = result.stream.getReader();
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value.text());
            }

            expect(chunks).toEqual(['Chunk 1', 'Chunk 2']);
            expect(firebaseAI.generateContentStream).toHaveBeenCalled();
        });
    });
});
