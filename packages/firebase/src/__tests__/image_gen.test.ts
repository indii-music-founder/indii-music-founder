import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as admin from 'firebase-admin';


// Hoisted mocks for direct access in vi.mock
const mocks = vi.hoisted(() => {
    return {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
        createInteraction: vi.fn(),
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
            interactions = {
                create: mocks.createInteraction
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
    const mockDocRef = {
        id: 'mock-doc',
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
    };
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
        appCheck: vi.fn(() => ({
            verifyToken: vi.fn().mockResolvedValue({ appId: 'test-app' }),
        })),
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
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            log: vi.fn(),
        },
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

// Mock firebase-functions/v2 callables exported by functions/creative/gateway.ts.
vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_options: unknown, handler?: unknown) => handler ?? _options),
    onRequest: vi.fn((_options: unknown, handler?: unknown) => handler ?? _options),
    HttpsError: class extends Error {
        code: string;
        details?: unknown;
        constructor(code: string, message: string, details?: unknown) {
            super(message);
            this.code = code;
            this.details = details;
        }
    }
}));

// Mock firebase-functions/params
vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: mocks.secrets.value })),
    defineString: vi.fn(() => ({ value: vi.fn(() => 'mock-string-value') })),
    defineInt: vi.fn(() => ({ value: vi.fn(() => 0) })),
}));

vi.mock('../stripe/config', () => ({
    stripe: {}
}));

vi.mock('../email/sendEmail', () => ({ sendEmail: vi.fn() }));
vi.mock('../mcp', () => ({ mcpHttpHandler: vi.fn() }));
vi.mock('../orchestration', () => ({ orchestrationListener: vi.fn() }));

// Mock specific logic in index.ts if needed, but here we test the exported functions
import { generateImageV3, editImage, generateContentStream, enrichFanData, healthCheck, healthCheckWest1 } from '../index';

