import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  validateAppCheck: vi.fn(),
  firestoreDocGet: vi.fn(),
  firestoreDocSet: vi.fn(),
  firestoreDocUpdate: vi.fn(),
  firestoreRunTransaction: vi.fn(),
  storageBucket: vi.fn(),
  storageFile: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        update: mocks.firestoreDocUpdate,
      })),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
      update: mocks.firestoreDocUpdate,
    })),
  }));
  return {
    default: {
      apps: [{ name: 'mock-app' }],
      initializeApp: vi.fn(),
      firestore,
      storage: vi.fn(() => ({
        bucket: mocks.storageBucket,
      })),
    },
    apps: [{ name: 'mock-app' }],
    initializeApp: vi.fn(),
    firestore,
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
        update: mocks.firestoreDocUpdate,
      })),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ id: 'mock-purchase-id' }],
      }),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
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

vi.mock('../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
  stripeSecretKey: { name: 'STRIPE_SECRET_KEY' },
}));

vi.mock('../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../functions/security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
}));

vi.mock('../stripe/config', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: 'cs_123', url: 'https://checkout.stripe.com/test' }),
      },
    },
  },
}));

import { createMarketplaceCheckout } from './createMarketplaceCheckout';
import { getStemDownloadUrl } from './getStemDownloadUrl';
import { generateReleaseDownloadUrl } from '../releases/generateDownloadUrl';
import { fetchStorageAssetForCanvas } from '../functions/storage/fetchStorageAssetForCanvas';

type CallableHandler = (request: {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  rawRequest?: unknown;
  data?: unknown;
}) => Promise<unknown>;

const callables: Array<{ name: string; handler: CallableHandler; defaultData: Record<string, unknown> }> = [
  {
    name: 'createMarketplaceCheckout',
    handler: createMarketplaceCheckout as unknown as CallableHandler,
    defaultData: { productId: 'prod-123', successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel' },
  },
  {
    name: 'getStemDownloadUrl',
    handler: getStemDownloadUrl as unknown as CallableHandler,
    defaultData: { productId: 'prod-123', label: 'Vocals' },
  },
  {
    name: 'generateReleaseDownloadUrl',
    handler: generateReleaseDownloadUrl as unknown as CallableHandler,
    defaultData: { platform: 'mac' },
  },
  {
    name: 'fetchStorageAssetForCanvas',
    handler: fetchStorageAssetForCanvas as unknown as CallableHandler,
    defaultData: { uri: 'gs://mock-bucket/users/user-123/assets/asset.png' },
  },
];

describe('Marketplace, Releases & Storage Asset Download Gates (ISSUE-1543 Batch 11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateAppCheck.mockImplementation(() => undefined);
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.firestoreDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        isActive: true,
        sellerId: 'seller-456',
        buyerId: 'user-123',
        title: 'Stem Pack',
        price: 2500,
        currency: 'USD',
        isFounder: true,
        stemFiles: [{ label: 'Vocals', storagePath: 'stems/vocals.wav' }],
      }),
      ref: { update: mocks.firestoreDocUpdate },
    });
    mocks.firestoreRunTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        update: mocks.firestoreDocUpdate,
      };
      return cb(tx);
    });

    const fileMock = {
      exists: vi.fn().mockResolvedValue([true]),
      getSignedUrl: vi.fn().mockResolvedValue(['https://storage.googleapis.com/signed-download']),
      getMetadata: vi.fn().mockResolvedValue([{ size: 2048, contentType: 'image/png' }]),
      download: vi.fn().mockResolvedValue([Buffer.from('mock-asset-data')]),
    };

    mocks.storageFile.mockReturnValue(fileMock);
    mocks.storageBucket.mockReturnValue({
      name: 'mock-bucket',
      file: mocks.storageFile,
    });
  });

  for (const { name, handler, defaultData } of callables) {
    describe(name, () => {
      it('validates App Check on invocation', async () => {
        const error = new Error('App Check failed');
        mocks.validateAppCheck.mockImplementationOnce(() => {
          throw error;
        });

        await expect(
          handler({
            auth: { uid: 'user-123' },
            data: defaultData,
          }),
        ).rejects.toThrow('App Check failed');
        expect(mocks.validateAppCheck).toHaveBeenCalled();
      });

      it('rejects unauthenticated caller', async () => {
        await expect(
          handler({
            auth: null,
            data: defaultData,
          }),
        ).rejects.toThrow();
      });

      it('rejects anonymous caller', async () => {
        await expect(
          handler({
            auth: {
              uid: 'anon-123',
              token: { firebase: { sign_in_provider: 'anonymous' } },
            },
            data: defaultData,
          }),
        ).rejects.toThrow(/Anonymous|authenticated|permission-denied/i);
      });

      it('enforces Arcjet rate-limiting denial', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          reason: 'RATE_LIMIT_EXCEEDED',
        });

        await expect(
          handler({
            auth: { uid: 'user-123' },
            rawRequest: { headers: { 'x-forwarded-for': '127.0.0.1' } },
            data: defaultData,
          }),
        ).rejects.toThrow(/rate limit|resource-exhausted/i);
        expect(mocks.protectAuthenticated).toHaveBeenCalled();
      });

      it('permits valid authenticated request when Arcjet and App Check succeed', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({ allowed: true });

        const result = await handler({
          auth: { uid: 'user-123' },
          rawRequest: { headers: { 'x-forwarded-for': '127.0.0.1' } },
          data: defaultData,
        });
        expect(result).toBeDefined();
      });
    });
  }
});
