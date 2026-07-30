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
        },
        enforceRateLimit: vi.fn().mockResolvedValue(undefined),
        claimReservation: vi.fn().mockResolvedValue(undefined),
        finalizeReservation: vi.fn().mockResolvedValue(undefined),
    };
});

vi.mock('../lib/rateLimit', () => ({
    enforceRateLimit: mocks.enforceRateLimit,
    RATE_LIMITS: {
        generation: { maxRequests: 10, windowMs: 60_000 },
    },
}));

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

vi.mock('../functions/auth/entitlements', () => ({
    requireVerifiedServerEntitlement: vi.fn().mockResolvedValue({ tier: 'free' }),
    entitlementTierToBudgetTier: vi.fn(() => 'free'),
}));
vi.mock('../functions/security/arcjet', () => ({
    protectAuthenticatedApiRequest: vi.fn().mockResolvedValue({ allowed: true }),
    policyClassForServerEntitlement: vi.fn(() => 'verified-free'),
}));
vi.mock('../functions/creative/legacyAdmission', () => ({
    requireVerifiedCreativeAdmission: vi.fn(async (request: { auth?: { uid?: string } }) => {
        if (!request.auth?.uid) throw new Error('User must be authenticated.');
        return { userId: request.auth.uid, entitlement: { tier: 'free' } };
    }),
}));
vi.mock('../functions/billing/enforceOperationCost', () => ({
    checkOperationBudget: vi.fn().mockResolvedValue({ allowed: true, operationId: 'legacy-image-op-1' }),
    finalizeOperationReservation: mocks.finalizeReservation,
    claimOperationReservation: mocks.claimReservation,
    requireVerifiedCreativeUser: vi.fn((auth: { uid?: string; token?: Record<string, unknown> } | undefined) => {
        if (!auth?.uid) throw new Error('User must be authenticated.');
        if (auth.token?.email_verified !== true) throw new Error('Verify your email before using creative generation.');
        return auth.uid;
    }),
    getOperationCostHistory: vi.fn(),
    getOperationCostStatus: vi.fn(),
    expireStaleOperationCostReservations: vi.fn(),
}));

vi.mock('../email/sendEmail', () => ({ sendEmail: vi.fn() }));
vi.mock('../mcp', () => ({ mcpHttpHandler: vi.fn() }));
vi.mock('../orchestration', () => ({ orchestrationListener: vi.fn() }));

// Mock specific logic in index.ts if needed, but here we test the exported functions
import { generateImageV3, editImage, generateContentStream, enrichFanData, healthCheck, healthCheckWest1 } from '../index';

