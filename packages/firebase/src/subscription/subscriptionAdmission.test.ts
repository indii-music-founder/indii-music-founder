import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  validateAppCheck: vi.fn(),
  firestoreDocGet: vi.fn(),
  firestoreDocSet: vi.fn(),
  firestoreDocUpdate: vi.fn(),
  firestoreRunTransaction: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => {
  const getFirestore = vi.fn(() => ({
    collection: vi.fn((colName: string) => ({
      doc: vi.fn((id: string) => ({
        id,
        path: `${colName}/${id}`,
        get: () => mocks.firestoreDocGet({ id, path: `${colName}/${id}` }),
        set: mocks.firestoreDocSet,
        update: mocks.firestoreDocUpdate,
        collection: vi.fn((subCol: string) => ({
          doc: vi.fn((subId: string) => ({
            id: subId,
            path: `${colName}/${id}/${subCol}/${subId}`,
            get: () => mocks.firestoreDocGet({ id: subId, path: `${colName}/${id}/${subCol}/${subId}` }),
            set: mocks.firestoreDocSet,
            update: mocks.firestoreDocUpdate,
          })),
        })),
      })),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      get: () => mocks.firestoreDocGet(),
      add: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
    })),
    doc: vi.fn((docPath: string) => ({
      id: docPath.split('/').pop(),
      path: docPath,
      get: () => mocks.firestoreDocGet({ id: docPath.split('/').pop(), path: docPath }),
      set: mocks.firestoreDocSet,
      update: mocks.firestoreDocUpdate,
    })),
    runTransaction: mocks.firestoreRunTransaction,
  }));
  return {
    getFirestore,
    FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    FieldPath: class FieldPath {
      constructor(public field: string, public value: unknown) {}
    },
    Timestamp: {
      now: vi.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
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

vi.mock('../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
  stripeSecretKey: { name: 'STRIPE_SECRET_KEY' },
  githubTokenFounders: { name: 'GITHUB_TOKEN_FOUNDERS', value: vi.fn(() => 'mock-gh-token') },
}));

vi.mock('../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../functions/security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
}));

vi.mock('../stripe/config', () => ({
  stripe: {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_123' }),
      retrieve: vi.fn().mockResolvedValue({ id: 'cus_123', name: 'Test User', email: 'test@example.com' }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: 'cs_123', url: 'https://checkout.stripe.com/test' }),
      },
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue({ id: 'sub_123', cancel_at_period_end: true, status: 'active' }),
      update: vi.fn().mockResolvedValue({ id: 'sub_123', cancel_at_period_end: false, status: 'active' }),
    },
    invoices: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'in_123',
        customer: 'cus_123',
        status: 'paid',
        created: 1700000000,
        subtotal: 1000,
        total: 1000,
        lines: { data: [] },
      }),
      list: vi.fn().mockResolvedValue({
        data: [{
          id: 'in_123',
          customer: 'cus_123',
          status: 'paid',
          created: 1700000000,
          subtotal: 1000,
          total: 1000,
          lines: { data: [] },
        }],
      }),
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal' }),
      },
    },
  },
  getPriceId: vi.fn().mockReturnValue('price_123'),
  mapStripeStatus: vi.fn().mockReturnValue('active'),
}));

vi.mock('../functions/auth/entitlements', () => ({
  writeFounderEntitlementGrant: vi.fn(),
}));

import { activateFounderPass } from './activateFounderPass';
import { cancelSubscription } from './cancelSubscription';
import { createCheckoutSession } from './createCheckoutSession';
import { createMicroTransaction } from './createMicroTransaction';
import { createOneTimeCheckout } from './createOneTimeCheckout';
import { deductCredits } from './deductCredits';
import { generateInvoice } from './generateInvoice';
import { getCustomerPortal } from './getCustomerPortal';
import { getSubscription } from './getSubscription';
import { getUsageStats } from './getUsageStats';
import { resumeSubscription } from './resumeSubscription';
import { trackUsage } from './trackUsage';
import { updateWalletSettings } from './updateWalletSettings';

type CallableHandler = (request: {
  auth?: { uid: string; token: Record<string, unknown> } | null;
  rawRequest?: unknown;
  data?: unknown;
}) => Promise<unknown>;

