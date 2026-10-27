import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const firestoreQueryGet = vi.fn();
  const query: any = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: firestoreQueryGet,
  };
  return {
    protectAuthenticatedApiRequest: vi.fn(),
    protectAnonymousSignupRequest: vi.fn(),
    validateAppCheckV2: vi.fn(),
    enforceRateLimit: vi.fn(),
    firestoreDocGet: vi.fn(),
    firestoreDocSet: vi.fn(),
    firestoreDocAdd: vi.fn(),
    firestoreDocUpdate: vi.fn(),
    firestoreQueryGet,
    firestoreRunTransaction: vi.fn(),
    processRoyaltyAllocations: vi.fn(),
    processEarningsReport: vi.fn(),
    processRequestTaxFormUpload: vi.fn(),
    processSetRecoupmentBalance: vi.fn(),
    processSubmitTaxForm: vi.fn(),
    query,
  };
});

vi.mock('firebase-admin', () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      ...mocks.query,
      doc: vi.fn(() => ({
        id: 'mock-doc-id',
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        update: mocks.firestoreDocUpdate,
      })),
      add: mocks.firestoreDocAdd,
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
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
        },
      }),
    },
    apps: [{ name: 'mock-app' }],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestore, {
      FieldValue: {
        serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
      },
    }),
  };
});

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheckV2,
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticatedApiRequest,
  protectAnonymousSignupRequest: mocks.protectAnonymousSignupRequest,
}));

