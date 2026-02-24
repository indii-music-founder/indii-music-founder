import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService } from './AIService';
import { firebaseAI } from './FirebaseAIService';
import { AppErrorCode } from '@/shared/types/errors';

// Mock FirebaseAIService
vi.mock('./FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn(),
        generateText: vi.fn(),
        generateStructuredData: vi.fn(),
    }
}));

describe('AIService Timeout & Cancellation', () => {
    let aiService: AIService;

    beforeEach(() => {
        aiService = new (AIService as any)();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should throw TIMEOUT error when request exceeds default timeout', async () => {
        // Mock a request that takes longer than the timeout
        vi.mocked(firebaseAI.generateContent).mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return {} as any;
        });

        // Start the request with partial shorter timeout
        const requestPromise = aiService.generateContent({
            model: 'test-model',
            contents: { role: 'user', parts: [{ text: 'test' }] },
            timeout: 10 // 10ms timeout
        });

        await expect(requestPromise).rejects.toThrowError(
            expect.objectContaining({
                code: AppErrorCode.TIMEOUT
            })
        );
    });

    it('should throw CANCELLED error when signal is aborted', async () => {
        const controller = new AbortController();

        // Mock a request that waits long enough for abort to fire, and respects abort
        vi.mocked(firebaseAI.generateContent).mockImplementation(async (_p, _m, _c, _s, _t, opts) => {
            const signal = (opts as any)?.signal;
            return new Promise((_resolve, reject) => {
                const timer = setTimeout(() => _resolve({} as any), 500);
                if (signal) {
                    signal.addEventListener('abort', () => {
                        clearTimeout(timer);
                        const err = new Error('The operation was aborted');
                        err.name = 'AbortError';
                        reject(err);
                    });
                }
            });
        });

        const requestPromise = aiService.generateContent({
            model: 'test-model',
            contents: { role: 'user', parts: [{ text: 'test' }] },
            signal: controller.signal
        });

        // Trigger the abort after a tick so the listener is registered
        await new Promise(r => setTimeout(r, 5));
        controller.abort();

        await expect(requestPromise).rejects.toThrowError(
            expect.objectContaining({
                code: AppErrorCode.CANCELLED
            })
        );
    });

    it('should complete successfully if within timeout', async () => {
        vi.mocked(firebaseAI.generateContent).mockResolvedValue({
            response: {
                candidates: [
                    {
                        content: { role: 'model', parts: [{ text: 'Response' }] },
                        finishReason: 'STOP',
                        index: 0
                    }
                ],
                text: () => 'Response'
            }
        } as any);

        const requestPromise = aiService.generateContent({
            model: 'test-model',
            contents: { role: 'user', parts: [{ text: 'test' }] },
            timeout: 5000
        });

        const result = await requestPromise;
        expect(result.text()).toBe('Response');
    });
});
