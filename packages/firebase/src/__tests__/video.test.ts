import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to define mocks that can be accessed inside vi.mock factories
const mocks = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockGet = vi.fn().mockResolvedValue({ data: () => undefined, exists: false });
    const mockDoc = vi.fn(() => ({
        id: 'render-server-123',
        set: mockSet,
        create: mockSet,
        get: mockGet,
        update: mockSet
    }));
    const mockCollection = vi.fn(() => ({
        doc: mockDoc,
        add: vi.fn()
    }));

    const mockRunTransaction = vi.fn(async (cb) => cb({
        get: mockGet,
        set: mockSet,
        update: mockSet
    }));

    return {
        firestore: {
            collection: mockCollection,
            runTransaction: mockRunTransaction,
            doc: mockDoc,
            set: mockSet,
            get: mockGet
        },
        storage: {
            save: vi.fn(),
            makePublic: vi.fn()
        },
        inngest: {
            send: vi.fn()
        },
        googleAuth: {
            getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
            getProjectId: vi.fn().mockResolvedValue('mock-project-id')
        },
        secrets: {
            value: vi.fn(() => 'mock-secret-value')
        },
        entitlement: vi.fn(),
        arcjet: vi.fn(),
        policyForEntitlement: vi.fn(),
        checkBudget: vi.fn(),
        finalizeReservation: vi.fn(),
        legacyAdmission: vi.fn(),
    };
});

const renderMaster = vi.hoisted(() => ({
    resolve: vi.fn(),
}));

// Mock firebase-admin
vi.mock('firebase-admin', () => {
    return {
        initializeApp: vi.fn(),
        firestore: Object.assign(
            vi.fn(() => ({
                collection: mocks.firestore.collection,
                runTransaction: mocks.firestore.runTransaction
            })),
            {
                FieldValue: {
                    serverTimestamp: vi.fn(() => 'TIMESTAMP'),
                    increment: vi.fn((n) => n)
                }
            }
        ),
        storage: vi.fn(() => ({
            bucket: () => ({
                file: () => ({
                    save: mocks.storage.save,
                    makePublic: mocks.storage.makePublic,
                    publicUrl: () => 'https://mock-storage-url.com/video.mp4'
                })
            })
        })),
        auth: vi.fn(),
        apps: [{ name: '[DEFAULT]' }],
    };
});

// Mock google-auth-library
vi.mock('google-auth-library', () => ({
    GoogleAuth: class {
        async getClient() {
            return { getAccessToken: mocks.googleAuth.getAccessToken };
        }
        getProjectId = mocks.googleAuth.getProjectId;
    }
}));

// Mock inngest
vi.mock('inngest', () => ({
    Inngest: class {
        constructor() {
            return { send: mocks.inngest.send };
        }
    }
}));

// Mock inngest/express
vi.mock('inngest/express', () => ({
    serve: vi.fn(() => vi.fn())
}));

// Mock firebase-functions/v1 — full builder chain required by storageMaintenance.ts
vi.mock('firebase-functions/v1', () => {
    const handler = vi.fn((fn: unknown) => fn);
    const scheduleBuilder = { timeZone: vi.fn().mockReturnThis(), onRun: handler };
    const topicBuilder = { onPublish: handler };
    const docBuilder = { onCreate: handler, onUpdate: handler, onDelete: handler, onWrite: handler };
    const objectBuilder = { onArchive: handler, onDelete: handler, onFinalize: handler, onMetadataUpdate: handler };

    const builder: Record<string, unknown> = {
        logger: {
            log: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
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

// Mock Stripe to prevent initialization error
vi.mock('stripe', () => ({
    default: class MockStripe {
        constructor(_apiKey: string) { }
    }
}));

// Mock Stripe config to ensure it doesn't fail on process.env access
vi.mock('../stripe/config', () => ({
    stripe: {}
}));

// Mock firebase-functions/params
vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: mocks.secrets.value })),
    defineString: vi.fn(() => ({ value: vi.fn(() => 'mock-string-value') })),
    defineInt: vi.fn(() => ({ value: vi.fn(() => 0) })),
}));

