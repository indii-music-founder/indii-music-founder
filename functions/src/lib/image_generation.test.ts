
import { generateImageV3Fn } from './image_generation';
import * as functions from 'firebase-functions-test';
import { GenerateImageRequest } from './image';

// Mock dependencies
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    firestore: () => ({
        collection: jest.fn(),
    }),
}));

const testEnv = functions();

describe('generateImageV3Fn', () => {
    let wrapped: any;
    const mockFetch = jest.fn();

    beforeAll(() => {
        global.fetch = mockFetch;
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
        const data: GenerateImageRequest = {
            prompt: 'test prompt',
            aspectRatio: '16:9',
            imageSize: '4k',
            count: 2,
            thinking: true,
            useGrounding: true
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
    });

    it('should fallback to default parameters', async () => {
        const data: GenerateImageRequest = {
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
        } catch (e) {
            // Expected error due to empty candidates in mock
        }

        const [url, options] = mockFetch.mock.calls[0];
        const body = JSON.parse(options.body);

        // Defaults from Zod schema
        expect(body.generationConfig.imageConfig).toEqual({
            imageSize: '1k'
        });
        expect(body.generationConfig.thinkingConfig).toBeUndefined();
    });
});
