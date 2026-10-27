import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  validateAppCheck: vi.fn(),
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
  typesafeApiKey: { value: vi.fn(() => 'mock-typesafe-key') },
}));

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
}));

vi.mock('../intelligence/typesafeClient', () => ({
  createTypesafeClient: vi.fn(() => ({
    judge: vi.fn().mockResolvedValue({ answers: { test: 0.95 } }),
  })),
  TypesafeClientError: class TypesafeClientError extends Error {
    kind = 'test';
    status = 500;
  },
  TYPESAFE_MODEL_PATTERN: /^[a-z0-9_-]+$/i,
  TYPESAFE_MAX_QUESTIONS: 50,
  TYPESAFE_MAX_STATE_CHARS: 50000,
}));

vi.mock('../../lib/PersonaMeasurement', () => ({
  measureAllAxes: vi.fn().mockResolvedValue([]),
  recordMeasurement: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/rateLimit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  RATE_LIMITS: { generation: { maxTokens: 100, refillRate: 10 } },
}));

vi.mock('../security/organizationAccess', () => ({
  admitOrganizationAccessRequest: vi.fn().mockResolvedValue('user-1'),
  organizationAccessCallableOptions: {
    secrets: [],
    enforceAppCheck: false,
  },
}));

vi.mock('./canonicalMusicCatalogStore', async () => {
  const actual = await vi.importActual<typeof import('./canonicalMusicCatalogStore')>('./canonicalMusicCatalogStore');
  return {
    ...actual,
    createCanonicalMusicCatalogStore: vi.fn(() => ({
      readClaimsInboxInput: vi.fn().mockResolvedValue({ claims: [], events: [], evaluatedAt: '2026-10-26T00:00:00Z', storageTruncated: false }),
      appendUserDeclaredClaim: vi.fn().mockResolvedValue({ claim: { id: 'claim-1' } }),
      respondToUserDeclaredClaim: vi.fn().mockResolvedValue({ claim: { id: 'claim-1', status: 'ASSERTED' } }),
      readCatalogIntelligenceInput: vi.fn().mockResolvedValue({
        snapshot: { catalogId: 'canonical:user:user-1', completeness: 'UNKNOWN' as const },
        entities: [],
        identifiers: [],
        relationships: [],
        evaluatedAt: '2026-10-26T00:00:00.000Z',
      }),
    })),
  };
});

import { getCanonicalClaimsInbox, declareCanonicalRightsClaim, respondToCanonicalRightsClaim } from './claimsInbox';
import { getCanonicalMusicCatalogIntelligence } from './getCanonicalMusicCatalogIntelligence';
import { createPurgeIntent, purgeTrashItems } from '../trash/trashFunctions';
import { typesafeJudge } from '../intelligence/typesafeJudge';
import { recordPersonaResponseMeasurement } from '../persona/recordPersonaResponseMeasurement';
import { queueRightsRegistration } from '../rights/queueRightsRegistration';
import { rightsRegistration } from '../rights/rightsRegistration';

type CallableHandler = (request: {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  rawRequest?: unknown;
  data?: unknown;
}) => Promise<unknown>;

interface CallableConfig {
  name: string;
  handler: CallableHandler;
  defaultData: Record<string, unknown>;
  expectedOpPrefix: string;
}

const callables: CallableConfig[] = [
  {
    name: 'getCanonicalClaimsInbox',
    handler: getCanonicalClaimsInbox as unknown as CallableHandler,
    defaultData: { scope: { kind: 'user', id: 'user-1' } },
    expectedOpPrefix: 'claims-inbox-read:',
  },
  {
    name: 'declareCanonicalRightsClaim',
    handler: declareCanonicalRightsClaim as unknown as CallableHandler,
    defaultData: {
      scope: { kind: 'user', id: 'user-1' },
      targetEntityId: 'recording-internal-1',
      type: 'MASTER',
    },
    expectedOpPrefix: 'claims-inbox-declare:',
  },
  {
    name: 'respondToCanonicalRightsClaim',
    handler: respondToCanonicalRightsClaim as unknown as CallableHandler,
    defaultData: {
      scope: { kind: 'user', id: 'user-1' },
      claimId: 'claim-1',
      status: 'ASSERTED',
    },
    expectedOpPrefix: 'claims-inbox-respond:',
  },
  {
    name: 'getCanonicalMusicCatalogIntelligence',
    handler: getCanonicalMusicCatalogIntelligence as unknown as CallableHandler,
    defaultData: { scope: { kind: 'user', id: 'user-1' } },
    expectedOpPrefix: 'canonical-music-catalog-intelligence:',
  },
  {
    name: 'createPurgeIntent',
    handler: createPurgeIntent as unknown as CallableHandler,
    defaultData: {
      trashIds: ['trash_item_1'],
      confirmation: 'DELETE',
    },
    expectedOpPrefix: 'trash-create-purge-intent:',
  },
  {
    name: 'purgeTrashItems',
    handler: purgeTrashItems as unknown as CallableHandler,
    defaultData: {
      trashIds: ['trash_item_1'],
      intentToken: 'intent_0123456789abcdef0123456789abcdef',
    },
    expectedOpPrefix: 'trash-purge-items:',
  },
  {
    name: 'typesafeJudge',
    handler: typesafeJudge as unknown as CallableHandler,
    defaultData: {
      state: { text: 'song' },
      questions: { q1: 'Is this coherent?' },
    },
    expectedOpPrefix: 'typesafe-judge:',
  },
  {
    name: 'recordPersonaResponseMeasurement',
    handler: recordPersonaResponseMeasurement as unknown as CallableHandler,
    defaultData: {
      personaId: 'manager',
      responseId: 'resp-1',
      responseText: 'Valid persona test text for response measurement.',
      setPositions: {
        riskTolerance: 10,
        brevity: 20,
        directness: 30,
        formality: 40,
        reasoningTransparency: 50,
      },
      isControlGroup: false,
    },
    expectedOpPrefix: 'persona-measurement:',
  },
  {
    name: 'queueRightsRegistration',
    handler: queueRightsRegistration as unknown as CallableHandler,
    defaultData: {
      provider: 'ascap',
      metadata: { trackTitle: 'My Single' },
    },
    expectedOpPrefix: 'queue-rights-registration:',
  },
  {
    name: 'rightsRegistration',
    handler: rightsRegistration as unknown as CallableHandler,
    defaultData: {
      action: 'capabilities',
      payload: {},
    },
    expectedOpPrefix: 'rights-registration:',
  },
];

