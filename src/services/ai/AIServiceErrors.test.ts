import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI } from './AIService';
import { AppErrorCode } from '@/shared/types/errors';
import { AI_MODELS } from '@/core/config/ai-models';

// Mock the Google Generative AI SDK
const mockGenerateContent = vi.fn();

class MockGoogleGenerativeAI {
    constructor(_apiKey: string) { }
    getGenerativeModel() {
        return {
            generateContent: mockGenerateContent
        };
    }
}

vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: MockGoogleGenerativeAI
}));

vi.mock('@/services/firebase', () => ({
    functions: {}
}));

vi.mock('@/config/env', () => ({
    env: {
        apiKey: 'test-key',
        projectId: 'test-project',
        location: 'test-location',
        useVertex: false,
        VITE_API_KEY: 'test-key',
        VITE_VERTEX_PROJECT_ID: 'test-project',
        VITE_VERTEX_LOCATION: 'test-location',
        VITE_USE_VERTEX: false
    }
}));

describe('AIService Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should forward generic errors', async () => {
        mockGenerateContent.mockRejectedValue(new Error('Generic failure'));

        await expect(AI.generateContent({
            model: AI_MODELS.TEXT.FAST,
            contents: { role: 'user', parts: [] }
        })).rejects.toThrow('Generic failure');
    });

    it('should forward standardized QUOTA_EXCEEDED error', async () => {
        const error: any = new Error('Quota exceeded');
        error.code = 'resource-exhausted';
        // Always reject to exhaust all retries (3 retries with exponential backoff: 1s + 2s + 4s = 7s)
        mockGenerateContent.mockRejectedValue(error);

        await expect(AI.generateContent({
            model: AI_MODELS.TEXT.FAST,
            contents: { role: 'user', parts: [] }
        })).rejects.toThrow(/Quota exceeded/);
    }, 15000); // Increase timeout to allow retries to exhaust

    it('should forward standardized SAFETY_VIOLATION error', async () => {
        const error: any = new Error('Safety violation');
        error.details = { code: AppErrorCode.SAFETY_VIOLATION };
        mockGenerateContent.mockRejectedValue(error);

        await expect(AI.generateContent({
            model: AI_MODELS.TEXT.FAST,
            contents: { role: 'user', parts: [] }
        })).rejects.toThrow(/Safety violation/);
    });

    it('should retry on transient QUOTA_EXCEEDED error and succeed', async () => {
        // Note: Error message must contain 'QUOTA_EXCEEDED' (exact case) or use specific error codes
        // that survive the AppException wrapping for retry to work
        const error: any = new Error('QUOTA_EXCEEDED');
        error.code = 'resource-exhausted';

        // Fail once, then succeed
        mockGenerateContent
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce({
                response: {
                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [{ text: 'Success' }]
                        }
                    }]
                }
            });

        const result = await AI.generateContent({
            model: AI_MODELS.TEXT.FAST,
            contents: { role: 'user', parts: [] }
        });

        expect(result.text()).toBe('Success');
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    }, 10000);
});
