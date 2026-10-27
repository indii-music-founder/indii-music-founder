import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const mockSet = vi.fn();
    const mockGet = vi.fn().mockResolvedValue({ data: () => undefined, exists: false });
    const mockDoc = vi.fn(() => ({
        id: 'mock-doc-id',
        set: mockSet,
        create: mockSet,
        get: mockGet,
        update: mockSet,
        delete: vi.fn(),
    }));
    const mockCollection = vi.fn(() => ({
        doc: mockDoc,
        add: vi.fn(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [], empty: true, size: 0 }),
    }));

    const mockRunTransaction = vi.fn(async (cb) => cb({
        get: mockGet,
        set: mockSet,
        update: mockSet,
        delete: vi.fn(),
    }));

    const mockBatch = vi.fn(() => ({
        delete: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        commit: vi.fn().mockResolvedValue([]),
    }));

    return {
        firestore: {
            collection: mockCollection,
            runTransaction: mockRunTransaction,
            doc: mockDoc,
            set: mockSet,
            get: mockGet,
            batch: mockBatch,
        },
        storage: {
            save: vi.fn(),
            makePublic: vi.fn(),
        },
        inngest: {
            send: vi.fn(),
        },
        googleAuth: {
            getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
            getProjectId: vi.fn().mockResolvedValue('mock-project-id'),
        },
        secrets: {
            value: vi.fn(() => 'mock-secret-value'),
        },
        entitlement: vi.fn(),
        arcjet: vi.fn(),
        arcjetAnon: vi.fn(),
        policyForEntitlement: vi.fn(),
        checkBudget: vi.fn(),
        finalizeReservation: vi.fn(),
        legacyAdmission: vi.fn(),
        authorizeProject: vi.fn(),
        validateAppCheckV2: vi.fn(),
        validateAppCheckHttp: vi.fn().mockResolvedValue(true),
        verifyIdToken: vi.fn().mockResolvedValue({ uid: 'mock-user-id' }),
        deleteUser: vi.fn().mockResolvedValue(undefined),
    };
});

// Mock firebase-admin
vi.mock('firebase-admin', () => {
    return {
        initializeApp: vi.fn(),
        firestore: Object.assign(
            vi.fn(() => ({
                collection: mocks.firestore.collection,
                runTransaction: mocks.firestore.runTransaction,
                doc: mocks.firestore.doc,
                batch: mocks.firestore.batch,
            })),
            {
                FieldValue: {
                    serverTimestamp: vi.fn(() => 'TIMESTAMP'),
                    increment: vi.fn((n) => n),
                    delete: vi.fn(() => 'DELETE'),
                },
            }
        ),
        storage: vi.fn(() => ({
            bucket: () => ({
                file: () => ({
                    save: mocks.storage.save,
                    makePublic: mocks.storage.makePublic,
                    publicUrl: () => 'https://mock-storage-url.com/video.mp4',
                }),
            }),
        })),
        auth: vi.fn(() => ({
            verifyIdToken: mocks.verifyIdToken,
            deleteUser: mocks.deleteUser,
        })),
        apps: [{ name: '[DEFAULT]' }],
    };
});

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(() => ({
        collection: mocks.firestore.collection,
        runTransaction: mocks.firestore.runTransaction,
        doc: mocks.firestore.doc,
        batch: mocks.firestore.batch,
    })),
    FieldValue: {
        serverTimestamp: vi.fn(() => 'TIMESTAMP'),
        delete: vi.fn(() => 'DELETE'),
    },
}));

// Mock google-auth-library
vi.mock('google-auth-library', () => ({
    GoogleAuth: class {
        async getClient() {
            return { getAccessToken: mocks.googleAuth.getAccessToken };
        }
        getProjectId = mocks.googleAuth.getProjectId;
    },
}));

// Mock inngest
vi.mock('inngest', () => ({
    Inngest: class {
        send = mocks.inngest.send;
        createFunction = vi.fn((_opt: unknown, _trigger: unknown, fn?: unknown) => fn ?? vi.fn());
        constructor() {
            return {
                send: mocks.inngest.send,
                createFunction: vi.fn((_opt: unknown, _trigger: unknown, fn?: unknown) => fn ?? vi.fn()),
            };
        }
    },
}));

// Mock inngest/express
vi.mock('inngest/express', () => ({
    serve: vi.fn(() => vi.fn((_req: unknown, res: any) => {
        if (typeof res?.status === 'function') res.status(200).send('inngest-ok');
    })),
}));

// Mock Stripe to prevent initialization error
vi.mock('stripe', () => ({
    default: class MockStripe {
        constructor(_apiKey: string) { }
    },
}));

vi.mock('../stripe/config', () => ({
    stripe: {},
}));

vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: mocks.secrets.value })),
    defineString: vi.fn(() => ({ value: vi.fn(() => 'mock-string-value') })),
    defineInt: vi.fn(() => ({ value: vi.fn(() => 0) })),
}));

vi.mock('../mcp', () => ({
    mcpHttpHandler: vi.fn((req: unknown, res: unknown) => res),
}));

vi.mock('../orchestration', () => ({
    orchestrationListener: vi.fn(),
}));

vi.mock('../functions/video/renderMasterContract', () => ({
    CanonicalRenderMasterError: class CanonicalRenderMasterError extends Error {},
    parseProjectCanonicalMaster: vi.fn(),
    parseProjectCanonicalVideoSegments: vi.fn(() => []),
    resolveVerifiedRenderMaster: vi.fn(),
}));

vi.mock('../functions/video/createVideoSession', () => ({
    createVideoSession: vi.fn(),
    assertVideoSessionProjectAccess: mocks.authorizeProject,
}));

vi.mock('../functions/video/getVideoRenderReceipt', () => ({
    getVideoRenderReceipt: vi.fn(),
}));

vi.mock('../functions/auth/entitlements', () => ({
    requireVerifiedServerEntitlement: mocks.entitlement,
    entitlementTierToBudgetTier: vi.fn(() => 'free'),
}));

vi.mock('../functions/security/arcjet', () => ({
    protectAuthenticatedApiRequest: mocks.arcjet,
    protectAnonymousSignupRequest: mocks.arcjetAnon,
    policyClassForServerEntitlement: mocks.policyForEntitlement,
}));

vi.mock('../functions/creative/legacyAdmission', () => ({
    requireVerifiedCreativeAdmission: mocks.legacyAdmission,
}));

vi.mock('../functions/billing/enforceOperationCost', () => ({
    checkOperationBudget: mocks.checkBudget,
    finalizeOperationReservation: mocks.finalizeReservation,
    requireVerifiedCreativeUser: vi.fn(),
    getOperationCostHistory: vi.fn(),
    getOperationCostStatus: vi.fn(),
    expireStaleOperationCostReservations: vi.fn(),
}));

vi.mock('cors', () => ({
    default: vi.fn(() => vi.fn((_req: unknown, _res: unknown, next: unknown) => {
        if (typeof next === 'function') (next as () => void)();
    })),
}));