describe('Image and Content Generation Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.enforceRateLimit.mockResolvedValue(undefined);
    });

    describe('generateImageV3', () => {
        // Capture the shared default firestore instance so it can be restored
        // after overriding it below — otherwise the override leaks into
        // sibling describe blocks (e.g. editImage's runTransaction usage).
        const defaultFirestoreInstance = admin.firestore();

        afterEach(() => {
            vi.mocked(admin.firestore).mockReturnValue(defaultFirestoreInstance);
        });

        it('sends validated parameters through the backend Vertex client', async () => {
            const context: any = { auth: { uid: 'user123', token: { email_verified: true } } };
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
                    model: 'gemini-3.1-flash-image-preview',
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
            await editImageCall({ ...context, data });

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
        it('returns a truthful typed application-capacity error before provider submission', async () => {
            const req: any = {
                method: 'POST',
                headers: {
                    authorization: 'Bearer token',
                    origin: 'http://localhost:4242',
                    'x-firebase-appcheck': 'app-check-token',
                },
                body: {
                    costReservationId: 'agent-stream-op-1',
                    model: 'gemini-3.1-pro-preview',
                    contents: [{ role: 'user', parts: [{ text: 'create an image of a dog' }] }],
                },
            };
            const res: any = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
                send: vi.fn(),
                end: vi.fn(),
            };
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user123', email_verified: true }),
            } as any);
            const limited = new Error('application limit reached') as Error & { code: string };
            limited.code = 'resource-exhausted';
            mocks.enforceRateLimit.mockRejectedValueOnce(limited);

            generateContentStream(req, res);
            await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(429));

            expect(res.json).toHaveBeenCalledWith({
                error: {
                    code: 'GENERATION_CAPACITY_LIMITED',
                    message: 'Boardroom is temporarily at capacity. Your request was not sent for generation.',
                    retryable: true,
                    retryAfterSeconds: 60,
                    category: 'application_rate_limit',
                    nextActions: ['retry_after_wait'],
                    providerSubmitted: false,
                },
            });
            expect(mocks.generateContentStream).not.toHaveBeenCalled();
            expect(mocks.claimReservation).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user123', operationId: 'agent-stream-op-1', operationType: 'agent_stream',
            }));
            expect(mocks.finalizeReservation).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'VOIDED' }));
            expect(mocks.finalizeReservation.mock.invocationCallOrder[0]).toBeLessThan(res.json.mock.invocationCallOrder[0]);
        });
        it('should yield chunks from SDK stream', async () => {
            const req: any = {
                method: 'POST',
                headers: {
                    authorization: 'Bearer token',
                    origin: 'http://localhost:4242',
                    'x-firebase-appcheck': 'app-check-token',
                },
                body: {
                    costReservationId: 'agent-stream-op-1',
                    model: 'gemini-3.1-pro-preview',
                    contents: [{ role: 'user', parts: [{ text: 'say hello' }] }],
                    config: { maxOutputTokens: 100_000 },
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
                verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user123', email_verified: true })
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
            expect(mocks.generateContentStream).toHaveBeenCalledWith(expect.objectContaining({
                config: expect.objectContaining({ maxOutputTokens: 1_024 }),
            }));
            expect(mocks.claimReservation.mock.invocationCallOrder[0]).toBeLessThan(mocks.generateContentStream.mock.invocationCallOrder[0]);
            expect(mocks.finalizeReservation).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'SETTLED' }));
            const terminalWrite = res.write.mock.calls.find(([value]: [string]) => value === `${JSON.stringify({ complete: true })}\n`);
            expect(terminalWrite).toBeDefined();
            expect(mocks.finalizeReservation.mock.invocationCallOrder[0]).toBeLessThan(res.write.mock.invocationCallOrder[2]);

        });

        it('rejects unverified accounts before opening a Vertex stream', async () => {
            const req: any = {
                method: 'POST',
                headers: {
                    authorization: 'Bearer token',
                    origin: 'http://localhost:4242',
                    'x-firebase-appcheck': 'app-check-token',
                },
                body: {
                    costReservationId: 'agent-stream-op-1',
                    model: 'gemini-3.1-pro-preview',
                    contents: [{ role: 'user', parts: [{ text: 'say hello' }] }],
                },
            };
            const res: any = {
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
                end: vi.fn(),
            };
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user123', email_verified: false }),
            } as any);

            generateContentStream(req, res);
            await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403));

            expect(res.send).toHaveBeenCalledWith('Forbidden: Verify your email before using AI generation.');
            expect(mocks.generateContentStream).not.toHaveBeenCalled();
        });

        it('rejects an arbitrary Vertex endpoint before opening a stream', async () => {
            const req: any = {
                method: 'POST',
                headers: {
                    authorization: 'Bearer token',
                    origin: 'http://localhost:4242',
                    'x-firebase-appcheck': 'app-check-token',
                },
                body: {
                    costReservationId: 'agent-stream-op-1',
                    model: 'projects/attacker-project/locations/us/endpoints/9999999999999999999',
                    contents: [{ role: 'user', parts: [{ text: 'spend someone else\'s endpoint' }] }],
                },
            };
            const res: any = {
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
                end: vi.fn(),
            };
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user123', email_verified: true }),
            } as any);

            generateContentStream(req, res);
            await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(400));

            expect(res.send).toHaveBeenCalledWith('Invalid or unauthorized model ID.');
            expect(mocks.generateContentStream).not.toHaveBeenCalled();
        });

        it.each([
            ['404 NOT_FOUND: endpoint was not found', 'specialist_unavailable'],
            ['503 provider unavailable', 'provider_outage'],
            ['request timed out', 'provider_outage'],
        ])('never sends a specialist prompt to a general fallback after %s', async (providerMessage, category) => {
            const specialistModel =
                'projects/148015878263/locations/us/endpoints/1720656532632240128';
            const req: any = {
                method: 'POST',
                headers: {
                    authorization: 'Bearer token',
                    origin: 'http://localhost:4242',
                    'x-firebase-appcheck': 'app-check-token',
                },
                body: {
                    costReservationId: 'agent-stream-op-1',
                    model: specialistModel,
                    contents: [{ role: 'user', parts: [{ text: 'specialist-only work' }] }],
                },
            };
            const res: any = {
                setHeader: vi.fn(),
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
                send: vi.fn(),
                end: vi.fn(),
                headersSent: false,
            };
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user123', email_verified: true }),
            } as any);
            mocks.generateContentStream.mockRejectedValueOnce(new Error(providerMessage));

            generateContentStream(req, res);
            await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

            expect(mocks.generateContentStream).toHaveBeenCalledTimes(1);
            expect(mocks.generateContentStream).toHaveBeenCalledWith(
                expect.objectContaining({ model: specialistModel }),
            );
            expect(mocks.generateContentStream).not.toHaveBeenCalledWith(
                expect.objectContaining({ model: expect.stringMatching(/^gemini-/) }),
            );
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({
                error: {
                    code: 'SPECIALIST_UNAVAILABLE',
                    message: 'This specialist is temporarily unavailable. Your request was not processed by another model.',
                    retryable: true,
                    category,
                    nextActions: ['retry_later', 'select_qualified_specialist'],
                },
            });
        });

        it('emits a terminal typed failure when a specialist stream fails after its first chunk', async () => {
            const specialistModel =
                'projects/148015878263/locations/us/endpoints/1720656532632240128';
            const req: any = {
                method: 'POST',
                headers: {
                    authorization: 'Bearer token',
                    origin: 'http://localhost:4242',
                    'x-firebase-appcheck': 'app-check-token',
                },
                body: {
                    costReservationId: 'agent-stream-op-1',
                    model: specialistModel,
                    contents: [{ role: 'user', parts: [{ text: 'specialist-only work' }] }],
                },
            };
            const res: any = {
                setHeader: vi.fn(),
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
                send: vi.fn(),
                write: vi.fn(),
                end: vi.fn(),
                headersSent: false,
            };
            vi.mocked(admin.auth).mockReturnValue({
                verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user123', email_verified: true }),
            } as any);
            async function* interruptedStream() {
                yield { text: 'partial' };
                throw new Error('503 provider unavailable');
            }
            mocks.generateContentStream.mockResolvedValueOnce(interruptedStream());

            generateContentStream(req, res);
            await vi.waitFor(() => expect(res.end).toHaveBeenCalled());

            expect(mocks.generateContentStream).toHaveBeenCalledTimes(1);
            expect(res.write).toHaveBeenCalledWith(`${JSON.stringify({ text: 'partial' })}\n`);
            expect(res.write).toHaveBeenCalledWith(`${JSON.stringify({
                error: {
                    code: 'SPECIALIST_UNAVAILABLE',
                    message: 'This specialist is temporarily unavailable. Your request was not processed by another model.',
                    retryable: true,
                    category: 'provider_outage',
                    nextActions: ['retry_later', 'select_qualified_specialist'],
                },
            })}\n`);
            expect(mocks.finalizeReservation).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'VOIDED' }));
            expect(mocks.finalizeReservation.mock.invocationCallOrder[0]).toBeLessThan(res.end.mock.invocationCallOrder[0]);
        });

        it('actively terminates a pending provider iterator and voids exactly once when the client disconnects', async () => {
            let closeHandler: (() => void) | undefined;
            let resolvePendingNext!: (value: IteratorResult<unknown>) => void;
            const pendingNext = new Promise<IteratorResult<unknown>>(resolve => { resolvePendingNext = resolve; });
            const providerIterator = {
                next: vi.fn()
                    .mockResolvedValueOnce({ done: false, value: { text: 'partial' } })
                    .mockReturnValueOnce(pendingNext),
                return: vi.fn().mockResolvedValue({ done: true, value: undefined }),
            };
            let releaseFinalizer!: () => void;
            mocks.finalizeReservation.mockImplementationOnce(() => new Promise<void>(resolve => { releaseFinalizer = resolve; }));
            mocks.generateContentStream.mockResolvedValueOnce({ [Symbol.asyncIterator]: () => providerIterator });
            const req: any = {
                method: 'POST',
                headers: { authorization: 'Bearer token', origin: 'http://localhost:4242', 'x-firebase-appcheck': 'app-check-token' },
                body: { costReservationId: 'agent-stream-op-1', model: 'gemini-3.1-pro-preview', contents: [{ role: 'user', parts: [{ text: 'cancel' }] }] },
            };
            const res: any = {
                setHeader: vi.fn(), write: vi.fn(), end: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn(),
                headersSent: true, writableEnded: false, once: vi.fn((_event: string, handler: () => void) => { closeHandler = handler; }),
            };
            vi.mocked(admin.auth).mockReturnValue({ verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user123', email_verified: true }) } as any);

            generateContentStream(req, res);
            await vi.waitFor(() => expect(res.write).toHaveBeenCalledWith(`${JSON.stringify({ text: 'partial' })}\n`));
            closeHandler?.();
            await vi.waitFor(() => expect(providerIterator.return).toHaveBeenCalledOnce());
            await vi.waitFor(() => expect(mocks.finalizeReservation).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'VOIDED' })));
            expect(mocks.finalizeReservation).toHaveBeenCalledTimes(1);
            expect(res.write).not.toHaveBeenCalledWith(`${JSON.stringify({ complete: true })}\n`);
            releaseFinalizer();
            resolvePendingNext({ done: true, value: undefined });
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(mocks.finalizeReservation).toHaveBeenCalledTimes(1);
        });

        it('does not submit a provider request when close arrives during deferred admission', async () => {
            let closeHandler: (() => void) | undefined;
            let releaseAdmission!: () => void;
            mocks.enforceRateLimit.mockImplementationOnce(() => new Promise<void>(resolve => { releaseAdmission = resolve; }));
            const req: any = { method: 'POST', headers: { authorization: 'Bearer token', origin: 'http://localhost:4242', 'x-firebase-appcheck': 'app-check-token' }, body: { costReservationId: 'agent-stream-op-1', model: 'gemini-3.1-pro-preview', contents: [{ role: 'user', parts: [{ text: 'cancel' }] }] } };
            const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn(), write: vi.fn(), end: vi.fn(), headersSent: false, writableEnded: false, once: vi.fn((_event: string, handler: () => void) => { closeHandler = handler; }) };
            vi.mocked(admin.auth).mockReturnValue({ verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user123', email_verified: true }) } as any);
            generateContentStream(req, res);
            await vi.waitFor(() => expect(mocks.enforceRateLimit).toHaveBeenCalled());
            closeHandler?.();
            releaseAdmission();
            await vi.waitFor(() => expect(mocks.finalizeReservation).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'VOIDED' })));
            expect(mocks.generateContentStream).not.toHaveBeenCalled();
            expect(mocks.finalizeReservation).toHaveBeenCalledTimes(1);
            expect(res.write).not.toHaveBeenCalledWith(`${JSON.stringify({ complete: true })}\n`);
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
                auth: { uid: 'user123' },
                data: {
                    fans: [{ email: 'fan@example.com' }],
                    provider,
                    orgId: 'personal',
                },
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
                auth: { uid: 'user123' },
                data: {
                    fans: [{ email: 'fan@example.com' }],
                    provider: 'Clearbit',
                    orgId: 'personal',
                },
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
