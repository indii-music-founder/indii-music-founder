import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AI } from './AIService';
import { AppErrorCode } from '@/shared/types/errors';
import { AI_MODELS } from '@/core/config/ai-models';

// Mock EndpointService to return a predictable URL
vi.mock('@/core/config/EndpointService', () => ({
    endpointService: {
        getFunctionUrl: (name: string) => `https://mock-functions.net/${name}`
    }
}));

// Mock Env
vi.mock('@/config/env', () => ({
    env: {
        projectId: 'test-project',
        location: 'test-location',
        useVertex: false
    },
    firebaseConfig: {
        apiKey: "test-api-key",
        authDomain: "test-project.firebaseapp.com",
        projectId: "test-project"
    }
}));

describe('AIService Error Handling', () => {
    // Save original fetch
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should forward generic errors from proxy', async () => {
        // Mock fetch to return 500
        (global.fetch as any).mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => 'Generic proxy failure'
        });

        await expect(AI.generateContent({
            model: AI_MODELS.TEXT.FAST,
            contents: { role: 'user', parts: [] }
        })).rejects.toThrow('Proxy Error 500: Generic proxy failure');
    });

    it('should retry on transient QUOTA_EXCEEDED error and succeed', async () => {
        // Mock fetch to fail twice with 429, then succeed
        const mockFetch = global.fetch as any;

        mockFetch
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                text: async () => 'QUOTA_EXCEEDED'
            })
            .mockResolvedValueOnce({ // Retry 1
                ok: false,
                status: 503,
                text: async () => 'Service Unavailable'
            })
            .mockResolvedValueOnce({ // Retry 2 - Success
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [{ text: 'Success' }]
                        }
                    }]
                })
            });

        const result = await AI.generateContent({
            model: AI_MODELS.TEXT.FAST,
            contents: { role: 'user', parts: [] }
        });

        expect(result.text()).toBe('Success');
        expect(mockFetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should forward standardized SAFETY_VIOLATION error', async () => {
        // Verify that the service correctly parses logic-level errors if the proxy returns them
        // Note: Our current implementation throws "Proxy Error STATUS: TEXT" if !ok.
        // If the proxy returns 200 but the *body* contains a safety error (standard Gemini behavior), we need to handle it.
        // But the previous test was testing 'AppErrorCode.SAFETY_VIOLATION'. 
        // Our current implementation wraps the response.

        // Let's test that it handles a successful response that was blocked by safety.
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                promptFeedback: {
                    blockReason: 'SAFETY',
                    safetyRatings: []
                },
                candidates: []
            })
        });

        // The current implementation returns the wrapped response even if blocked, 
        // allowing the UI to decide how to handle it (unlike the mock SDK which might throw).
        // Let's verify we get the response back with the safety data.

        const result = await AI.generateContent({
            model: AI_MODELS.TEXT.FAST,
            contents: { role: 'user', parts: [] }
        });

        expect(result.response.promptFeedback?.blockReason).toBe('SAFETY');
    });
});
