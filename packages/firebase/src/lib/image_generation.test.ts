import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { generateImageV3Fn, editImageFn } from './image_generation';
import functionsTest from 'firebase-functions-test';

// Mock firebase-admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: () => ({}),
}));

vi.mock('./rateLimit', () => ({
    enforceRateLimit: vi.fn().mockResolvedValue(undefined),
    RATE_LIMITS: { generation: 10 }
}));

vi.mock('google-auth-library', () => ({
    GoogleAuth: class {
        getClient() {
            return Promise.resolve({
                getAccessToken: () => Promise.resolve({ token: 'mock-token' })
            });
        }
        getProjectId() {
            return Promise.resolve('mock-project-id');
        }
    }
}));

const mockGenerateContent = vi.fn().mockResolvedValue({
    candidates: [{
        content: {
            parts: [{
                inlineData: {
                    data: 'fake-base64-data',
                    mimeType: 'image/png'
                }
            }]
        }
    }]
});

vi.mock('@google/genai', () => ({
    GoogleGenAI: vi.fn(function () {
        return {
            models: {
                generateContent: mockGenerateContent
            }
        } as any;
    })
}));

const testEnv = functionsTest();

// ============================================================================
// generateImageV3Fn Tests
// ============================================================================

describe('generateImageV3Fn', () => {
    let wrapped: any;

    beforeAll(() => {
        process.env.GEMINI_API_KEY = 'test-api-key';
    });

    beforeEach(() => {
        const func = generateImageV3Fn();
        wrapped = testEnv.wrap(func);
        mockGenerateContent.mockClear();
    });

    afterAll(() => {
        testEnv.cleanup();
    });

    it('should construct correct payload with full Gemini 3 parameters', async () => {
        const data: any = {
            prompt: 'test prompt',
            aspectRatio: '16:9',
            imageSize: '4k', // lowercase — schema normalizes to '4K'
            count: 2,
            model: 'pro', // Pro tier
            thinkingLevel: 'high',
            useGoogleSearch: true,
            responseFormat: 'image_and_text',
        };

        const context = {
            auth: { uid: 'test-user-id' },
        };

        await wrapped(data, context);

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const callArgs = mockGenerateContent.mock.calls[0][0];

        // Model should be Pro
        expect(callArgs.model).toBe('gemini-3-pro-image-preview');
        // Prompt should be in contents
        expect(callArgs.contents[0].parts[0].text).toBe('test prompt');
        // imageConfig should have aspectRatio and uppercase imageSize
        expect(callArgs.config.imageConfig.aspectRatio).toBe('16:9');
        expect(callArgs.config.imageConfig.imageSize).toBe('4K'); // Uppercase!
        // Pro does NOT set candidateCount (always returns 1)
        expect(callArgs.config.candidateCount).toBeUndefined();
        // Response modalities for interleaved
        expect(callArgs.config.responseModalities).toEqual(['TEXT', 'IMAGE']);
        // Grounding tools
        expect(callArgs.config.tools).toEqual([{ googleSearch: {} }]);
    });

    it('should use fast model with correct defaults', async () => {
        const data: any = {
            prompt: 'simple prompt',
            model: 'fast',
            count: 3,
        };

        const context = {
            auth: { uid: 'test-user-id' },
        };

        await wrapped(data, context);

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const callArgs = mockGenerateContent.mock.calls[0][0];

        // Model should be Fast
        expect(callArgs.model).toBe('gemini-3.1-flash-image-preview');
        // Fast supports candidateCount
        expect(callArgs.config.candidateCount).toBe(3);
        // Default response modalities: image only
        expect(callArgs.config.responseModalities).toEqual(['IMAGE']);
        // No tools
        expect(callArgs.config.tools).toBeUndefined();
    });

    it('should use legacy model when specified', async () => {
        const data: any = {
            prompt: 'legacy prompt',
            model: 'legacy',
        };

        const context = {
            auth: { uid: 'test-user-id' },
        };

        await wrapped(data, context);

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const callArgs = mockGenerateContent.mock.calls[0][0];

        expect(callArgs.model).toBe('gemini-2.5-flash-image');
    });

    it('should handle reference images in contents', async () => {
        const data: any = {
            prompt: 'generate with reference',
            images: [
                { mimeType: 'image/png', data: 'ref-image-base64' },
                { mimeType: 'image/jpeg', data: 'ref-image-2-base64' },
            ],
        };

        const context = {
            auth: { uid: 'test-user-id' },
        };

        await wrapped(data, context);

        const callArgs = mockGenerateContent.mock.calls[0][0];
        // Should have text prompt + 2 reference images in parts
        const parts = callArgs.contents[0].parts;
        expect(parts.length).toBe(3); // text + 2 images
        expect(parts[0].text).toBe('generate with reference');
        expect(parts[1].inlineData.mimeType).toBe('image/png');
        expect(parts[2].inlineData.mimeType).toBe('image/jpeg');
    });

    it('should handle conversation history for multi-turn', async () => {
        const data: any = {
            prompt: 'make it bluer',
            conversationHistory: [
                { role: 'user', parts: [{ text: 'generate a landscape' }] },
                { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: 'prev-img' } }] },
            ],
        };

        const context = {
            auth: { uid: 'test-user-id' },
        };

        await wrapped(data, context);

        const callArgs = mockGenerateContent.mock.calls[0][0];
        // Should have 3 turns: 2 from history + 1 new
        expect(callArgs.contents.length).toBe(3);
        expect(callArgs.contents[0].role).toBe('user');
        expect(callArgs.contents[1].role).toBe('model');
        expect(callArgs.contents[2].role).toBe('user');
        expect(callArgs.contents[2].parts[0].text).toBe('make it bluer');
    });

    it('should extract thoughtSignature from response', async () => {
        mockGenerateContent.mockResolvedValueOnce({
            candidates: [{
                content: {
                    parts: [
                        { inlineData: { data: 'img-data', mimeType: 'image/png' }, thoughtSignature: 'abc123' },
                    ]
                }
            }]
        });

        const data: any = { prompt: 'test', model: 'pro' };
        const context = { auth: { uid: 'test-user-id' } };

        const result = await wrapped(data, context) as any;
        expect(result.thoughtSignature).toBe('abc123');
    });

    it('should handle Flash + Image Search grounding', async () => {
        const data: any = {
            prompt: 'test with image search',
            model: 'fast',
            useGoogleSearch: true,
            useImageSearch: true,
        };

        const context = { auth: { uid: 'test-user-id' } };
        await wrapped(data, context);

        const callArgs = mockGenerateContent.mock.calls[0][0];
        expect(callArgs.config.tools).toEqual([{
            googleSearch: {
                searchTypes: {
                    webSearch: {},
                    imageSearch: {},
                },
            },
        }]);
    });

    it('should support all 14 aspect ratios for fast tier', async () => {
        const allRatios = ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'];

        for (const ratio of allRatios) {
            mockGenerateContent.mockClear();

            const data: any = { prompt: 'test', model: 'fast', aspectRatio: ratio };
            const context = { auth: { uid: 'test-user-id' } };

            await wrapped(data, context);
            const callArgs = mockGenerateContent.mock.calls[0][0];
            expect(callArgs.config.imageConfig.aspectRatio).toBe(ratio);
        }
    });

    it('should reject unauthenticated requests', async () => {
        const data: any = { prompt: 'test' };
        const context = {}; // No auth

        await expect(wrapped(data, context)).rejects.toThrow(/authenticated/);
    });

    it('should reject invalid prompts', async () => {
        const data: any = { prompt: '' };
        const context = { auth: { uid: 'test-user-id' } };

        await expect(wrapped(data, context)).rejects.toThrow(/Validation/);
    });

    it('should handle backward-compatible legacy fields', async () => {
        const data: any = {
            prompt: 'legacy call',
            thinking: true, // Deprecated field
            useGrounding: true, // Deprecated field
            model: 'fast',
        };

        const context = { auth: { uid: 'test-user-id' } };
        await wrapped(data, context);

        const callArgs = mockGenerateContent.mock.calls[0][0];
        // `thinking: true` should map to thinkingLevel "high" via compat logic
        expect(callArgs.config.thinkingConfig.thinkingLevel).toBe('High');
        // `useGrounding: true` should enable googleSearch tool
        expect(callArgs.config.tools).toEqual([{ googleSearch: {} }]);
    });
});

