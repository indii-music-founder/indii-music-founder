import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';

const mocks = vi.hoisted(() => ({
  protectAuthenticated: vi.fn(),
  protectAnonymous: vi.fn(),
  validateAppCheck: vi.fn(),
  firestoreDocGet: vi.fn(),
  firestoreDocSet: vi.fn(),
  firestoreDocUpdate: vi.fn(),
  firestoreRunTransaction: vi.fn(),
  firestoreBatchSet: vi.fn(),
  firestoreBatchCommit: vi.fn(),
  stripeAccountsCreate: vi.fn(),
  stripeAccountLinksCreate: vi.fn(),
  stripeTransfersCreate: vi.fn(),
  stripeProductsCreate: vi.fn(),
  stripePricesCreate: vi.fn(),
  stripePaymentLinksCreate: vi.fn(),
  stripePaymentIntentsCreate: vi.fn(),
  stripePaymentIntentsRetrieve: vi.fn(),
  stripePaymentIntentsCapture: vi.fn(),
  stripeConstructEvent: vi.fn(),
}));

vi.mock('firebase-admin', () => {
  const firestore = vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        update: mocks.firestoreDocUpdate,
      })),
      add: vi.fn().mockResolvedValue({ id: 'mock-add-id' }),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
      update: mocks.firestoreDocUpdate,
    })),
    runTransaction: mocks.firestoreRunTransaction,
    batch: vi.fn(() => ({
      set: mocks.firestoreBatchSet,
      commit: mocks.firestoreBatchCommit,
    })),
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
    },
    apps: [{ name: 'mock-app' }],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestore, {
      FieldValue: {
        serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
        increment: vi.fn((n: number) => n),
      },
    }),
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
      add: vi.fn().mockResolvedValue({ id: 'mock-add-id' }),
    })),
    doc: vi.fn(() => ({
      get: mocks.firestoreDocGet,
      set: mocks.firestoreDocSet,
      update: mocks.firestoreDocUpdate,
    })),
    runTransaction: mocks.firestoreRunTransaction,
    batch: vi.fn(() => ({
      set: mocks.firestoreBatchSet,
      commit: mocks.firestoreBatchCommit,
    })),
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
  stripeWebhookSecret: { name: 'STRIPE_WEBHOOK_SECRET' },
  printfulApiKey: { name: 'PRINTFUL_API_KEY' },
  getStripeWebhookSecret: () => 'whsec_test',
  getStripeSecretKey: () => 'sk_test',
}));

vi.mock('../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../functions/security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.protectAuthenticated,
  protectAnonymousSignupRequest: mocks.protectAnonymous,
}));

vi.mock('./config', () => ({
  stripe: {
    accounts: {
      create: mocks.stripeAccountsCreate,
    },
    accountLinks: {
      create: mocks.stripeAccountLinksCreate,
    },
    transfers: {
      create: mocks.stripeTransfersCreate,
    },
    products: {
      create: mocks.stripeProductsCreate,
    },
    prices: {
      create: mocks.stripePricesCreate,
    },
    paymentLinks: {
      create: mocks.stripePaymentLinksCreate,
    },
    paymentIntents: {
      create: mocks.stripePaymentIntentsCreate,
      retrieve: mocks.stripePaymentIntentsRetrieve,
      capture: mocks.stripePaymentIntentsCapture,
    },
    webhooks: {
      constructEvent: mocks.stripeConstructEvent,
    },
  },
  mapStripeStatus: vi.fn((s: string) => s),
  mapStripeTierToSubscriptionTier: vi.fn(() => 'free'),
}));

import { createStripeConnectAccount, createTransfer } from './connect';
import { createStripePaymentLinks } from './paymentLinks';
import { initiateSplitEscrow, signEscrow, releaseEscrow } from './splitEscrow';
import { requestTaxForms } from './taxForms';
import { handleEscrowWebhook } from './escrow';
import { stripeWebhook } from './webhookHandler';

type CallableHandler = (request: {
  auth?: { uid: string; token?: Record<string, unknown> } | null;
  rawRequest?: unknown;
  data?: unknown;
}) => Promise<unknown>;

interface CallableConfig {
  name: string;
  handler: CallableHandler;
  defaultData: Record<string, unknown>;
  adminRequired?: boolean;
}

