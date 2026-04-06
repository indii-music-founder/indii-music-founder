import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { generateImageV3Fn } from './image_generation';
import functionsTest from 'firebase-functions-test';

// Mock firebase-admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: () => ({
        collection: vi.fn(),
    }),
}));

const testEnv = functionsTest();

describe('generateImageV3Fn', () => {
    let wrapped: any;
    const mockFetch = vi.fn();

    beforeAll(() => {
        global.fetch = mockFetch as any;
        // Mock secrets
        process.env.GEMINI_API_KEY = 'test-api-key';
    });

    beforeEach(() => {
        const func = generateImageV3Fn();
        wrapped = testEnv.wrap(func);
        mockFetch.mockClear();
    });

    afterAll(() => {
        testEnv.cleanup();
    });

    it('should construct correct payload with new parameters', async () => {
        const data: any = {
            prompt: 'test prompt',
            aspectRatio: '16:9',
            imageSize: '4k',
            count: 2,
            thinking: true,
            useGrounding: true,
            model: 'pro'
        };

        const context = {
            auth: {
                uid: 'test-user-id',
            },
        };

        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: 'image/png',
                                        data: 'fake-base64-data',
                                    },
                                },
                            ],
                        },
                    },
                ],
            }),
        });

        await wrapped(data, context);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, options] = mockFetch.mock.calls[0];

        expect(url).toContain('gemini-3-pro-image-preview');

        const body = JSON.parse(options.body);
        expect(body.generationConfig.temperature).toBe(1.0);
        expect(body.generationConfig.imageConfig).toEqual({
            aspectRatio: '16:9',
            imageSize: '4k',
        });
        expect(body.generationConfig.thinkingConfig).toEqual({
            thinkingLevel: 'HIGH',
        });
        expect(body.generationConfig.groundingConfig).toEqual({
            searchGrounding: { enableSearch: true },
        });
        // mediaResolution should NOT be present (v1alpha only)
        expect(body.generationConfig.mediaResolution).toBeUndefined();
    });

    it('should fallback to default parameters', async () => {
        const data: any = {
            prompt: 'simple prompt',
        };

        const context = {
            auth: {
                uid: 'test-user-id',
            },
        };

        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [],
                        },
                    },
                ],
            }),
        });

        // It might throw because we mocked an empty response, but we care about the request
        try {
            await wrapped(data, context);
        } catch (_e) {
            // Expected error due to empty candidates in mock
        }

        const [, options] = mockFetch.mock.calls[0];
        const body = JSON.parse(options.body);

        // Required temperature
        expect(body.generationConfig.temperature).toBe(1.0);
        // Defaults from Zod schema
        expect(body.generationConfig.imageConfig).toEqual({
            imageSize: '1k'
        });
        expect(body.generationConfig.thinkingConfig).toBeUndefined();
        // mediaResolution should NOT be present
        expect(body.generationConfig.mediaResolution).toBeUndefined();
    });
});
