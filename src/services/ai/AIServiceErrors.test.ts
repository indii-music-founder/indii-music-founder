import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI } from './AIService';
import { AppErrorCode } from '@/shared/types/errors';

// Mock dependencies
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: () => mockHttpsCallable
}));

vi.mock('@/services/firebase', () => ({
    functions: {}
}));

vi.mock('@/config/env', () => ({
    env: {
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
        mockHttpsCallable.mockRejectedValue(new Error('Generic failure'));

        await expect(AI.generateContent({
            model: 'gemini-pro',
            contents: { role: 'user', parts: [] }
        })).rejects.toThrow('Generate Content Failed: Generic failure');
    });

    it('should forward standardized QUOTA_EXCEEDED error', async () => {
        const error: any = new Error('Quota exceeded');
        error.details = { code: AppErrorCode.QUOTA_EXCEEDED };
        mockHttpsCallable.mockRejectedValue(error);

        await expect(AI.generateContent({
            model: 'gemini-pro',
            contents: { role: 'user', parts: [] }
        })).rejects.toThrow('[QUOTA_EXCEEDED] Quota exceeded');
    });

    it('should forward standardized SAFETY_VIOLATION error', async () => {
        const error: any = new Error('Safety violation');
        error.details = { code: AppErrorCode.SAFETY_VIOLATION };
        mockHttpsCallable.mockRejectedValue(error);

        await expect(AI.generateContent({
            model: 'gemini-pro',
            contents: { role: 'user', parts: [] }
        })).rejects.toThrow('[SAFETY_VIOLATION] Safety violation');
    });

    it('should retry on transient QUOTA_EXCEEDED error and succeed', async () => {
        const error: any = new Error('Quota exceeded');
        error.details = { code: AppErrorCode.QUOTA_EXCEEDED };

        // Fail once, then succeed
        mockHttpsCallable
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce({ data: { candidates: [{ content: { parts: [{ text: 'Success' }] } }] } });

        const result = await AI.generateContent({
            model: 'gemini-pro',
            contents: { role: 'user', parts: [] }
        });

        expect(result.text()).toBe('Success');
        expect(mockHttpsCallable).toHaveBeenCalledTimes(2);
    });
});