const callables: CallableConfig[] = [
  {
    name: 'createStripeConnectAccount',
    handler: createStripeConnectAccount as unknown as CallableHandler,
    defaultData: { email: 'artist@example.com', businessType: 'individual' },
  },
  {
    name: 'createTransfer',
    handler: createTransfer as unknown as CallableHandler,
    defaultData: { amount: 5000, destinationId: 'acct_123', currency: 'usd', payoutId: 'payout-1' },
    adminRequired: true,
  },
  {
    name: 'createStripePaymentLinks',
    handler: createStripePaymentLinks as unknown as CallableHandler,
    defaultData: {
      campaignName: 'Test Drop',
      items: [{
        sku: 'SKU1',
        title: 'Item 1',
        unitAmount: 1000,
        currency: 'usd',
        quantity: 1,
        stock: 10,
        shippingRequired: false,
        fulfillmentProvider: 'printful',
      }],
    },
  },
  {
    name: 'initiateSplitEscrow',
    handler: initiateSplitEscrow as unknown as CallableHandler,
    defaultData: { trackId: 'track-1', holdAmount: 1000, parties: ['user-123'] },
  },
  {
    name: 'signEscrow',
    handler: signEscrow as unknown as CallableHandler,
    defaultData: { escrowDocId: 'escrow-1' },
  },
  {
    name: 'releaseEscrow',
    handler: releaseEscrow as unknown as CallableHandler,
    defaultData: { escrowDocId: 'escrow-1' },
  },
  {
    name: 'requestTaxForms',
    handler: requestTaxForms as unknown as CallableHandler,
    defaultData: { payees: [{ name: 'Alice', email: 'alice@example.com', isUsPerson: true }] },
  },
];