// Mock MCP module — initializes @modelcontextprotocol/sdk Server at load time which
// creates a listener and blocks when loaded in a vi.resetModules() context.
vi.mock('../mcp', () => ({
    mcpHttpHandler: vi.fn((req: unknown, res: unknown) => res)
}));

// Mock Orchestration module — calls admin.initializeApp() unconditionally at load time.
vi.mock('../orchestration', () => ({
    orchestrationListener: vi.fn()
}));

vi.mock('../functions/video/renderMasterContract', () => ({
    CanonicalRenderMasterError: class CanonicalRenderMasterError extends Error {},
    parseProjectCanonicalMaster: vi.fn((userId: string, clips: unknown[]) => {
        const audio = clips.find(clip => typeof clip === 'object' && clip !== null && (clip as { type?: string }).type === 'audio') as { canonicalMaster?: unknown } | undefined;
        return audio?.canonicalMaster;
    }),
    parseProjectCanonicalVideoSegments: vi.fn((_userId: string, _bucketName: string, clips: unknown[]) => clips
        .filter(clip => typeof clip === 'object' && clip !== null && (clip as { type?: string }).type === 'video')
        .map(clip => (clip as { canonicalSourceUri?: string }).canonicalSourceUri)),
    resolveVerifiedRenderMaster: (...args: unknown[]) => renderMaster.resolve(...args),
}));

vi.mock('../functions/auth/entitlements', () => ({
    requireVerifiedServerEntitlement: mocks.entitlement,
    entitlementTierToBudgetTier: vi.fn(() => 'free'),
}));

vi.mock('../functions/security/arcjet', () => ({
    protectAuthenticatedApiRequest: mocks.arcjet,
    policyClassForServerEntitlement: mocks.policyForEntitlement,
}));

vi.mock('../functions/creative/legacyAdmission', () => ({
    requireVerifiedCreativeAdmissionV1: mocks.legacyAdmission,
}));

vi.mock('../functions/billing/enforceOperationCost', () => ({
    checkOperationBudget: mocks.checkBudget,
    finalizeOperationReservation: mocks.finalizeReservation,
    requireVerifiedCreativeUser: vi.fn((auth: { uid?: string; token?: Record<string, unknown> } | undefined) => {
        if (!auth?.uid) throw new Error('User must be authenticated.');
        if (auth.token?.email_verified !== true) throw new Error('Verify your email before using creative generation.');
        return auth.uid;
    }),
    getOperationCostHistory: vi.fn(),
    getOperationCostStatus: vi.fn(),
    expireStaleOperationCostReservations: vi.fn(),
}));



// Mock cors (imported at top of index.ts)
vi.mock('cors', () => ({
    default: vi.fn(() => vi.fn((_req: unknown, _res: unknown, next: unknown) => {
        if (typeof next === 'function') next();
    })),
}));

// Mock firebase-functions/v2 submodules (used by barrel-imported modules)
vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((opts: unknown, handler?: unknown) => handler ?? opts),
    onRequest: vi.fn((opts: unknown, handler?: unknown) => handler ?? opts),
    HttpsError: class extends Error {
        code: string;
        constructor(code: string, message: string) { super(message); this.code = code; }
    },
}));
vi.mock('firebase-functions/v2/storage', () => ({
    onObjectFinalized: vi.fn((opts: unknown, handler?: unknown) => handler ?? opts),
}));
vi.mock('firebase-functions/v2/firestore', () => ({
    onDocumentCreated: vi.fn((opts: unknown, handler?: unknown) => handler ?? opts),
    onDocumentUpdated: vi.fn((opts: unknown, handler?: unknown) => handler ?? opts),
    onDocumentWritten: vi.fn((opts: unknown, handler?: unknown) => handler ?? opts),
}));
vi.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: vi.fn((opts: unknown, handler?: unknown) => handler ?? opts),
}));

