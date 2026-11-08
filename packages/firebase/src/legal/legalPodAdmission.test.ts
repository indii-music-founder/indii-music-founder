import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  protectAnonymous: vi.fn(),
  validateAppCheck: vi.fn(),
  firestoreDocGet: vi.fn(),
  firestoreDocSet: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: mocks.firestoreDocGet,
            set: mocks.firestoreDocSet,
          })),
        })),
      })),
      where: vi.fn().mockReturnThis(),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
    })),
  }));
  Object.assign(firestore, {
    FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    Timestamp: {
      now: vi.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
      fromDate: vi.fn((d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() })),
    },
  });
  return {
    default: {
      apps: [{ name: 'mock-app' }],
      initializeApp: vi.fn(),
      firestore,
      storage: vi.fn(() => ({
        bucket: vi.fn(() => ({
          name: 'mock-bucket',
          file: vi.fn(() => ({
            save: vi.fn().mockResolvedValue(undefined),
            getMetadata: vi.fn().mockResolvedValue([{ size: 1024, contentType: 'image/png' }]),
            download: vi.fn().mockResolvedValue([Buffer.from('fake-png')]),
          })),
        })),
      })),
    },
    apps: [{ name: 'mock-app' }],
    initializeApp: vi.fn(),
    firestore,
    storage: vi.fn(() => ({
      bucket: vi.fn(() => ({
        name: 'mock-bucket',
        file: vi.fn(() => ({
          save: vi.fn().mockResolvedValue(undefined),
          getMetadata: vi.fn().mockResolvedValue([{ size: 1024, contentType: 'image/png' }]),
          download: vi.fn().mockResolvedValue([Buffer.from('fake-png')]),
        })),
      })),
    })),
  };
});

vi.mock('firebase-admin/firestore', () => {
  const getFirestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
      })),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
    })),
  }));
  return {
    getFirestore,
    FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    Timestamp: {
      now: vi.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
      fromDate: vi.fn((d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() })),
    },
  };
});

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        save: vi.fn().mockResolvedValue(undefined),
        getSignedUrl: vi.fn().mockResolvedValue(['https://signed.storage.url']),
      })),
    })),
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

vi.mock('firebase-functions/params', () => ({
  defineString: vi.fn(() => ({ value: vi.fn(() => 'test-param') })),
  defineSecret: vi.fn((name: string) => ({ name, value: vi.fn(() => '') })),
}));

vi.mock('../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
  pandaDocApiKey: { name: 'PANDADOC_API_KEY' },
  pandadocWebhookSecret: { name: 'PANDADOC_WEBHOOK_SECRET', value: vi.fn(() => 'test-secret') },
  printfulApiKey: { name: 'PRINTFUL_API_KEY' },
  stripeSecretKey: { name: 'STRIPE_SECRET_KEY' },
  getPandaDocApiKey: vi.fn(() => 'test-pandadoc-key'),
}));

vi.mock('../functions/security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
  protectAnonymousSignupRequest: mocks.protectAnonymous,
}));

vi.mock('../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../pod/printfulApi', () => ({
  printfulRequest: vi.fn().mockResolvedValue([]),
  getPrintfulOrder: vi.fn().mockResolvedValue({ status: 'draft', items: [] }),
  estimatePrintfulOrderCosts: vi.fn().mockResolvedValue({ total: '10.00', currency: 'usd' }),
}));

vi.mock('../stripe/config', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/test' }),
      },
    },
  },
}));

vi.mock('../functions/billing/enforceOperationCost', () => ({
  requireVerifiedCreativeUser: vi.fn((auth: any) => {
    if (!auth?.uid) {
      const err = new Error('User must be authenticated.');
      (err as unknown as { code: string }).code = 'unauthenticated';
      throw err;
    }
    if (auth.token?.firebase?.sign_in_provider === 'anonymous') {
      const err = new Error('Anonymous accounts may not perform this operation.');
      (err as unknown as { code: string }).code = 'permission-denied';
      throw err;
    }
    if (auth.token?.email_verified === false) {
      const err = new Error('Verified email is required.');
      (err as unknown as { code: string }).code = 'permission-denied';
      throw err;
    }
    return auth.uid;
  }),
}));

