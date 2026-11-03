import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  validateAppCheck: vi.fn(),
  firestoreDocGet: vi.fn(),
  firestoreDocSet: vi.fn(),
  firestoreRunTransaction: vi.fn(),
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
    runTransaction: mocks.firestoreRunTransaction,
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
    },
    apps: [{ name: 'mock-app' }],
    initializeApp: vi.fn(),
    firestore,
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
    runTransaction: mocks.firestoreRunTransaction,
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

vi.mock('../../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
  typesafeApiKey: { name: 'TYPESAFE_API_KEY' },
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
  policyClassForServerEntitlement: vi.fn().mockReturnValue('verified-free'),
}));

vi.mock('./arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
  policyClassForServerEntitlement: vi.fn().mockReturnValue('verified-free'),
}));

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
  requireVerifiedEmailV2: vi.fn((request: { auth?: { uid?: string; token?: { email_verified?: boolean; firebase?: { sign_in_provider?: string } } } }) => {
    if (!request.auth?.uid) {
      const err = new Error('User must be authenticated.');
      (err as unknown as { code: string }).code = 'unauthenticated';
      throw err;
    }
    if (request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
      const err = new Error('Anonymous accounts may not perform this operation.');
      (err as unknown as { code: string }).code = 'permission-denied';
      throw err;
    }
    if (request.auth?.token?.email_verified === false) {
      const err = new Error('Verified email is required.');
      (err as unknown as { code: string }).code = 'permission-denied';
      throw err;
    }
    return request.auth.uid;
  }),
}));

vi.mock('../auth/entitlements', () => ({
  requireVerifiedServerEntitlement: vi.fn().mockResolvedValue({ tier: 'free' }),
}));

vi.mock('../../middleware/entitlements', () => ({
  resolveEntitlement: vi.fn().mockResolvedValue({ tier: 'free' }),
  policyForEntitlement: vi.fn().mockReturnValue('verified-free'),
}));

import { claimComputerApproval, denyComputerApproval } from './claimComputerApproval';
import { listErrorReports, updateErrorReportStatus } from './errorReportCallables';
import { registerAiContextCache, recordInstrumentUsage } from './writeSharedOperationalData';
import { queryKnowledgeBase } from '../knowledge/query';
import { createKnowledgeUpload, finalizeKnowledgeUpload, deleteKnowledgeDocument } from '../knowledge/upload';
import { logAuditEvent } from './logAuditEvent';
import { persistFraudAlert } from './persistFraudAlert';
import { getOrganizationAccessMatrix, updateOrganizationMemberAccess } from './organizationAccess';

const baseRequest = (overrides: Record<string, unknown> = {}, defaultData: Record<string, unknown> = {}) => ({
  auth: {
    uid: 'security_user_1',
    token: {
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    },
  },
  data: defaultData,
  rawRequest: { method: 'POST', headers: {} },
  ...overrides,
}) as never;

describe('Security & Knowledge Callables Admission & Arcjet Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.firestoreDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ isFounder: true, tier: 'pro', founder: true }),
    });
  });

  const callables: Array<{
    name: string;
    fn: unknown;
    data?: Record<string, unknown>;
  }> = [
    { name: 'claimComputerApproval', fn: claimComputerApproval },
    { name: 'denyComputerApproval', fn: denyComputerApproval },
    { name: 'listErrorReports', fn: listErrorReports },
    { name: 'updateErrorReportStatus', fn: updateErrorReportStatus },
    { name: 'registerAiContextCache', fn: registerAiContextCache },
    { name: 'recordInstrumentUsage', fn: recordInstrumentUsage },
    { name: 'queryKnowledgeBase', fn: queryKnowledgeBase },
    { name: 'createKnowledgeUpload', fn: createKnowledgeUpload },
    { name: 'finalizeKnowledgeUpload', fn: finalizeKnowledgeUpload },
    { name: 'deleteKnowledgeDocument', fn: deleteKnowledgeDocument },
    { name: 'logAuditEvent', fn: logAuditEvent },
    { name: 'persistFraudAlert', fn: persistFraudAlert },
    {
      name: 'getOrganizationAccessMatrix',
      fn: getOrganizationAccessMatrix,
      data: { orgId: 'org-1' },
    },
    {
      name: 'updateOrganizationMemberAccess',
      fn: updateOrganizationMemberAccess,
      data: {
        orgId: 'org-1',
        targetUserId: 'user-2',
        role: 'member',
        allowedModules: ['analytics'],
      },
    },
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

      if (name === 'claimComputerApproval' || name === 'denyComputerApproval') {
        it('requires an explicit verified-email claim', async () => {
          await expect(invoke(baseRequest({
            auth: { uid: 'missing_email_claim', token: { firebase: { sign_in_provider: 'password' } } },
          }, data))).rejects.toMatchObject({ code: 'permission-denied' });
        });
      }

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
});
