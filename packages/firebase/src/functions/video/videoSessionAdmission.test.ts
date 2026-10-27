import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  validateAppCheck: vi.fn(),
  requireVerifiedCreativeUser: vi.fn(),
  requireVerifiedServerEntitlement: vi.fn(),
  checkOperationBudget: vi.fn(),
  firestoreDocGet: vi.fn(),
  firestoreDocSet: vi.fn(),
  firestoreDocCreate: vi.fn(),
  firestoreDocUpdate: vi.fn(),
  firestoreRunTransaction: vi.fn(),
  storageBucket: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        id: 'mock-doc-id',
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        create: mocks.firestoreDocCreate,
        update: mocks.firestoreDocUpdate,
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            id: 'mock-subdoc-id',
            get: mocks.firestoreDocGet,
            set: mocks.firestoreDocSet,
            create: mocks.firestoreDocCreate,
            update: mocks.firestoreDocUpdate,
          })),
        })),
      })),
      add: vi.fn().mockResolvedValue({ id: 'mock-add-id' }),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
      create: mocks.firestoreDocCreate,
      update: mocks.firestoreDocUpdate,
    })),
    runTransaction: mocks.firestoreRunTransaction,
  }));
  return {
    default: {
      apps: [{ name: 'mock-app' }],
      initializeApp: vi.fn(),
      firestore: Object.assign(firestore, {
        FieldValue: {
          serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
          increment: vi.fn((n: number) => n),
        },
      }),
      storage: vi.fn(() => ({
        bucket: mocks.storageBucket,
      })),
    },
    apps: [{ name: 'mock-app' }],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestore, {
      FieldValue: {
        serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
        increment: vi.fn((n: number) => n),
      },
    }),
    storage: vi.fn(() => ({
      bucket: mocks.storageBucket,
    })),
  };
});

vi.mock('firebase-admin/firestore', () => {
  const getFirestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        id: 'mock-doc-id',
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        create: mocks.firestoreDocCreate,
        update: mocks.firestoreDocUpdate,
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            id: 'mock-subdoc-id',
            get: mocks.firestoreDocGet,
            set: mocks.firestoreDocSet,
            create: mocks.firestoreDocCreate,
            update: mocks.firestoreDocUpdate,
          })),
        })),
      })),
      add: vi.fn().mockResolvedValue({ id: 'mock-add-id' }),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
      create: mocks.firestoreDocCreate,
      update: mocks.firestoreDocUpdate,
    })),
    runTransaction: mocks.firestoreRunTransaction,
  }));
  return {
    getFirestore,
    FieldValue: {
      serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
      increment: vi.fn((n: number) => n),
    },
    Timestamp: {
      now: vi.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
    },
  };
});

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: mocks.storageBucket,
  })),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_options: unknown, handler: unknown) => handler),
  onRequest: vi.fn((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

vi.mock('../../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
}));

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
}));

vi.mock('../billing/enforceOperationCost', () => ({
  requireVerifiedCreativeUser: mocks.requireVerifiedCreativeUser,
  checkOperationBudget: mocks.checkOperationBudget,
}));

vi.mock('../auth/entitlements', () => ({
  requireVerifiedServerEntitlement: mocks.requireVerifiedServerEntitlement,
  entitlementTierToBudgetTier: vi.fn(() => 'pro'),
}));

import { alignSessionMaster } from './alignSessionMaster';
import { approveSessionEditPlan } from './approveSessionEditPlan';
import { cancelVideoSession } from './cancelVideoSession';
import { createVideoSession } from './createVideoSession';
import { generateSessionEditPlan } from './generateSessionEditPlan';
import { queueCloudVideoRender } from './queueCloudVideoRender';
import { claimVideoRenderJob, completeVideoRenderJob } from './relayVideoRenderJob';
import { retrySessionProxyJob } from './retrySessionProxyJob';

type CallableHandler = (request: {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  rawRequest?: unknown;
  data?: unknown;
}) => Promise<unknown>;

interface CallableConfig {
  name: string;
  handler: CallableHandler;
  defaultData: Record<string, unknown>;
  usesVerifiedCreativeUser?: boolean;
}