describe('Image and Content Generation Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateImageV3', () => {
        // Capture the shared default firestore instance so it can be restored
        // after overriding it below — otherwise the override leaks into
        // sibling describe blocks (e.g. editImage's runTransaction usage).
        const defaultFirestoreInstance = admin.firestore();

        afterEach(() => {
            vi.mocked(admin.firestore).mockReturnValue(defaultFirestoreInstance);
        });

        it('should call @google/genai SDK with correct parameters', async () => {
            const context: any = { auth: { uid: 'user123' } };
            const data = {
                prompt: 'a beautiful cat',
                aspectRatio: '1:1',
                count: 2,
                model: 'fast',
                // Required by GenerateImageSchema (ISSUE-881 cost-control gate) —
                // loadCostReservation() reads this from the costLedger collection.
                costReservationId: 'res-test-1'
            };

            // costLedger doc must resolve APPROVED for the authenticated user/type;
            // any other collection/doc falls back to the default mock's harmless
            // docRef (which safeDbSet's own internal try/catch tolerates).
            const defaultDocRef = { id: 'mock-doc', set: vi.fn().mockResolvedValue(undefined), update: vi.fn().mockResolvedValue(undefined) };
            const costLedgerDocRef = {
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({
                        userId: 'user123',
                        type: 'image',
                        status: 'APPROVED',
                        // The request asks for two outputs, so the reservation
                        // must cover the same batch count enforced by the gateway.
                        estimatedCost: 0.08,
                    }),
                }),
            };
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn((name: string) => ({
                    doc: vi.fn(() => (name === 'costLedger' ? costLedgerDocRef : defaultDocRef)),
                })),
                doc: vi.fn(() => costLedgerDocRef), // finalizeOperationReservation calls db.doc() directly
                runTransaction: vi.fn((fn: (tx: unknown) => Promise<void>) => fn({
                    get: vi.fn().mockResolvedValue({ data: () => undefined, exists: false }),
                    set: vi.fn(),
                    update: vi.fn(),
                })),
            } as any);

            mocks.createInteraction.mockResolvedValue({
                output_image: {
                    data: 'base64-image-1',
                    mime_type: 'image/png'
                }
            });

            const generateImageCall = generateImageV3 as any;
            const result = await generateImageCall({ data, auth: context.auth });

            expect(mocks.createInteraction).toHaveBeenCalledTimes(2);
            expect(mocks.createInteraction).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: 'gemini-3.1-flash-image',
                    input: [{ type: 'text', text: 'a beautiful cat' }],
                    response_modalities: ['image'],
                    generation_config: expect.objectContaining({
                        image_config: expect.objectContaining({
                            aspect_ratio: '1:1'
                        })
                    })
                })
            );

            expect(result).toEqual(expect.objectContaining({
                jobId: 'mock-doc',
                resultUri: expect.stringContaining('gs://'),
                resultUris: expect.arrayContaining([
                    expect.stringContaining('gs://'),
                    expect.stringContaining('gs://'),
                ]),
            }));
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
                        { text: expect.stringContaining('add a hat') },
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
                headers: {
                    authorization: 'Bearer token',
                    origin: 'http://localhost:4242',
                    'x-firebase-appcheck': 'app-check-token',
                },
                body: {
                    model: 'gemini-3.1-pro-preview',
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

    describe('healthCheck', () => {
        const createRes = () => ({
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn(),
        });

        it('returns 200 and connected status when Firestore ping succeeds', async () => {
            const req = {} as any;
            const res = createRes();
            const set = vi.fn().mockResolvedValue(undefined);
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn(() => ({
                    doc: vi.fn(() => ({ set })),
                })),
            } as any);

            await (healthCheck as any)(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 'ok',
                firestore: 'connected',
            }));
        });

        it('returns 200 and degraded status when Firestore ping fails', async () => {
            const req = {} as any;
            const res = createRes();
            const set = vi.fn().mockRejectedValue(new Error('firestore unavailable'));
            vi.mocked(admin.firestore).mockReturnValue({
                collection: vi.fn(() => ({
                    doc: vi.fn(() => ({ set })),
                })),
            } as any);

            await (healthCheck as any)(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 'degraded',
                firestore: 'error',
            }));
        });

        it('returns 200 from the regional health check', async () => {
            const req = {} as any;
            const res = createRes();

            await (healthCheckWest1 as any)(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                status: 'ok',
                region: 'us-central1',
            }));
        });
    });

    describe('enrichFanData', () => {
        beforeEach(() => {
            mocks.secrets.value.mockReturnValue('mock-api-key');
            vi.stubGlobal('fetch', vi.fn());
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it.each([
            { provider: 'Clearbit', label: 'Clearbit' },
            { provider: 'Apollo', label: 'Apollo' },
        ])('fails honestly when $label is unconfigured', async ({ provider, label }) => {
            mocks.secrets.value.mockReturnValueOnce('');

            const callEnrichFanData = enrichFanData as any;

            await expect(callEnrichFanData({
                fans: [{ email: 'fan@example.com' }],
                provider,
                orgId: 'personal',
            }, {
                auth: { uid: 'user123' },
            })).rejects.toMatchObject({
                code: 'failed-precondition',
                message: `${label} enrichment is unavailable because the API key is not configured.`,
            });

            expect(fetch).not.toHaveBeenCalled();
        });

        it('passes through real Clearbit enrichment results when configured', async () => {
            vi.mocked(fetch).mockResolvedValueOnce(
                new Response(JSON.stringify({
                    person: {
                        location: 'Nashville',
                        geo: { countryCode: 'US' },
                        seniority: 'director',
                        bio: 'Artist bio',
                        avatar: 'https://avatar.example/fan.jpg',
                    },
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            );

            const callEnrichFanData = enrichFanData as any;
            const result = await callEnrichFanData({
                fans: [{ email: 'fan@example.com' }],
                provider: 'Clearbit',
                orgId: 'personal',
            }, {
                auth: { uid: 'user123' },
            });

            expect(fetch).toHaveBeenCalledWith(
                'https://person.clearbit.com/v2/combined/find?email=fan%40example.com',
                expect.objectContaining({
                    headers: { Authorization: 'Bearer mock-api-key' },
                })
            );
            expect(result).toEqual({
                results: [
                    expect.objectContaining({
                        email: 'fan@example.com',
                        city: 'Nashville',
                        country: 'US',
                        provider: 'clearbit',
                        enrichmentScore: 85,
                    }),
                ],
                metadata: expect.objectContaining({
                    provider: 'clearbit',
                    count: 1,
                }),
            });
        });
    });
});
