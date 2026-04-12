import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { generateImageV3Fn } from './image_generation';
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
                predictions: [
                    {
                        bytesBase64Encoded: 'fake-base64-data',
                        mimeType: 'image/png'
                    }
                ]
            }),
        });

        await wrapped(data, context);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, options] = mockFetch.mock.calls[0];

        expect(url).toContain('gemini-'); // Just check it contains gemini for now or check the dynamic var

        const body = JSON.parse(options.body);
        expect(body.instances[0].prompt).toBe('test prompt');
        expect(body.parameters.aspectRatio).toBe('16:9');
        expect(body.parameters.sampleCount).toBe(2);
        expect(body.parameters.personGeneration).toBe('allow_adult');
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

        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                predictions: [
                    {
                        bytesBase64Encoded: 'fake-base64-data',
                        mimeType: 'image/png'
                    }
                ]
            }),
        });

        await wrapped(data, context);

        const [, options] = mockFetch.mock.calls[0];
        const body = JSON.parse(options.body);

        expect(body.instances[0].prompt).toBe('simple prompt');
        expect(body.parameters.aspectRatio).toBe('1:1');
        expect(body.parameters.sampleCount).toBe(1);
    });
});