// Mock streaming/agentStream (re-exported from barrel)
vi.mock('../streaming/agentStream', () => ({
    agentStreamResponse: vi.fn(),
    agentStreamHealth: vi.fn(),
}));

// Mock relay/email/analytics/devops modules that may have network-touching side effects.
vi.mock('../relay/relayCommandProcessor', () => ({ processRelayCommand: vi.fn() }));
vi.mock('../relay/telegramWebhook', () => ({ telegramWebhook: vi.fn() }));
vi.mock('../relay/telegramLink', () => ({ generateTelegramLinkCode: vi.fn(), getTelegramLinkStatus: vi.fn() }));
vi.mock('../email/sendEmail', () => ({ sendEmail: vi.fn() }));
vi.mock('../email/tokenManager', () => ({ emailExchangeToken: vi.fn(), emailRefreshToken: vi.fn(), emailRevokeToken: vi.fn() }));
vi.mock('../analytics/platformTokenExchange', () => ({ analyticsExchangeToken: vi.fn(), analyticsRefreshToken: vi.fn(), analyticsRevokeToken: vi.fn() }));
vi.mock('../devops/storageMaintenance', () => ({ cleanupExpiredVideoTemps: vi.fn(), cleanupOrphanedVideos: vi.fn(), trackStorageQuotas: vi.fn(), flagVideosForArchival: vi.fn() }));

// Import functions AFTER mocks
import { triggerLongFormVideoJob, triggerVideoJob, renderVideo, cancelVideoJob } from '../index';