describe('Stripe Connect, Escrow, Payment Links & Webhook Admission (ISSUE-1543 Batch 12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ESCROW_WEBHOOK_SECRET = 'test_escrow_secret';
    process.env.STRIPE_PLATFORM_ACCOUNT_ID = 'acct_platform_test';

    mocks.validateAppCheck.mockImplementation(() => undefined);
    mocks.protectAuthenticated.mockResolvedValue({ allowed: true });
    mocks.protectAnonymous.mockResolvedValue({ allowed: true });

    mocks.stripeAccountsCreate.mockResolvedValue({ id: 'acct_collab_1' });
    mocks.stripeAccountLinksCreate.mockResolvedValue({ url: 'https://connect.stripe.com/onboard' });
    mocks.stripeTransfersCreate.mockResolvedValue({ id: 'tr_123' });
    mocks.stripeProductsCreate.mockResolvedValue({ id: 'prod_1' });
    mocks.stripePricesCreate.mockResolvedValue({ id: 'price_1' });
    mocks.stripePaymentLinksCreate.mockResolvedValue({ id: 'plink_1', url: 'https://buy.stripe.com/test' });
    mocks.stripePaymentIntentsCreate.mockResolvedValue({ id: 'pi_123', client_secret: 'pi_secret_123' });
    mocks.stripePaymentIntentsRetrieve.mockResolvedValue({ status: 'requires_capture' });
    mocks.stripePaymentIntentsCapture.mockResolvedValue({ id: 'pi_123', status: 'succeeded' });
    mocks.stripeConstructEvent.mockReturnValue({ id: 'evt_1', type: 'unknown' });

    mocks.firestoreDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        status: 'PENDING_SIGNATURES',
        parties: ['user-123'],
        signoffs: {},
        splits: { 'user-123': 100 },
        stripePaymentIntentId: 'pi_123',
        stripeAccountIds: { 'user-123': 'acct_123' },
        holdAmount: 1000,
        holdAmountCents: 1000,
        currency: 'usd',
      }),
      get: vi.fn((field: string) => {
        if (field === 'status') return 'PENDING_SIGNATURES';
        if (field === 'parties') return ['user-123'];
        return undefined;
      }),
    });

    mocks.firestoreRunTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: mocks.firestoreDocGet,
        set: mocks.firestoreDocSet,
        update: mocks.firestoreDocUpdate,
      };
      return cb(tx);
    });

    mocks.firestoreBatchCommit.mockResolvedValue(undefined);
  });

  describe('Callable Admission Gates', () => {
    for (const { name, handler, defaultData, adminRequired } of callables) {
      describe(name, () => {
        it('validates App Check token', async () => {
          mocks.validateAppCheck.mockImplementationOnce(() => {
            throw new Error('Unauthorized: Missing App Check token.');
          });
          await expect(
            handler({
              auth: { uid: 'user-123', token: adminRequired ? { admin: true } : {} },
              data: defaultData,
            })
          ).rejects.toThrow('Unauthorized: Missing App Check token.');
        });

        it('rejects unauthenticated requests', async () => {
          await expect(
            handler({
              auth: null,
              data: defaultData,
            })
          ).rejects.toThrow(/authenticated|signed in/i);
        });

        it('rejects anonymous callers', async () => {
          await expect(
            handler({
              auth: {
                uid: 'anon-user',
                token: {
                  ...(adminRequired ? { admin: true } : {}),
                  firebase: { sign_in_provider: 'anonymous' },
                },
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
              auth: { uid: 'user-123', token: adminRequired ? { admin: true } : {} },
              rawRequest: { headers: {}, ip: '127.0.0.1' },
              data: defaultData,
            })
          ).rejects.toThrow('Request rate limit exceeded. Please try again later.');

          expect(mocks.protectAuthenticated).toHaveBeenCalled();
        });

        it('executes successfully when caller is verified and authorized', async () => {
          if (name === 'releaseEscrow') {
            mocks.firestoreDocGet.mockResolvedValueOnce({
              exists: true,
              data: () => ({
                status: 'FULLY_SIGNED',
                parties: ['user-123'],
                splits: { 'user-123': 100 },
                stripePaymentIntentId: 'pi_123',
                stripeAccountIds: { 'user-123': 'acct_123' },
                holdAmount: 1000,
                holdAmountCents: 1000,
                currency: 'usd',
              }),
            });
          }

          const result = await handler({
            auth: { uid: 'user-123', token: adminRequired ? { admin: true } : {} },
            rawRequest: { headers: {}, ip: '127.0.0.1' },
            data: defaultData,
          });

          expect(result).toBeDefined();
        });
      });
    }
  });

  describe('HTTP Webhook Admission Gates', () => {
    describe('handleEscrowWebhook', () => {
      it('rejects when Arcjet denies the webhook', async () => {
        mocks.protectAnonymous.mockResolvedValueOnce({
          allowed: false,
          status: 429,
          message: 'Rate limit exceeded',
          retryAfterSeconds: 30,
        });

        const req = {
          headers: { 'x-indii-signature': 'sig123' },
          rawBody: Buffer.from('{}'),
        };
        const statusFn = vi.fn().mockReturnThis();
        const sendFn = vi.fn();
        const setFn = vi.fn();
        const res = { status: statusFn, send: sendFn, set: setFn };

        const webhook = handleEscrowWebhook as unknown as (req: unknown, res: unknown) => Promise<void>;
        await webhook(req, res);

        expect(statusFn).toHaveBeenCalledWith(429);
        expect(sendFn).toHaveBeenCalledWith('Rate limit exceeded');
        expect(setFn).toHaveBeenCalledWith('Retry-After', '30');
      });

      it('rejects when HMAC signature is invalid', async () => {
        const req = {
          headers: { 'x-indii-signature': 'invalid_sig' },
          rawBody: Buffer.from(JSON.stringify({ transaction_id: 'tx-1' })),
        };
        const statusFn = vi.fn().mockReturnThis();
        const sendFn = vi.fn();
        const res = { status: statusFn, send: sendFn };

        const webhook = handleEscrowWebhook as unknown as (req: unknown, res: unknown) => Promise<void>;
        await webhook(req, res);

        expect(statusFn).toHaveBeenCalledWith(401);
        expect(sendFn).toHaveBeenCalledWith('Unauthorized');
      });

      it('processes webhook successfully with valid signature and settled transaction', async () => {
        const payload = JSON.stringify({ transaction_id: 'tx-1', status: 'success' });
        const validSig = crypto.createHmac('sha256', 'test_escrow_secret').update(payload).digest('hex');

        mocks.firestoreDocGet.mockResolvedValueOnce({
          exists: true,
          data: () => ({ status: 'LOCKED' }),
        });

        const req = {
          headers: { 'x-indii-signature': validSig },
          rawBody: Buffer.from(payload),
        };
        const statusFn = vi.fn().mockReturnThis();
        const sendFn = vi.fn();
        const res = { status: statusFn, send: sendFn };

        const webhook = handleEscrowWebhook as unknown as (req: unknown, res: unknown) => Promise<void>;
        await webhook(req, res);

        expect(statusFn).toHaveBeenCalledWith(200);
        expect(sendFn).toHaveBeenCalledWith('Webhook processed successfully');
      });
    });

    describe('stripeWebhook', () => {
      it('rejects when Arcjet denies the webhook', async () => {
        mocks.protectAnonymous.mockResolvedValueOnce({
          allowed: false,
          status: 429,
          message: 'Rate limit exceeded',
          retryAfterSeconds: 45,
        });

        const req = {
          headers: { 'stripe-signature': 'sig123' },
          rawBody: Buffer.from('{}'),
        };
        const statusFn = vi.fn().mockReturnThis();
        const jsonFn = vi.fn();
        const setFn = vi.fn();
        const res = { status: statusFn, json: jsonFn, set: setFn };

        const webhook = stripeWebhook as unknown as (req: unknown, res: unknown) => Promise<void>;
        await webhook(req, res);

        expect(statusFn).toHaveBeenCalledWith(429);
        expect(jsonFn).toHaveBeenCalledWith({ error: 'Rate limit exceeded' });
        expect(setFn).toHaveBeenCalledWith('Retry-After', '45');
      });
    });
  });
});