import { enqueuePrintJob } from '../functions/print/enqueuePrintJob';
import { preparePrintHandoff } from '../functions/print/preparePrintHandoff';
import { sendForDigitalSignature } from './digitalSignature';
import { exportSplitSheet } from './exportSplitSheet';
import { verifyMechanicalLicense, searchSongfile, requestMechanicalLicense } from './mechanicalLicense';
import {
  pandadocListTemplates,
  pandadocCreateDocument,
  pandadocSendDocument,
  pandadocGetDocumentStatus,
  pandadocGetSigningLink,
} from './pandadocProxy';
import { pandadocWebhook } from './pandadocWebhook';
import { pod_createOrderCheckout } from '../pod/checkout';
import {
  pod_printfulGetProducts,
  pod_printfulGetProduct,
  pod_printfulCalculatePrice,
  pod_printfulGetShippingRates,
  pod_printfulCreateOrder,
  pod_printfulGetOrder,
  pod_printfulCancelOrder,
  pod_printfulGenerateMockup,
} from '../pod/printful';

const baseRequest = (overrides: Record<string, unknown> = {}, defaultData: Record<string, unknown> = {}) => ({
  auth: {
    uid: 'legal_pod_user_1',
    token: {
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    },
  },
  data: defaultData,
  rawRequest: { method: 'POST', headers: {} },
  ...overrides,
}) as never;

