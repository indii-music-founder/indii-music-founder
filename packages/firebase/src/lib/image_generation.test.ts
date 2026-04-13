import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { generateImageV3Fn } from './image_generation';
import functionsTest from 'firebase-functions-test';
import { GoogleGenAI } from '@google/genai';

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
    GoogleGenAI: vi.fn(function() {
        return {
            models: {
                generateContent: mockGenerateContent
            }
        } as any;
    })
}));

const testEnv = functionsTest();

describe('generateImageV3Fn', () => {
    let wrapped: any;

    beforeAll(() => {
        // Mock secrets
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

        await wrapped(data, context);

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const callArgs = mockGenerateContent.mock.calls[0][0];

        expect(callArgs.contents[0].parts[0].text).toBe('test prompt');
        expect(callArgs.config.imageConfig.aspectRatio).toBe('16:9');
        // Note: candidateCount for pro is hardcoded to 1 per changes in library
        expect(callArgs.config.candidateCount).toBe(1);
    });

    it('should fallback to default parameters', async () => {
        const data: any = {
            prompt: 'simple prompt',
            model: 'pro'
        };

        const context = {
            auth: {
                uid: 'test-user-id',
            },
        };

        await wrapped(data, context);

        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        const callArgs = mockGenerateContent.mock.calls[0][0];

        expect(callArgs.contents[0].parts[0].text).toBe('simple prompt');
        expect(callArgs.config.imageConfig.aspectRatio).toBe('1:1');
        expect(callArgs.config.candidateCount).toBe(1);
    });
});