vi.mock('../middleware/appCheck', () => ({
    validateAppCheckV2: mocks.validateAppCheckV2,
    validateAppCheckHttp: mocks.validateAppCheckHttp,
    requireVerifiedEmailV2: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((opts: unknown, handler?: unknown) => handler ?? opts),
    onRequest: vi.fn((opts: unknown, handler?: unknown) => handler ?? opts),
    HttpsError: class extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
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

vi.mock('../streaming/agentStream', () => ({
    agentStreamResponse: vi.fn(),
    agentStreamHealth: vi.fn(),
}));

vi.mock('../relay/relayCommandProcessor', () => ({ processRelayCommand: vi.fn() }));
vi.mock('../email/sendEmail', () => ({ sendEmail: vi.fn() }));
vi.mock('../email/tokenManager', () => ({ emailExchangeToken: vi.fn(), emailRefreshToken: vi.fn(), emailRevokeToken: vi.fn() }));
vi.mock('../analytics/platformTokenExchange', () => ({ analyticsExchangeToken: vi.fn(), analyticsRefreshToken: vi.fn(), analyticsRevokeToken: vi.fn() }));
vi.mock('../devops/storageMaintenance', () => ({ cleanupExpiredVideoTemps: vi.fn(), cleanupOrphanedVideos: vi.fn(), trackStorageQuotas: vi.fn(), flagVideosForArchival: vi.fn() }));

vi.mock('./gkeService', () => ({
    listClusters: vi.fn().mockResolvedValue([{ name: 'cluster-1' }]),
    getClusterStatus: vi.fn().mockResolvedValue({ status: 'RUNNING' }),
    scaleNodePool: vi.fn().mockResolvedValue({ status: 'SCALED' }),
}));

vi.mock('./gceService', () => ({
    listInstances: vi.fn().mockResolvedValue([{ name: 'instance-1' }]),
    resetInstance: vi.fn().mockResolvedValue({ status: 'RESET' }),
}));

vi.mock('../analytics/bigqueryService', () => ({
    getTableSchema: vi.fn().mockResolvedValue({ fields: [] }),
    listDatasets: vi.fn().mockResolvedValue([{ id: 'dataset-1' }]),
}));

vi.mock('@google-cloud/bigquery', () => ({
    BigQuery: class MockBigQuery {
        createQueryJob = vi.fn().mockResolvedValue([
            { getQueryResults: vi.fn().mockResolvedValue([[{ count: 1 }]]) },
        ]);
    },
}));

import { retrySessionProxyJob } from '../functions/video/retrySessionProxyJob';
import {
    inngestApi,
    ragProxy,
    listGKEClusters,
    getGKEClusterStatus,
    scaleGKENodePool,
    listGCEInstances,
    restartGCEInstance,
    executeBigQueryQuery,
    getBigQueryTableSchema,
    listBigQueryDatasets,
    exportUserData,
    requestAccountDeletion,
    healthCheck,
    healthCheckWest1,
    enrichFanData,
} from '../index';

describe('Unit 23 Admission Security: Remaining Infrastructure, Utility & Video Proxy Endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.arcjet.mockReset();
        mocks.arcjetAnon.mockReset();
        mocks.arcjet.mockResolvedValue({ allowed: true });
        mocks.arcjetAnon.mockResolvedValue({ allowed: true });
        mocks.validateAppCheckV2.mockReturnValue(undefined);
        mocks.validateAppCheckHttp.mockResolvedValue(true);
        mocks.verifyIdToken.mockResolvedValue({ uid: 'mock-user-id' });
        process.env.GCLOUD_PROJECT = 'indii-music-founder';
    });

    const call = (fn: any, ...args: any[]) => fn(...args);

    describe('retrySessionProxyJob', () => {
        it('throws resource-exhausted when Arcjet rate limit denies request', async () => {
            mocks.arcjet.mockResolvedValueOnce({
                allowed: false,
                status: 429,
                message: 'Rate limit exceeded.',
            });

            const context: any = {
                auth: { uid: 'owner-1', token: { firebase: { sign_in_provider: 'password' } } },
                rawRequest: { headers: {}, ip: '127.0.0.1' },
                data: { sessionId: '0123456789abcdef0123456789abcdef01234567' },
            };

            await expect(call(retrySessionProxyJob, context))
                .rejects.toMatchObject({ code: 'resource-exhausted' });

            expect(mocks.arcjet).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    userId: 'owner-1',
                    operationId: 'retry-session-proxy-job:owner-1',
                })
            );
        });

        it('rejects unauthenticated requests', async () => {
            await expect(call(retrySessionProxyJob, { data: {} }))
                .rejects.toMatchObject({ code: 'unauthenticated' });
        });

        it('rejects anonymous callers', async () => {
            const context: any = {
                auth: { uid: 'anon-1', token: { firebase: { sign_in_provider: 'anonymous' } } },
                data: {},
            };
            await expect(call(retrySessionProxyJob, context))
                .rejects.toMatchObject({ code: 'permission-denied' });
        });
    });

    describe('inngestApi', () => {
        it('returns 429 when Arcjet protection denies request', async () => {
            mocks.arcjet.mockResolvedValueOnce({
                allowed: false,
                status: 429,
                message: 'Too Many Requests',
            });

            const res = {
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
            };

            await call(
                inngestApi,
                { headers: {}, ip: '192.168.1.1' },
                res
            );

            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.send).toHaveBeenCalledWith('Too Many Requests');
            expect(mocks.arcjet).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    userId: 'inngest-dispatcher',
                    operationId: 'inngest-api:192.168.1.1',
                })
            );
        });
    });

    describe('ragProxy', () => {
        it('returns 429 when Arcjet protection denies request', async () => {
            mocks.arcjet.mockResolvedValueOnce({
                allowed: false,
                status: 429,
                message: 'Too Many Requests',
            });

            const res = {
                status: vi.fn().mockReturnThis(),
                send: vi.fn(),
            };

            await call(
                ragProxy,
                { headers: { authorization: 'Bearer mock-token' }, ip: '10.0.0.1' },
                res
            );

            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.send).toHaveBeenCalledWith({ error: 'Too Many Requests' });
            expect(mocks.arcjet).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    userId: 'rag-proxy-caller',
                    operationId: 'rag-proxy:10.0.0.1',
                })
            );
        });
    });

    describe('DevOps GKE callables', () => {
        const adminContext: any = {
            auth: { uid: 'admin-1', token: { admin: true } },
            rawRequest: { headers: {}, ip: '127.0.0.1' },
            data: { location: 'us-central1', clusterName: 'prod-cluster', nodePoolName: 'default-pool', nodeCount: 3 },
        };

        it('listGKEClusters throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            await expect(call(listGKEClusters, adminContext)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });

        it('listGKEClusters rejects non-admin callers', async () => {
            const nonAdmin = { ...adminContext, auth: { uid: 'user-1', token: {} } };
            await expect(call(listGKEClusters, nonAdmin)).rejects.toMatchObject({ code: 'permission-denied' });
        });

        it('getGKEClusterStatus throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            await expect(call(getGKEClusterStatus, adminContext)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });

        it('scaleGKENodePool throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            await expect(call(scaleGKENodePool, adminContext)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });
    });

    describe('DevOps GCE callables', () => {
        const adminContext: any = {
            auth: { uid: 'admin-1', token: { admin: true } },
            rawRequest: { headers: {}, ip: '127.0.0.1' },
            data: { zone: 'us-central1-a', instanceName: 'render-worker-1' },
        };

        it('listGCEInstances throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            await expect(call(listGCEInstances, adminContext)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });

        it('listGCEInstances rejects non-admin callers', async () => {
            const nonAdmin = { ...adminContext, auth: { uid: 'user-1', token: {} } };
            await expect(call(listGCEInstances, nonAdmin)).rejects.toMatchObject({ code: 'permission-denied' });
        });

        it('restartGCEInstance throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            await expect(call(restartGCEInstance, adminContext)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });
    });

    describe('BigQuery callables', () => {
        const adminContext: any = {
            auth: { uid: 'admin-1', token: { admin: true } },
            rawRequest: { headers: {}, ip: '127.0.0.1' },
            data: { query: 'SELECT 1', datasetId: 'analytics', tableId: 'events' },
        };

        it('executeBigQueryQuery throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            await expect(call(executeBigQueryQuery, adminContext)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });

        it('executeBigQueryQuery rejects non-admin callers', async () => {
            const nonAdmin = { ...adminContext, auth: { uid: 'user-1', token: {} } };
            await expect(call(executeBigQueryQuery, nonAdmin)).rejects.toMatchObject({ code: 'permission-denied' });
        });

        it('getBigQueryTableSchema throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            await expect(call(getBigQueryTableSchema, adminContext)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });

        it('listBigQueryDatasets throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            await expect(call(listBigQueryDatasets, adminContext)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });
    });

    describe('exportUserData & requestAccountDeletion', () => {
        const userContext: any = {
            auth: { uid: 'user-123', token: { email: 'user@example.com', firebase: { sign_in_provider: 'password' } } },
            rawRequest: { headers: {}, ip: '127.0.0.1' },
            data: {},
        };

        it('exportUserData throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            await expect(call(exportUserData, userContext)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });

        it('exportUserData rejects anonymous callers', async () => {
            const anon = { ...userContext, auth: { uid: 'anon', token: { firebase: { sign_in_provider: 'anonymous' } } } };
            await expect(call(exportUserData, anon)).rejects.toMatchObject({ code: 'permission-denied' });
        });

        it('requestAccountDeletion throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            await expect(call(requestAccountDeletion, userContext)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });

        it('requestAccountDeletion rejects anonymous callers', async () => {
            const anon = { ...userContext, auth: { uid: 'anon', token: { firebase: { sign_in_provider: 'anonymous' } } } };
            await expect(call(requestAccountDeletion, anon)).rejects.toMatchObject({ code: 'permission-denied' });
        });
    });

    describe('healthCheck & healthCheckWest1', () => {
        it('healthCheck returns 429 when Arcjet denies', async () => {
            mocks.arcjetAnon.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too Many Requests' });
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            await call(healthCheck, { headers: {}, ip: '127.0.0.1' }, res);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith({ error: 'Too Many Requests' });
        });

        it('healthCheck returns 200 when Arcjet allows', async () => {
            mocks.arcjetAnon.mockResolvedValueOnce({ allowed: true });
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            await call(healthCheck, { headers: {}, ip: '127.0.0.1' }, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
        });

        it('healthCheckWest1 returns 429 when Arcjet denies', async () => {
            mocks.arcjetAnon.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too Many Requests' });
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            await call(healthCheckWest1, { headers: {}, ip: '127.0.0.1' }, res);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith({ error: 'Too Many Requests' });
        });

        it('healthCheckWest1 returns 200 when Arcjet allows', async () => {
            mocks.arcjetAnon.mockResolvedValueOnce({ allowed: true });
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
            await call(healthCheckWest1, { headers: {}, ip: '127.0.0.1' }, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
        });
    });

    describe('enrichFanData', () => {
        it('enrichFanData throws resource-exhausted when Arcjet denies', async () => {
            mocks.arcjet.mockResolvedValueOnce({ allowed: false, status: 429, message: 'Too many requests' });
            const context: any = {
                auth: { uid: 'user-123', token: { firebase: { sign_in_provider: 'password' } } },
                rawRequest: { headers: {}, ip: '127.0.0.1' },
                data: { fans: [{ email: 'fan@example.com' }], provider: 'clearbit' },
            };
            await expect(call(enrichFanData, context)).rejects.toMatchObject({ code: 'resource-exhausted' });
        });

        it('enrichFanData rejects anonymous callers', async () => {
            const context: any = {
                auth: { uid: 'anon', token: { firebase: { sign_in_provider: 'anonymous' } } },
                data: { fans: [] },
            };
            await expect(call(enrichFanData, context)).rejects.toMatchObject({ code: 'permission-denied' });
        });
    });
});
