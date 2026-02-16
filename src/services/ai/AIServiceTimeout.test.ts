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

        // Mock a request that never completes unless we abort it
        vi.mocked(firebaseAI.generateContent).mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 500));
            return {} as any;
        });

        const requestPromise = aiService.generateContent({
            model: 'test-model',
            contents: { role: 'user', parts: [{ text: 'test' }] },
            signal: controller.signal
        });

        // Trigger the abort immediately
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
                ]
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