describe('Legal & POD Callables Admission & Arcjet Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.protectAnonymous.mockResolvedValue({ allowed: true });
    mocks.firestoreDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'draft', ownerUid: 'legal_pod_user_1' }),
    });
  });

  const callables: Array<{
    name: string;
    fn: unknown;
    data?: Record<string, unknown>;
  }> = [
    { name: 'enqueuePrintJob', fn: enqueuePrintJob },
    { name: 'preparePrintHandoff', fn: preparePrintHandoff },
    { name: 'sendForDigitalSignature', fn: sendForDigitalSignature },
    { name: 'exportSplitSheet', fn: exportSplitSheet },
    { name: 'verifyMechanicalLicense', fn: verifyMechanicalLicense, data: { trackTitle: 'Song', originalArtist: 'Artist' } },
    { name: 'searchSongfile', fn: searchSongfile, data: { title: 'Song' } },
    { name: 'requestMechanicalLicense', fn: requestMechanicalLicense, data: { licenseId: 'ml_123', userId: 'legal_pod_user_1' } },
    { name: 'pandadocListTemplates', fn: pandadocListTemplates },
    { name: 'pandadocCreateDocument', fn: pandadocCreateDocument },
    { name: 'pandadocSendDocument', fn: pandadocSendDocument },
    { name: 'pandadocGetDocumentStatus', fn: pandadocGetDocumentStatus },
    { name: 'pandadocGetSigningLink', fn: pandadocGetSigningLink },
    { name: 'pod_createOrderCheckout', fn: pod_createOrderCheckout },
    { name: 'pod_printfulGetProducts', fn: pod_printfulGetProducts },
    { name: 'pod_printfulGetProduct', fn: pod_printfulGetProduct },
    { name: 'pod_printfulCalculatePrice', fn: pod_printfulCalculatePrice },
    { name: 'pod_printfulGetShippingRates', fn: pod_printfulGetShippingRates },
    { name: 'pod_printfulCreateOrder', fn: pod_printfulCreateOrder },
    { name: 'pod_printfulGetOrder', fn: pod_printfulGetOrder },
    { name: 'pod_printfulCancelOrder', fn: pod_printfulCancelOrder },
    { name: 'pod_printfulGenerateMockup', fn: pod_printfulGenerateMockup },
  ];

  for (const { name, fn, data = {} } of callables) {
    describe(`${name} admission`, () => {
      const invoke = fn as unknown as (req: unknown) => Promise<unknown>;

      it('rejects unauthenticated requests', async () => {
        await expect(invoke(baseRequest({ auth: null, data }))).rejects.toMatchObject({
          code: 'unauthenticated',
        });
      });

      it('rejects anonymous callers', async () => {
        await expect(
          invoke(
            baseRequest(
              {
                auth: {
                  uid: 'anon_user',
                  token: { firebase: { sign_in_provider: 'anonymous' }, email_verified: true },
                },
              },
              data,
            )
          )
        ).rejects.toMatchObject({ code: 'permission-denied' });
      });

      it('rejects unverified email accounts', async () => {
        await expect(
          invoke(
            baseRequest(
              {
                auth: {
                  uid: 'unverified_user',
                  token: { firebase: { sign_in_provider: 'password' }, email_verified: false },
                },
              },
              data,
            )
          )
        ).rejects.toMatchObject({ code: 'permission-denied' });
      });

      it('enforces Arcjet rate limits on authenticated requests', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          status: 429,
          message: 'Rate limit exceeded.',
        });
        await expect(invoke(baseRequest({}, data))).rejects.toMatchObject({
          code: 'resource-exhausted',
        });
      });

      it('enforces Arcjet denial with permission-denied', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          status: 403,
          message: 'Forbidden.',
        });
        await expect(invoke(baseRequest({}, data))).rejects.toMatchObject({
          code: 'permission-denied',
        });
      });
    });
  }

  describe('pandadocWebhook admission', () => {
    it('enforces Arcjet rate limiting on HTTP webhook requests', async () => {
      mocks.protectAnonymous.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Too Many Requests',
      });

      const res = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };
      const req = {
        method: 'POST',
        headers: {},
        ip: '198.51.100.1',
      };

      const handler = pandadocWebhook as unknown as (req: unknown, res: unknown) => Promise<void>;
      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send).toHaveBeenCalledWith('Too Many Requests');
    });
  });

  describe('Mechanical Licensing Functional Contracts (ISSUE-1566)', () => {
    beforeEach(() => {
      mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    });

    it('verifyMechanicalLicense returns structured guidance and statutory rate without throwing unimplemented', async () => {
      const invoke = verifyMechanicalLicense as unknown as (req: unknown) => Promise<{
        status: string;
        requiresClearance: boolean;
        rate: number;
        guidance: string;
        clearanceLinks: { songfile: string; mlc: string };
      }>;
      const res = await invoke(baseRequest({}, { trackTitle: 'Blackbird', originalArtist: 'The Beatles' }));
      expect(res.status).toBe('UNVERIFIED');
      expect(res.requiresClearance).toBe(true);
      expect(res.rate).toBe(0.124);
      expect(res.clearanceLinks.songfile).toBe('https://www.songfile.com');
      expect(res.guidance).toContain('No automated licensing API is connected');
    });

    it('searchSongfile returns composition metadata', async () => {
      const invoke = searchSongfile as unknown as (req: unknown) => Promise<{
        result: { title: string; writers: string[]; controlled: boolean };
      }>;
      const res = await invoke(baseRequest({}, { title: 'Yesterday', writer: 'Paul McCartney' }));
      expect(res.result.title).toBe('Yesterday');
      expect(res.result.writers).toContain('Paul McCartney');
      expect(res.result.controlled).toBe(true);
    });

    it('requestMechanicalLicense returns generated licenseNumber and requested status', async () => {
      const invoke = requestMechanicalLicense as unknown as (req: unknown) => Promise<{
        result: { licenseNumber: string; status: string };
      }>;
      const res = await invoke(baseRequest({ auth: { uid: 'user-1' } }, { licenseId: 'lic-123', userId: 'user-1' }));
      expect(res.result.licenseNumber).toMatch(/^HFA_[A-F0-9]{8}$/);
      expect(res.result.status).toBe('license_requested');
    });
  });
});
