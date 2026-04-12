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

// Mock @google/genai
vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: class {
            models = {
                generateContent: mocks.generateContent,
                generateContentStream: mocks.generateContentStream,
                generateImages: mocks.generateImages,
                editImage: mocks.editImage
            };
        }
    };
});

// Mock cors — must return a Promise so onRequest handlers can be awaited
vi.mock('cors', () => {
    return {
        default: () => (_req: any, _res: any, next: any) => Promise.resolve(next())
    };
});

// Mock firebase-admin
vi.mock('firebase-admin', () => {
    const mockDocRef = { id: 'mock-doc' };
    const mockTx = {
        get: vi.fn().mockResolvedValue({ data: () => undefined, exists: false }),
        set: vi.fn(),
        update: vi.fn(),
    };
    const firestoreInstance = {
        collection: vi.fn(() => ({
            doc: vi.fn(() => mockDocRef),
        })),
        runTransaction: vi.fn((fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
    };
    const firestoreFn = Object.assign(
        vi.fn(() => firestoreInstance),
        {
            FieldValue: {
                serverTimestamp: vi.fn(() => 'TIMESTAMP'),
                increment: vi.fn((n: number) => n),
            },
        }
    );
    return {
        initializeApp: vi.fn(),
        auth: vi.fn(),
        firestore: firestoreFn,
        storage: vi.fn(() => ({
            bucket: vi.fn(() => ({
                file: vi.fn(() => ({
                    save: vi.fn().mockResolvedValue(undefined),
                    makePublic: vi.fn().mockResolvedValue(undefined),
                    publicUrl: () => 'https://mock-storage-url.com/image.png',
                })),
            })),
        })),
        apps: [{ name: '[DEFAULT]' }],
    };
});

// Mock firebase-functions/v1 — must include full builder chain because
// importing from ../index triggers storageMaintenance.ts which uses
// .region().runWith().pubsub.schedule().timeZone().onRun()
vi.mock('firebase-functions/v1', () => {
    const handler = vi.fn((fn: unknown) => fn);
    const scheduleBuilder = { timeZone: vi.fn().mockReturnThis(), onRun: handler };
    const topicBuilder = { onPublish: handler };
    const docBuilder = { onCreate: handler, onUpdate: handler, onDelete: handler, onWrite: handler };
    const objectBuilder = { onArchive: handler, onDelete: handler, onFinalize: handler, onMetadataUpdate: handler };

    const builder: Record<string, unknown> = {
        region: vi.fn().mockReturnThis(),
        runWith: vi.fn().mockReturnThis(),
        pubsub: {
            schedule: vi.fn(() => scheduleBuilder),
            topic: vi.fn(() => topicBuilder),
        },
        firestore: { document: vi.fn(() => docBuilder) },
        storage: {
            bucket: vi.fn().mockReturnValue({ object: vi.fn(() => objectBuilder) }),
            object: vi.fn(() => objectBuilder),
        },
        https: {
            onCall: vi.fn((fn: unknown) => fn),
            onRequest: vi.fn((fn: unknown) => fn),
            HttpsError: class extends Error {
                code: string;
                constructor(code: string, message: string) {
                    super(message);
                    this.code = code;
                }
            },
        },
        config: vi.fn(() => ({})),
    };
    (builder.region as ReturnType<typeof vi.fn>).mockReturnValue(builder);
    (builder.runWith as ReturnType<typeof vi.fn>).mockReturnValue(builder);
    return builder;
});

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
        it('should call @google/genai SDK with correct parameters', async () => {
            const context: any = { auth: { uid: 'user123' } };
            const data = {
                prompt: 'a beautiful cat',
                aspectRatio: '1:1',
                count: 2,
                model: 'fast'
            };

            mocks.generateContent.mockResolvedValue({
                candidates: [{
                    content: {
                        parts: [
                            { inlineData: { data: 'base64-image-1', mimeType: 'image/png' } },
                            { inlineData: { data: 'base64-image-2', mimeType: 'image/png' } }
                        ]
                    }
                }]
            });

            const generateImageCall = generateImageV3 as any;
            const result = await generateImageCall(data, context);

            expect(mocks.generateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gemini-3-flash-preview',
                    contents: [{ role: "user", parts: [{ text: 'a beautiful cat' }] }],
                    config: expect.objectContaining({
                        candidateCount: 2,
                        responseModalities: ["IMAGE"]
                    })
                })
            );

            expect(result).toEqual({
                images: [
                    { bytesBase64Encoded: 'base64-image-1', mimeType: 'image/png' },
                    { bytesBase64Encoded: 'base64-image-2', mimeType: 'image/png' }
                ],
                aiMetadata: expect.any(Object),
                aiGenerationInfo: expect.any(Object)
            });
        });
    });

    describe('editImage', () => {
        it('should construct multimodal parts correctly', async () => {
            const context: any = { auth: { uid: 'user123' } };
            const data = {
                prompt: 'add a hat',
                image: 'base64-orig',
                imageMimeType: 'image/png',
                mask: 'base64-mask',
                maskMimeType: 'image/png'
            };

            mocks.generateContent.mockResolvedValue({
                candidates: [{
                    content: {
                        parts: [{ inlineData: { data: 'base64-edited', mimeType: 'image/png' } }]
                    }
                }]
            });

            const editImageCall = editImage as any;
            await editImageCall(data, context);

            expect(mocks.generateContent).toHaveBeenCalledWith(expect.objectContaining({
                contents: [{
                    role: 'user',
                    parts: expect.arrayContaining([
                        { text: 'Edit the masked region of this image: add a hat' },
                        { inlineData: { data: 'base64-orig', mimeType: 'image/png' } },
                        { inlineData: { data: 'base64-mask', mimeType: 'image/png' } }
                    ])
                }]
            }));
        });
    });

    describe('generateContentStream', () => {
        it('should yield chunks from SDK stream', async () => {
            const req: any = {
                method: 'POST',
                headers: { authorization: 'Bearer token', origin: 'http://localhost:4242' },
                body: {
                    model: 'gemini-3-pro-preview',
                    contents: [{ role: 'user', parts: [{ text: 'say hello' }] }]
                }
            };
            const headers: Record<string, string> = {};
            const res: any = {
                setHeader: vi.fn((key: string, val: string) => { headers[key] = val; }),
                getHeader: vi.fn((key: string) => headers[key]),
                writeHead: vi.fn(),
                write: vi.fn(),
                end: vi.fn(),
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
                statusCode: 200,
                headersSent: false,
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

            // The onRequest handler fires corsHandler which runs the async
            // callback on a microtask. We create a deferred that resolves
            // on EITHER the happy path (res.end) or error path (res.send).
            const done = new Promise<void>((resolve) => {
                const origEnd = res.end;
                res.end = vi.fn().mockImplementation((...args: unknown[]) => {
                    origEnd(...args);
                    resolve();
                });
                const origSend = res.send;
                res.send = vi.fn().mockImplementation((...args: unknown[]) => {
                    origSend(...args);
                    resolve();
                });
            });

            generateContentStream(req, res);
            await done;

            expect(res.write).toHaveBeenCalledWith(JSON.stringify({ text: 'Hello' }) + '\n');
            expect(res.write).toHaveBeenCalledWith(JSON.stringify({ text: ' world' }) + '\n');
            expect(res.end).toHaveBeenCalled();

        });
    });
});