vi.mock('../../lib/rateLimit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  RATE_LIMITS: { sensitive: { max: 10, windowMs: 60000 } },
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

import { calculateRoyaltyAllocations } from './calculateRoyaltyAllocations';
import { ingestEarningsReport } from './ingestEarningsReport';
import { parseAndIngestRoyaltyReport } from './parseAndIngestReport';
import { requestTaxFormUpload } from './requestTaxFormUpload';
import { setRecoupmentBalance } from './setRecoupmentBalance';
import { submitTaxForm } from './submitTaxForm';

describe('Unit 21 Admission Security: Finance Allocations, Ingestion, Reports & Tax Submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateAppCheckV2.mockReturnValue(undefined);
    mocks.protectAuthenticatedApiRequest.mockResolvedValue({ allowed: true });
    mocks.protectAnonymousSignupRequest.mockResolvedValue({ allowed: true });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.firestoreDocGet.mockResolvedValue({ exists: true, data: () => ({ balanceMicros: 0 }) });
    mocks.firestoreRunTransaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      return cb({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
        set: vi.fn(),
        update: vi.fn(),
      });
    });
  });

  const call = (fn: any, ...args: any[]) => fn(...args);

  describe('calculateRoyaltyAllocations', () => {
    it('rejects failed AppCheck validation', async () => {
      mocks.validateAppCheckV2.mockImplementation(() => {
        throw new Error('AppCheck failed');
      });
      await expect(call(calculateRoyaltyAllocations, { auth: { uid: 'u1' }, data: { batchId: 'b-1' } }))
        .rejects.toThrow('AppCheck failed');
    });

    it('rejects unauthenticated caller', async () => {
      await expect(call(calculateRoyaltyAllocations, { data: { batchId: 'b-1' } }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(calculateRoyaltyAllocations, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: { batchId: 'b-1' },
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies with 429', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(calculateRoyaltyAllocations, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { batchId: 'b-1' },
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });
  });

  describe('ingestEarningsReport', () => {
    it('rejects failed AppCheck validation', async () => {
      mocks.validateAppCheckV2.mockImplementation(() => {
        throw new Error('AppCheck failed');
      });
      await expect(call(ingestEarningsReport, { auth: { uid: 'u1' }, data: {} }))
        .rejects.toThrow('AppCheck failed');
    });

    it('rejects unauthenticated caller', async () => {
      await expect(call(ingestEarningsReport, { data: {} }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(ingestEarningsReport, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: {},
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies with 429', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(ingestEarningsReport, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: {},
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });
  });

  describe('parseAndIngestRoyaltyReport', () => {
    it('rejects failed AppCheck validation', async () => {
      mocks.validateAppCheckV2.mockImplementation(() => {
        throw new Error('AppCheck failed');
      });
      await expect(call(parseAndIngestRoyaltyReport, { auth: { uid: 'u1' }, data: {} }))
        .rejects.toThrow('AppCheck failed');
    });

    it('rejects unauthenticated caller', async () => {
      await expect(call(parseAndIngestRoyaltyReport, { data: {} }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(parseAndIngestRoyaltyReport, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: {},
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies with 429', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(parseAndIngestRoyaltyReport, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: {},
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });

    it('rejects invalid or missing report payload arguments', async () => {
      await expect(call(parseAndIngestRoyaltyReport, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { fileName: '', contentBase64: 'not-base64' },
      })).rejects.toMatchObject({ code: 'invalid-argument' });
    });
  });

  describe('requestTaxFormUpload', () => {
    it('rejects failed AppCheck validation', async () => {
      mocks.validateAppCheckV2.mockImplementation(() => {
        throw new Error('AppCheck failed');
      });
      await expect(call(requestTaxFormUpload, { auth: { uid: 'u1' }, data: { collaboratorId: 'col-1' } }))
        .rejects.toThrow('AppCheck failed');
    });

    it('rejects unauthenticated caller', async () => {
      await expect(call(requestTaxFormUpload, { data: { collaboratorId: 'col-1' } }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(requestTaxFormUpload, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: { collaboratorId: 'col-1' },
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies with 429', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(requestTaxFormUpload, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { collaboratorId: 'col-1' },
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });

    it('passes admission and processes request for valid caller', async () => {
      const res = await call(requestTaxFormUpload, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: { collaboratorId: 'col-1' },
      });
      expect(res).toHaveProperty('uploadUrl');
      expect(res).toHaveProperty('expiresAt');
    });
  });

  describe('setRecoupmentBalance', () => {
    it('rejects failed AppCheck validation', async () => {
      mocks.validateAppCheckV2.mockImplementation(() => {
        throw new Error('AppCheck failed');
      });
      await expect(call(setRecoupmentBalance, { auth: { uid: 'u1' }, data: {} }))
        .rejects.toThrow('AppCheck failed');
    });

    it('rejects unauthenticated caller', async () => {
      await expect(call(setRecoupmentBalance, { data: {} }))
        .rejects.toMatchObject({ code: 'unauthenticated' });
    });

    it('rejects anonymous caller', async () => {
      await expect(call(setRecoupmentBalance, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'anonymous' } } },
        data: {},
      })).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects when Arcjet denies with 429', async () => {
      mocks.protectAuthenticatedApiRequest.mockResolvedValue({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      await expect(call(setRecoupmentBalance, {
        auth: { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } },
        rawRequest: {},
        data: {},
      })).rejects.toMatchObject({ code: 'resource-exhausted' });
    });
  });

  describe('submitTaxForm (onRequest)', () => {
    function createMockResponse() {
      const res: any = {};
      res.statusCode = 200;
      res.body = null;
      res.status = vi.fn((code: number) => {
        res.statusCode = code;
        return res;
      });
      res.send = vi.fn((payload: any) => {
        res.body = payload;
        return res;
      });
      res.json = vi.fn((payload: any) => {
        res.body = payload;
        return res;
      });
      return res;
    }

    it('rejects non-POST methods with 405', async () => {
      const req: any = { method: 'GET' };
      const res = createMockResponse();

      await call(submitTaxForm, req, res);
      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.body).toBe('Method Not Allowed');
    });

    it('rejects when Arcjet denies anonymous submission with 429', async () => {
      mocks.protectAnonymousSignupRequest.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded',
      });
      const req: any = { method: 'POST', ip: '1.2.3.4' };
      const res = createMockResponse();

      await call(submitTaxForm, req, res);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.body).toBe('Rate limit exceeded');
    });
  });
});
