import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  protectAnonymous: vi.fn(),
  validateAppCheck: vi.fn(),
  enforceRateLimit: vi.fn(),
  firestore: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
  firestore: Object.assign(mocks.firestore, {
    FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
  }),
  storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        save: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
  protectAnonymousSignupRequest: mocks.protectAnonymous,
}));

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../../lib/rateLimit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  RATE_LIMITS: { sensitive: 10 },
}));

import { calculateRoyaltyAllocations } from './calculateRoyaltyAllocations';
import { ingestEarningsReport } from './ingestEarningsReport';
import { parseAndIngestRoyaltyReport } from './parseAndIngestReport';
import { requestTaxFormUpload } from './requestTaxFormUpload';
import { setRecoupmentBalance } from './setRecoupmentBalance';
import { submitTaxForm } from './submitTaxForm';

const baseRequest = (overrides: Record<string, unknown> = {}) => ({
  auth: {
    uid: 'artist_1',
    token: {
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    },
  },
  data: {},
  rawRequest: { method: 'POST', headers: {} },
  ...overrides,
}) as never;

describe('Finance Callables Admission & Arcjet Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.protectAnonymous.mockResolvedValue({ allowed: true });
  });

  describe('calculateRoyaltyAllocations admission', () => {
    const invoke = calculateRoyaltyAllocations as unknown as (req: unknown) => Promise<unknown>;

    it('rejects unauthenticated requests', async () => {
      await expect(invoke(baseRequest({ auth: null }))).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects anonymous callers', async () => {
      await expect(
        invoke(
          baseRequest({
            auth: {
              uid: 'anon_1',
              token: { firebase: { sign_in_provider: 'anonymous' }, email_verified: true },
            },
          })
        )
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('rejects unverified email accounts', async () => {
      await expect(
        invoke(
          baseRequest({
            auth: {
              uid: 'user_1',
              token: { firebase: { sign_in_provider: 'password' }, email_verified: false },
            },
          })
        )
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('enforces Arcjet rate limits on authenticated requests', async () => {
      mocks.protectAuthenticated.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded.',
      });
      await expect(invoke(baseRequest())).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });

  describe('ingestEarningsReport admission', () => {
    const invoke = ingestEarningsReport as unknown as (req: unknown) => Promise<unknown>;

    it('rejects unauthenticated requests', async () => {
      await expect(invoke(baseRequest({ auth: null }))).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects anonymous callers', async () => {
      await expect(
        invoke(
          baseRequest({
            auth: {
              uid: 'anon_1',
              token: { firebase: { sign_in_provider: 'anonymous' }, email_verified: true },
            },
          })
        )
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('enforces Arcjet bot/rate limits', async () => {
      mocks.protectAuthenticated.mockResolvedValueOnce({
        allowed: false,
        status: 403,
        message: 'Bot detected.',
      });
      await expect(invoke(baseRequest())).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });
  });

  describe('parseAndIngestRoyaltyReport admission', () => {
    const invoke = parseAndIngestRoyaltyReport as unknown as (req: unknown) => Promise<unknown>;

    it('rejects unauthenticated requests', async () => {
      await expect(invoke(baseRequest({ auth: null }))).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects anonymous accounts', async () => {
      await expect(
        invoke(
          baseRequest({
            auth: {
              uid: 'anon_1',
              token: { firebase: { sign_in_provider: 'anonymous' }, email_verified: true },
            },
          })
        )
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('enforces Arcjet protection denial', async () => {
      mocks.protectAuthenticated.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Too many requests.',
      });
      await expect(invoke(baseRequest())).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });

  describe('requestTaxFormUpload admission', () => {
    const invoke = requestTaxFormUpload as unknown as (req: unknown) => Promise<unknown>;

    it('rejects unauthenticated requests', async () => {
      await expect(invoke(baseRequest({ auth: null }))).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects anonymous accounts', async () => {
      await expect(
        invoke(
          baseRequest({
            auth: {
              uid: 'anon_1',
              token: { firebase: { sign_in_provider: 'anonymous' }, email_verified: true },
            },
          })
        )
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('enforces Arcjet protection denial', async () => {
      mocks.protectAuthenticated.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Rate limit reached.',
      });
      await expect(invoke(baseRequest())).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });

  describe('setRecoupmentBalance admission', () => {
    const invoke = setRecoupmentBalance as unknown as (req: unknown) => Promise<unknown>;

    it('rejects unauthenticated requests', async () => {
      await expect(invoke(baseRequest({ auth: null }))).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('rejects anonymous accounts', async () => {
      await expect(
        invoke(
          baseRequest({
            auth: {
              uid: 'anon_1',
              token: { firebase: { sign_in_provider: 'anonymous' }, email_verified: true },
            },
          })
        )
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('enforces Arcjet protection denial', async () => {
      mocks.protectAuthenticated.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Rate limit reached.',
      });
      await expect(invoke(baseRequest())).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });

  describe('submitTaxForm onRequest Arcjet protection', () => {
    const invoke = submitTaxForm as unknown as (req: unknown, res: unknown) => Promise<void>;

    it('rejects non-POST methods with 405', async () => {
      const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
      await invoke({ method: 'GET' }, res);
      expect(res.status).toHaveBeenCalledWith(405);
    });

    it('enforces Arcjet anonymous signup protection', async () => {
      mocks.protectAnonymous.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Rate limit exceeded.',
      });
      const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
      await invoke({ method: 'POST', ip: '192.168.1.1' }, res);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send).toHaveBeenCalledWith('Rate limit exceeded.');
    });
  });
});