// ============================================================================
// editImageFn Tests
// ============================================================================

describe('editImageFn', () => {
    let wrapped: any;

    beforeAll(() => {
        process.env.GEMINI_API_KEY = 'test-api-key';
    });

    beforeEach(() => {
        const func = editImageFn();
        wrapped = testEnv.wrap(func);
        mockGenerateContent.mockClear();
    });

    it('should construct correct edit payload', async () => {
        const data: any = {
            image: 'source-base64',
            imageMimeType: 'image/png',
            prompt: 'remove the background',
        };

        const context = { auth: { uid: 'test-user-id' } };
        await wrapped(data, context);

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const callArgs = mockGenerateContent.mock.calls[0][0];

        // Default model for editing is Pro
        expect(callArgs.model).toBe('gemini-3-pro-image-preview');
        // Should have text prompt + source image in parts
        const parts = callArgs.contents[0].parts;
        expect(parts.length).toBe(2); // text + image
    });

    it('should include mask in edit payload', async () => {
        const data: any = {
            image: 'source-base64',
            imageMimeType: 'image/png',
            mask: 'mask-base64',
            maskMimeType: 'image/png',
            prompt: 'replace masked area with flowers',
        };

        const context = { auth: { uid: 'test-user-id' } };
        await wrapped(data, context);

        const callArgs = mockGenerateContent.mock.calls[0][0];
        const parts = callArgs.contents[0].parts;
        // text + source image + mask = 3 parts
        expect(parts.length).toBe(3);
    });

    it('should pass reference images array', async () => {
        const data: any = {
            image: 'source-base64',
            imageMimeType: 'image/png',
            prompt: 'blend with references',
            referenceImages: [
                { mimeType: 'image/png', data: 'ref1' },
                { mimeType: 'image/jpeg', data: 'ref2' },
            ],
        };

        const context = { auth: { uid: 'test-user-id' } };
        await wrapped(data, context);

        const callArgs = mockGenerateContent.mock.calls[0][0];
        const parts = callArgs.contents[0].parts;
        // text + source + 2 refs = 4
        expect(parts.length).toBe(4);
    });

    it('should reject unauthenticated edit requests', async () => {
        const data: any = { image: 'test', prompt: 'test' };
        const context = {};
        await expect(wrapped(data, context)).rejects.toThrow(/authenticated/);
    });
});