const callables: Array<{ name: string; handler: CallableHandler; defaultData: Record<string, unknown>; requiresAdmin?: boolean }> = [
  {
    name: 'activateFounderPass',
    handler: activateFounderPass as unknown as CallableHandler,
    defaultData: { targetUid: 'target-123', displayName: 'Founder Jane' },
    requiresAdmin: true,
  },
  {
    name: 'cancelSubscription',
    handler: cancelSubscription as unknown as CallableHandler,
    defaultData: { userId: 'user-123' },
  },
  {
    name: 'createCheckoutSession',
    handler: createCheckoutSession as unknown as CallableHandler,
    defaultData: { userId: 'user-123', tier: 'PRO', successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel' },
  },
  {
    name: 'createMicroTransaction',
    handler: createMicroTransaction as unknown as CallableHandler,
    defaultData: { userId: 'user-123', credits: 500, successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel' },
  },
  {
    name: 'createOneTimeCheckout',
    handler: createOneTimeCheckout as unknown as CallableHandler,
    defaultData: { userId: 'user-123', items: [{ name: 'Item', amount: 1000, quantity: 1 }], successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel' },
  },
  {
    name: 'deductCredits',
    handler: deductCredits as unknown as CallableHandler,
    defaultData: { userId: 'user-123', amount: 10, reason: 'Test generation' },
  },
  {
    name: 'generateInvoice',
    handler: generateInvoice as unknown as CallableHandler,
    defaultData: { invoiceId: 'in_123' },
  },
  {
    name: 'getCustomerPortal',
    handler: getCustomerPortal as unknown as CallableHandler,
    defaultData: { userId: 'user-123', returnUrl: 'https://example.com/return' },
  },
  {
    name: 'getSubscription',
    handler: getSubscription as unknown as CallableHandler,
    defaultData: { userId: 'user-123' },
  },
  {
    name: 'getUsageStats',
    handler: getUsageStats as unknown as CallableHandler,
    defaultData: { userId: 'user-123' },
  },
  {
    name: 'resumeSubscription',
    handler: resumeSubscription as unknown as CallableHandler,
    defaultData: { userId: 'user-123' },
  },
  {
    name: 'trackUsage',
    handler: trackUsage as unknown as CallableHandler,
    defaultData: { userId: 'user-123', type: 'image', amount: 1 },
  },
  {
    name: 'updateWalletSettings',
    handler: updateWalletSettings as unknown as CallableHandler,
    defaultData: { userId: 'user-123', autoTopUp: false },
  },
];

describe('Subscription & Billing Admission Gates (ISSUE-1543 Batch 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_CREDIT_PACK = 'price_credits_pack';
    mocks.validateAppCheck.mockImplementation(() => undefined);
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.firestoreDocGet.mockImplementation((docRef?: { path?: string; id?: string }) => {
      const isTargetFounder = docRef?.id === 'target-123' || docRef?.path?.includes('founders/target-123');
      return Promise.resolve({
        exists: !isTargetFounder,
        docs: [],
        size: 0,
        forEach: vi.fn(),
        data: () => ({
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          tier: 'PRO',
          status: 'active',
          cancelAtPeriodEnd: false,
          balanceCredits: 500,
          autoTopUp: false,
          founders: [],
          count: 2,
        }),
        ref: { update: mocks.firestoreDocUpdate },
      });
    });
    mocks.firestoreRunTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        update: mocks.firestoreDocUpdate,
      };
      return cb(tx);
    });
  });

  for (const { name, handler, defaultData, requiresAdmin } of callables) {
    describe(name, () => {
      it('validates App Check on invocation', async () => {
        const error = new Error('App Check failed');
        mocks.validateAppCheck.mockImplementationOnce(() => {
          throw error;
        });

        await expect(
          handler({
            auth: { uid: 'user-123', token: requiresAdmin ? { admin: true } : {} },
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
              token: { firebase: { sign_in_provider: 'anonymous' }, ...(requiresAdmin ? { admin: true } : {}) },
            },
            data: defaultData,
          }),
        ).rejects.toThrow(/Anonymous|authenticated/i);
      });

      it('enforces Arcjet rate-limiting denial', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({
          allowed: false,
          reason: 'RATE_LIMIT_EXCEEDED',
        });

        await expect(
          handler({
            auth: { uid: 'user-123', token: requiresAdmin ? { admin: true } : {} },
            rawRequest: { headers: { 'x-forwarded-for': '127.0.0.1' } },
            data: defaultData,
          }),
        ).rejects.toThrow(/rate limit|resource-exhausted/i);
        expect(mocks.protectAuthenticated).toHaveBeenCalled();
      });

      it('permits valid authenticated request when Arcjet and App Check succeed', async () => {
        mocks.protectAuthenticated.mockResolvedValueOnce({ allowed: true });

        const result = await handler({
          auth: { uid: 'user-123', token: requiresAdmin ? { admin: true } : {} },
          rawRequest: { headers: { 'x-forwarded-for': '127.0.0.1' } },
          data: defaultData,
        });
        expect(result).toBeDefined();
      });
    });
  }
});