const callables: CallableConfig[] = [
  {
    name: 'alignSessionMaster',
    handler: alignSessionMaster as unknown as CallableHandler,
    defaultData: {
      sessionId: 'session-123',
      canonicalMasterRef: {
        bucket: 'test-bucket',
        path: 'masters/track-1.wav',
        generation: '123456789',
        sha256: 'a'.repeat(64),
        masterFingerprint: 'fp-123',
      },
    },
  },
  {
    name: 'approveSessionEditPlan',
    handler: approveSessionEditPlan as unknown as CallableHandler,
    defaultData: {
      sessionId: 'session-123',
      planId: 'plan-123',
      decisions: [{
        segmentId: 'seg-1',
        decision: 'approved',
      }],
    },
  },
  {
    name: 'cancelVideoSession',
    handler: cancelVideoSession as unknown as CallableHandler,
    defaultData: {
      sessionId: 'a'.repeat(40),
    },
  },
  {
    name: 'createVideoSession',
    handler: createVideoSession as unknown as CallableHandler,
    defaultData: {
      organizationId: 'org-123',
      projectId: 'proj-123',
      idempotencyKey: 'idemp-key-12345',
      expectedMimeType: 'video/mp4',
      expectedByteSize: 1024 * 1024,
    },
    usesVerifiedCreativeUser: true,
  },
  {
    name: 'generateSessionEditPlan',
    handler: generateSessionEditPlan as unknown as CallableHandler,
    defaultData: {
      sessionId: 'session-123',
    },
  },
  {
    name: 'queueCloudVideoRender',
    handler: queueCloudVideoRender as unknown as CallableHandler,
    defaultData: {
      projectId: 'proj-123',
      outputName: 'render.mp4',
    },
    usesVerifiedCreativeUser: true,
  },
  {
    name: 'claimVideoRenderJob',
    handler: claimVideoRenderJob as unknown as CallableHandler,
    defaultData: {
      jobId: 'job-123',
    },
    usesVerifiedCreativeUser: true,
  },
  {
    name: 'completeVideoRenderJob',
    handler: completeVideoRenderJob as unknown as CallableHandler,
    defaultData: {
      jobId: 'job-123',
      artifactUrl: 'https://example.com/render.mp4',
    },
    usesVerifiedCreativeUser: true,
  },
  {
    name: 'retrySessionProxyJob',
    handler: retrySessionProxyJob as unknown as CallableHandler,
    defaultData: {
      sessionId: 'a'.repeat(40),
    },
  },
];

describe('Video Session Lifecycle & Render Queue Admission Gates (ISSUE-1543 Batch 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.validateAppCheck.mockImplementation(() => undefined);
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.requireVerifiedCreativeUser.mockImplementation((auth: { uid?: string } | null | undefined) => {
      if (!auth?.uid) throw new Error('User must be authenticated.');
      return auth.uid;
    });
    mocks.requireVerifiedServerEntitlement.mockResolvedValue({ tier: 'pro' });
    mocks.checkOperationBudget.mockResolvedValue({ allowed: true, operationId: 'op-123' });

    mocks.storageBucket.mockReturnValue({
      name: 'test-bucket',
      file: vi.fn(() => ({
        exists: vi.fn().mockResolvedValue([true]),
        delete: vi.fn().mockResolvedValue([]),
      })),
    });

    mocks.firestoreDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        ownerUid: 'user-123',
        userId: 'user-123',
        status: 'queued',
        projectId: 'proj-123',
        organizationId: 'org-123',
        project: { scenes: [] },
        original: { generation: '1' },
        guideAudioRef: {
          schemaVersion: 'canonical-media-ref.v1',
          role: 'guide_audio',
          ownerUid: 'user-123',
          organizationId: 'org-123',
          projectId: 'proj-123',
          bucket: 'test-bucket',
          path: 'guide.wav',
          generation: '1',
          sha256: 'a'.repeat(64),
          mimeType: 'audio/wav',
        },
      }),
    });

    mocks.firestoreRunTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        create: mocks.firestoreDocCreate,
        update: mocks.firestoreDocUpdate,
      };
      return cb(tx);
    });
  });

  for (const { name, handler, defaultData, usesVerifiedCreativeUser } of callables) {
    describe(name, () => {
      it('validates App Check token', async () => {
        mocks.validateAppCheck.mockImplementationOnce(() => {
          throw new Error('Unauthorized: Missing App Check token.');
        });
        await expect(
          handler({
            auth: { uid: 'user-123' },
            data: defaultData,
          })
        ).rejects.toThrow('Unauthorized: Missing App Check token.');
      });

      it('rejects unauthenticated requests', async () => {
        if (usesVerifiedCreativeUser) {
          mocks.requireVerifiedCreativeUser.mockImplementationOnce(() => {
            throw new Error('User must be authenticated.');
          });
        }
        await expect(
          handler({
            auth: null,
            data: defaultData,
          })
        ).rejects.toThrow(/authenticated|authentication/i);
      });

      it('rejects anonymous callers', async () => {
        if (usesVerifiedCreativeUser) {
          mocks.requireVerifiedCreativeUser.mockImplementationOnce(() => {
            throw new Error('Anonymous accounts may not perform this operation.');
          });
        }
        await expect(
          handler({
            auth: {
              uid: 'anon-user',
              token: { firebase: { sign_in_provider: 'anonymous' } },
            },
            data: defaultData,
          })
        ).rejects.toThrow('Anonymous accounts may not perform this operation.');
      });

      it('enforces Arcjet protection when rawRequest is present', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          status: 429,
          message: 'Too Many Requests',
        });

        await expect(
          handler({
            auth: { uid: 'user-123' },
            rawRequest: { headers: {}, ip: '127.0.0.1' },
            data: defaultData,
          })
        ).rejects.toThrow('Request rate limit exceeded. Please try again later.');

        expect(mocks.protectAuthenticated).toHaveBeenCalled();
      });
    });
  }
});