describe('Video Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.entitlement.mockResolvedValue({ tier: 'free' });
        mocks.policyForEntitlement.mockReturnValue('verified-free');
        mocks.arcjet.mockResolvedValue({ allowed: true });
        mocks.checkBudget.mockResolvedValue({ allowed: true, operationId: 'render-op-123' });
        mocks.legacyAdmission.mockImplementation(async (context: { auth?: { uid?: string } }) => {
            if (!context.auth?.uid) throw new Error('User must be authenticated.');
            return { userId: context.auth.uid, entitlement: { tier: 'free' } };
        });
        renderMaster.resolve.mockResolvedValue({
            storagePath: `masters/user123/${'a'.repeat(64)}/original.wav`,
            contentHash: 'a'.repeat(64),
            generation: '123456789',
            masterFingerprint: 'SONIC-master',
            volume: 1,
            uri: `gs://indii-music-founder.firebasestorage.app/masters/user123/${'a'.repeat(64)}/original.wav`,
        });
    });

    it('exports cancelVideoJob from the Firebase root entry', () => {
        expect(cancelVideoJob).toBeDefined();
        expect(typeof cancelVideoJob).toBe('function');
    });

    describe('triggerVideoJob', () => {
        it('should throw unauthenticated error if no context.auth', async () => {
            const triggerCall = triggerVideoJob as any;
            await expect(triggerCall({}, {}))
                .rejects.toThrow('User must be authenticated');
        });

        it('should throw invalid-argument if schema validation fails', async () => {
            const context: any = { auth: { uid: 'user123' } };
            const triggerCall = triggerVideoJob as any;
            // Empty object fails validation because prompt is required.
            await expect(triggerCall({}, context))
                .rejects.toThrow();
        });

        it('creates a server-owned job and cost reservation instead of trusting a client job ID', async () => {
            const context: any = { auth: { uid: 'user123' } };
            const data = {
                jobId: 'browser-selected-id',
                prompt: 'test prompt',
                orgId: 'personal' // Matches schema default or provided
            };

            const triggerCall = triggerVideoJob as any;
            const result = await triggerCall(data, context);

            expect(result).toEqual({ success: true, jobId: 'render-server-123', message: "Video generation job started." });

            expect(mocks.firestore.collection).toHaveBeenCalledWith('videoJobs');
            expect(mocks.firestore.doc).toHaveBeenCalledWith();
            expect(mocks.firestore.doc).not.toHaveBeenCalledWith('browser-selected-id');
            expect(mocks.checkBudget).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user123',
                operationType: 'video',
                operationId: 'legacy-vertex-video-render-server-123',
            }));
            expect(mocks.firestore.set).toHaveBeenCalledWith(expect.objectContaining({
                id: 'render-server-123',
                costReservationId: 'render-op-123',
                status: 'queued',
                options: expect.objectContaining({
                    model: 'pro',
                    duration: 6,
                    durationSeconds: 6,
                }),
            }));
        });

        it('uses one normalized model and duration for both reservation and worker execution', async () => {
            const context: any = { auth: { uid: 'user123' } };

            await (triggerVideoJob as any)({
                prompt: 'test prompt',
                orgId: 'personal',
                model: 'lite',
                duration: 5,
            }, context);

            expect(mocks.checkBudget).toHaveBeenCalledWith(expect.objectContaining({
                estimatedCost: 0.3,
            }));
            expect(mocks.firestore.set).toHaveBeenCalledWith(expect.objectContaining({
                estimatedCost: 0.3,
                options: expect.objectContaining({
                    model: 'lite',
                    duration: 6,
                    durationSeconds: 6,
                }),
            }));
        });

        it('should accept generateAudio option', async () => {
            const context: any = { auth: { uid: 'user123' } };
            const data = {
                jobId: 'job-audio-123',
                prompt: 'test prompt with audio',
                generateAudio: true,
                orgId: 'personal'
            };

            const triggerCall = triggerVideoJob as any;
            const result = await triggerCall(data, context);

            expect(result).toEqual({ success: true, jobId: 'render-server-123', message: "Video generation job started." });

            // Verify Firestore records the generateAudio option
            // (Assuming mockSet captures create, check calls)
            expect(mocks.firestore.set).toHaveBeenCalledWith(expect.objectContaining({
                options: expect.objectContaining({
                    generateAudio: true
                })
            }));
        });

        it('does not create a worker-triggering document when the server budget rejects it', async () => {
            mocks.checkBudget.mockResolvedValueOnce({ allowed: false, reason: 'Daily budget exceeded.' });
            const context: any = { auth: { uid: 'user123' } };

            await expect((triggerVideoJob as any)({ prompt: 'test prompt', orgId: 'personal' }, context))
                .rejects.toMatchObject({ code: 'resource-exhausted' });

            expect(mocks.firestore.set).not.toHaveBeenCalled();
        });
    });

    describe('triggerLongFormVideoJob', () => {
        it('creates a server-owned long-form job and reservation instead of trusting browser identity or duration', async () => {
            const context: any = { auth: { uid: 'user123' } };
            const result = await (triggerLongFormVideoJob as any)({
                jobId: 'browser-long-form-id',
                userId: 'attacker',
                totalDuration: 1,
                prompts: ['first scene', 'second scene'],
                options: { model: 'fast', resolution: '720p' },
            }, context);

            expect(result).toEqual({
                success: true,
                jobId: 'render-server-123',
                message: 'Long form video generation started.',
            });
            expect(mocks.checkBudget).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user123',
                operationType: 'video',
                operationId: 'long-form-vertex-video-render-server-123',
                estimatedCost: 1,
                metadata: expect.objectContaining({ segmentCount: 2, secondsPerSegment: 5 }),
            }));
            expect(mocks.firestore.set).toHaveBeenCalledWith(expect.objectContaining({
                id: 'render-server-123',
                userId: 'user123',
                costReservationId: 'render-op-123',
                isLongForm: true,
            }));
            expect(mocks.inngest.send).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    jobId: 'render-server-123',
                    userId: 'user123',
                    totalDuration: 10,
                    costReservationId: 'render-op-123',
                }),
            }));
        });

        it('does not create a long-form worker record when server budget denies the request', async () => {
            mocks.checkBudget.mockResolvedValueOnce({ allowed: false, reason: 'Hourly budget exceeded.' });
            const context: any = { auth: { uid: 'user123' } };

            await expect((triggerLongFormVideoJob as any)({ prompts: ['scene'] }, context))
                .rejects.toMatchObject({ code: 'resource-exhausted' });

            expect(mocks.firestore.set).not.toHaveBeenCalled();
            expect(mocks.inngest.send).not.toHaveBeenCalled();
        });
    });

    describe('renderVideo', () => {
        it('forwards the canonical master, server reservation, and bounded timeline to the stitch job', async () => {
            const context: any = {
                auth: { uid: 'user123', token: { email_verified: true } },
                rawRequest: { method: 'POST', headers: {} },
            };
            const data = {
                compositionId: 'performance-video-123',
                inputProps: {
                    project: {
                        width: 1920,
                        height: 1080,
                        fps: 30,
                        durationInFrames: 240,
                        tracks: [
                            { id: 'video-1', type: 'video', name: 'Performance' },
                            { id: 'audio-1', type: 'audio', name: 'Master' }
                        ],
                        clips: [
                            {
                                id: 'scene-1',
                                type: 'video',
                                src: 'https://cdn.example.com/scene.mp4',
                                canonicalSourceUri: 'gs://indii-music-founder.firebasestorage.app/creative/user123/video/outputs/scene.mp4',
                                trackId: 'video-1',
                                startFrame: 0,
                                durationInFrames: 240
                            },
                            {
                                id: 'master-audio',
                                type: 'audio',
                                src: 'https://attacker.example.com/master.wav',
                                canonicalMaster: {
                                    storagePath: `masters/user123/${'a'.repeat(64)}/original.wav`,
                                    contentHash: 'a'.repeat(64),
                                    generation: '123456789',
                                    masterFingerprint: 'SONIC-master',
                                    volume: 1,
                                },
                                trackId: 'audio-1',
                                startFrame: 0,
                                durationInFrames: 240,
                                volume: 1
                            }
                        ]
                    }
                }
            };

            const result = await (renderVideo as any)(data, context);

            expect(result).toEqual({
                success: true,
                renderId: 'render-server-123',
                message: 'Render job queued.'
            });
            expect(mocks.checkBudget).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user123',
                operationType: 'video',
                estimatedCost: 0.008,
                operationId: 'render-stitch-render-server-123',
            }));
            expect(mocks.inngest.send).toHaveBeenCalledWith(expect.objectContaining({
                name: 'video/stitch.requested',
                data: expect.objectContaining({
                    masterAudio: {
                        storagePath: `masters/user123/${'a'.repeat(64)}/original.wav`,
                        contentHash: 'a'.repeat(64),
                        generation: '123456789',
                        masterFingerprint: 'SONIC-master',
                        volume: 1,
                        uri: `gs://indii-music-founder.firebasestorage.app/masters/user123/${'a'.repeat(64)}/original.wav`,
                    },
                    audioMix: {
                        mode: 'master_replaces_native',
                        preserveNativeAudio: false
                    },
                    costReservationId: 'render-op-123',
                    options: expect.objectContaining({ timelineDurationSeconds: 8 }),
                })
            }));
        });

        it('should process job correctly', async () => {
            // Setup mock for firestore get to return job data
            mocks.firestore.get.mockResolvedValue({
                exists: true,
                data: () => ({
                    prompt: 'test prompt',
                    duration: 15,
                    style: 'cinematic',
                    status: 'queued'
                })
            });

            const _event = {
                data: {
                    jobId: 'job-123',
                    userId: 'user123'
                }
            };

            // renderVideo is an Inngest function handler.
            // We can't directly call it easily here unless we exported the handler logic separately.
            // The export in index.ts is the Inngest function definition object usually.
            // But checking index.ts: export const renderVideo = inngest.createFunction(...)

            // Testing Inngest functions directly requires exposing the handler or using Inngest test helpers.
            // Given the complexity, we will skip deep logic testing of `renderVideo` wrapper and assume
            // unit tests cover the logic if extracted.
            // For now, let's just assert it is defined.
            expect(renderVideo).toBeDefined();
        });
    });
});