describe('Unit 18 Admission: Music Catalog, Rights, AI Judge & Trash Lifecycle (ISSUE-1543 Batch 15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.firestoreDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        uid: 'user-1',
        ownerUid: 'user-1',
        expiresAt: Date.now() + 60000,
        trashIds: ['trash_item_1'],
        type: 'file_nodes',
        targetId: 'file-1',
        state: 'trashed',
      }),
    });
    mocks.firestoreDocSet.mockResolvedValue({ id: 'saved-id' });
    mocks.firestoreDocUpdate.mockResolvedValue({});
    mocks.firestoreRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        update: mocks.firestoreDocUpdate,
        delete: vi.fn(),
        create: vi.fn(),
      });
    });
    mocks.storageBucket.mockReturnValue({
      name: 'test-bucket',
      file: vi.fn(() => ({
        delete: vi.fn().mockResolvedValue([{}]),
        getMetadata: vi.fn().mockResolvedValue([{ size: 1000, contentType: 'audio/wav', generation: '1' }]),
      })),
    });
  });

  for (const { name, handler, defaultData, expectedOpPrefix } of callables) {
    describe(`${name} admission boundary`, () => {
      it('validates App Check on every request', async () => {
        mocks.validateAppCheck.mockImplementationOnce(() => {
          throw new Error('Missing App Check token.');
        });

        await expect(
          handler({
            auth: { uid: 'user-1', token: { email_verified: true, auth_time: Math.floor(Date.now() / 1000) } },
            rawRequest: { headers: { 'x-arcjet-test': '1' } },
            data: defaultData,
          }),
        ).rejects.toThrow('Missing App Check token.');
        expect(mocks.validateAppCheck).toHaveBeenCalled();
      });

      it('rejects unauthenticated requests', async () => {
        await expect(
          handler({
            auth: null,
            rawRequest: { headers: {} },
            data: defaultData,
          }),
        ).rejects.toMatchObject({ code: 'unauthenticated' });
      });

      it('rejects anonymous accounts', async () => {
        await expect(
          handler({
            auth: {
              uid: 'anon-1',
              token: {
                firebase: { sign_in_provider: 'anonymous' },
                email_verified: true,
                auth_time: Math.floor(Date.now() / 1000),
              },
            },
            rawRequest: { headers: {} },
            data: defaultData,
          }),
        ).rejects.toMatchObject({
          code: expect.stringMatching(/permission-denied|unauthenticated/),
        });
      });

      it('blocks request when Arcjet protection denies rate limit', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          status: 429,
          message: 'Rate limit exceeded',
        });

        await expect(
          handler({
            auth: {
              uid: 'user-1',
              token: { email_verified: true, auth_time: Math.floor(Date.now() / 1000) },
            },
            rawRequest: { headers: { 'x-forwarded-for': '127.0.0.1' } },
            data: defaultData,
          }),
        ).rejects.toMatchObject({ code: 'resource-exhausted' });

        expect(mocks.protectAuthenticated).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            userId: 'user-1',
            policy: 'verified-free',
            operationId: expect.stringContaining(expectedOpPrefix),
          }),
        );
      });

      it('allows request when validly authenticated and Arcjet allows', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({ allowed: true });

        const result = await handler({
          auth: {
            uid: 'user-1',
            token: { email_verified: true, auth_time: Math.floor(Date.now() / 1000) },
          },
          rawRequest: { headers: { 'x-forwarded-for': '127.0.0.1' } },
          data: defaultData,
        });

        expect(mocks.protectAuthenticated).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            userId: 'user-1',
            policy: 'verified-free',
            operationId: expect.stringContaining(expectedOpPrefix),
          }),
        );
        expect(result).toBeDefined();
      });
    });
  }
});
