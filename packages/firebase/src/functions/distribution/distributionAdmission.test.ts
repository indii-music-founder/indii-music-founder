import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  protectAnonymous: vi.fn(),
  validateAppCheck: vi.fn(),
  firestore: vi.fn(),
}));

vi.mock('firebase-admin', () => ({
  firestore: Object.assign(mocks.firestore, {
    FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
  }),
  storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        exists: vi.fn().mockResolvedValue([true]),
        getSignedUrl: vi.fn().mockResolvedValue(['https://signed.url/download']),
      })),
      name: 'default-bucket',
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

import {
  assignDistributionIdentifier,
  recordDistributionIdentifier,
  recordDistributionAuditEvent,
  requestDistributionTakedown,
  createSftpIngestionRecord,
  updateSftpIngestionRecord,
} from './distributionRecords';

const baseRequest = (overrides: Record<string, unknown> = {}) => ({
  auth: {
    uid: 'artist_dist_1',
    token: {
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    },
  },
  data: {},
  rawRequest: { method: 'POST', headers: {} },
  ...overrides,
}) as never;

describe('Distribution Callables Admission & Arcjet Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.protectAnonymous.mockResolvedValue({ allowed: true });
  });

  describe('assignDistributionIdentifier admission', () => {
    const invoke = assignDistributionIdentifier as unknown as (req: unknown) => Promise<unknown>;

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

  describe('recordDistributionIdentifier admission', () => {
    const invoke = recordDistributionIdentifier as unknown as (req: unknown) => Promise<unknown>;

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
        message: 'Bot activity detected.',
      });
      await expect(invoke(baseRequest())).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });
  });

  describe('recordDistributionAuditEvent admission', () => {
    const invoke = recordDistributionAuditEvent as unknown as (req: unknown) => Promise<unknown>;

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
  });

  describe('requestDistributionTakedown admission', () => {
    const invoke = requestDistributionTakedown as unknown as (req: unknown) => Promise<unknown>;

    it('rejects unauthenticated callers', async () => {
      await expect(invoke(baseRequest({ auth: null }))).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('enforces Arcjet protection denial', async () => {
      mocks.protectAuthenticated.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'Takedown rate limit reached.',
      });
      await expect(invoke(baseRequest())).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });

  describe('createSftpIngestionRecord admission', () => {
    const invoke = createSftpIngestionRecord as unknown as (req: unknown) => Promise<unknown>;

    it('rejects unauthenticated callers', async () => {
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
  });

  describe('updateSftpIngestionRecord admission', () => {
    const invoke = updateSftpIngestionRecord as unknown as (req: unknown) => Promise<unknown>;

    it('rejects unauthenticated callers', async () => {
      await expect(invoke(baseRequest({ auth: null }))).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('enforces Arcjet denial', async () => {
      mocks.protectAuthenticated.mockResolvedValueOnce({
        allowed: false,
        status: 429,
        message: 'SFTP limit reached.',
      });
      await expect(invoke(baseRequest())).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });
});
