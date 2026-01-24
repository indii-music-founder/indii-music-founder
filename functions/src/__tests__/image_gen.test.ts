import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';

// Hoisted mocks for direct access in vi.mock
const mocks = vi.hoisted(() => {
    return {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
        generateImages: vi.fn(),
        editImage: vi.fn(),
        secrets: {
            value: vi.fn(() => 'mock-api-key')
        }
    };
});

// Mock global.fetch
global.fetch = vi.fn();

// Mock firebase-admin
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    auth: vi.fn(),
    firestore: vi.fn()
}));

// Mock firebase-functions
vi.mock('firebase-functions/v1', () => ({
    runWith: vi.fn().mockReturnThis(),
    region: vi.fn().mockReturnThis(),
    https: {
        onCall: vi.fn((handler) => handler),
        onRequest: vi.fn((handler) => handler),
        HttpsError: class extends Error {
            code: string;
            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        }
    },
    config: vi.fn(() => ({}))
}));

// Mock firebase-functions/params
vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: mocks.secrets.value }))
}));

// Mock specific logic in index.ts if needed, but here we test the exported functions
import { generateImageV3, editImage, generateContentStream } from '../index';

describe('Image and Content Generation Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateImageV3', () => {
        it('should call Gemini REST API with correct parameters', async () => {
            const context: any = { auth: { uid: 'user123' } };
            const data = {
                prompt: 'a beautiful cat',
                aspectRatio: '1:1',
                count: 2
            };

            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            role: 'model',
                            parts: [
                                { inlineData: { data: 'base64-image-1', mimeType: 'image/png' }, thoughtSignature: 'sig1' },
                                { inlineData: { data: 'base64-image-2', mimeType: 'image/png' }, thoughtSignature: 'sig2' }
                            ]
                        }
                    }]
                })
            } as any);

            const result = await generateImageV3(data, context);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('generativelanguage.googleapis.com'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"text":"a beautiful cat"')
                })
            );

            expect(result).toEqual({
                images: [
                    { bytesBase64Encoded: 'base64-image-1', mimeType: 'image/png', thoughtSignature: 'sig1' },
                    { bytesBase64Encoded: 'base64-image-2', mimeType: 'image/png', thoughtSignature: 'sig2' }
                ]
            });
        });
    });

    describe('editImage', () => {
        it('should construct multimodal parts correctly with dummy signature if history is missing', async () => {
            const context: any = { auth: { uid: 'user123' } };
            const data = {
                prompt: 'add a hat',
                image: 'base64-orig',
                imageMimeType: 'image/png',
                mask: 'base64-mask',
                maskMimeType: 'image/png'
            };

            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{ inlineData: { data: 'base64-edited', mimeType: 'image/png' }, thoughtSignature: 'sig-edit' }]
                        }
                    }]
                })
            } as any);

            const result = await editImage(data, context);

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('generativelanguage.googleapis.com'),
                expect.objectContaining({
                    body: expect.stringContaining('context_engineering_is_the_way_to_go')
                })
            );

            expect(result).toEqual({
                images: [
                    { bytesBase64Encoded: 'base64-edited', mimeType: 'image/png', thoughtSignature: 'sig-edit' }
                ]
            });
        });
    });


    describe('generateContentStream', () => {
        it('should yield chunks from SDK stream', async () => {
            const req: any = {
                headers: { authorization: 'Bearer token' },
                body: {
                    model: 'gemini-3-pro-preview',
                    contents: [{ role: 'user', parts: [{ text: 'say hello' }] }]
                }
            };
            const res: any = {
                setHeader: vi.fn(),
                write: vi.fn(),
                end: vi.fn(),
                status: vi.fn().mockReturnThis()
            };

            // Mock admin.auth().verifyIdToken
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user123' })
            } as any);

            // Mock AsyncGenerator
            async function* mockStream() {
                yield { text: 'Hello' };
                yield { text: ' world' };
            }

            mocks.generateContentStream.mockResolvedValue(mockStream());

            await generateContentStream(req, res);

            expect(res.write).toHaveBeenCalledWith(JSON.stringify({ text: 'Hello' }) + '\n');
            expect(res.write).toHaveBeenCalledWith(JSON.stringify({ text: ' world' }) + '\n');
            expect(res.end).toHaveBeenCalled();
        });
    });
});
