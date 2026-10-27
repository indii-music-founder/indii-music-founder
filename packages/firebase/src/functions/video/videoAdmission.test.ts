import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  validateAppCheck: vi.fn(),
  firestore: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    })),
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  })),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mocks.firestore,
  FieldValue: {
    serverTimestamp: vi.fn(() => '__server_timestamp__'),
  },
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      name: 'video-bucket',
      file: vi.fn(() => ({
        exists: vi.fn().mockResolvedValue([true]),
        delete: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  })),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_options: unknown, handler: unknown) => handler),
  onRequest: vi.fn((_options: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
      public details?: unknown
    ) {
      super(message);
    }
  },
}));

vi.mock('../../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
}));

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../auth/entitlements', () => ({
  requireVerifiedServerEntitlement: vi.fn().mockResolvedValue({ tier: 'studio' }),
  entitlementTierToBudgetTier: vi.fn().mockReturnValue('standard'),
}));

import { alignSessionMaster } from './alignSessionMaster';
import { approveSessionEditPlan } from './approveSessionEditPlan';
import { cancelVideoSession } from './cancelVideoSession';
import { createVideoSession } from './createVideoSession';
import { generateSessionEditPlan } from './generateSessionEditPlan';
import { queueCloudVideoRender } from './queueCloudVideoRender';
import { claimVideoRenderJob, completeVideoRenderJob } from './relayVideoRenderJob';
import { retrySessionProxyJob } from './retrySessionProxyJob';

const baseRequest = (overrides: Record<string, unknown> = {}) => ({
  auth: {
    uid: 'video_user_1',
    token: {
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    },
  },
  data: {},
  rawRequest: { method: 'POST', headers: {} },
  ...overrides,
}) as never;

describe('Video Callables Admission & Arcjet Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
  });

  const callables = [
    { name: 'alignSessionMaster', fn: alignSessionMaster },
    { name: 'approveSessionEditPlan', fn: approveSessionEditPlan },
    { name: 'cancelVideoSession', fn: cancelVideoSession },
    { name: 'createVideoSession', fn: createVideoSession },
    { name: 'generateSessionEditPlan', fn: generateSessionEditPlan },
    { name: 'queueCloudVideoRender', fn: queueCloudVideoRender },
    { name: 'claimVideoRenderJob', fn: claimVideoRenderJob },
    { name: 'completeVideoRenderJob', fn: completeVideoRenderJob },
    { name: 'retrySessionProxyJob', fn: retrySessionProxyJob },
  ];

  for (const { name, fn } of callables) {
    describe(`${name} admission`, () => {
      const invoke = fn as unknown as (req: unknown) => Promise<unknown>;

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
                uid: 'anon_video_1',
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
                uid: 'unverified_video_1',
                token: { firebase: { sign_in_provider: 'password' }, email_verified: false },
              },
            })
          )
        ).rejects.toMatchObject({
          code: expect.stringMatching(/^(permission-denied|failed-precondition)$/),
        });
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

      it('enforces Arcjet denial with permission-denied', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          status: 403,
          message: 'Forbidden.',
        });
        await expect(invoke(baseRequest())).rejects.toMatchObject({
          code: 'permission-denied',
        });
      });
    });
  }
});
