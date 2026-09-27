import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  const mockRetrieveSession = vi.fn();
  return { mockConstructEvent, mockRetrieveSession };
});

const store = new Map<string, Record<string, unknown>>();
const writes: Array<{ op: string; path: string; data?: Record<string, unknown> }> = [];

type FakeRef = {
  path: string;
  get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined; get: (field: string) => unknown }>;
  set: (data: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<void>;
  update: (data: Record<string, unknown>) => Promise<void>;
  collection: (sub: string) => FakeRef;
  doc: (id: string) => FakeRef;
};

function fakeRef(path: string): FakeRef {
  const ref = {
    path,
    get: async () => {
      const data = store.get(path);
      return {
        exists: data != null,
        data: () => data,
        get: (field: string) => (data ? data[field] : undefined),
      };
    },
    set: async (data: Record<string, unknown>) => {
      writes.push({ op: 'set', path, data });
      store.set(path, data);
    },
    update: async (data: Record<string, unknown>) => {
      writes.push({ op: 'update', path, data });
      const existing = store.get(path) || {};
      store.set(path, { ...existing, ...data });
    },
  };

  return Object.assign(ref, {
    collection: (sub: string) => fakeRef(`${path}/${sub}`),
    doc: (id: string) => fakeRef(`${path}/${id}`),
  });
}

const fakeDb = {
  collection: (name: string) => fakeRef(name),
  runTransaction: async (cb: (tx: any) => Promise<unknown>) => {
    const tx = {
      get: async (ref: FakeRef) => ref.get(),
      set: (ref: FakeRef, data: Record<string, unknown>) => {
        writes.push({ op: 'tx-set', path: ref.path, data });
        store.set(ref.path, data);
      },
      update: (ref: FakeRef, data: Record<string, unknown>) => {
        writes.push({ op: 'tx-update', path: ref.path, data });
        const existing = store.get(ref.path) || {};
        store.set(ref.path, { ...existing, ...data });
      },
    };
    return cb(tx);
  },
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => fakeDb,
  FieldValue: {
    serverTimestamp: () => 'MOCK_TIMESTAMP',
    increment: (n: number) => ({ __increment: n }),
    delete: () => 'MOCK_DELETE',
  },
}));

vi.mock('firebase-functions/v2/https', () => ({
  onRequest: (_opts: unknown, handler: unknown) => handler,
}));

vi.mock('firebase-functions', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./config', () => ({
  stripe: {
    webhooks: { constructEvent: mocks.mockConstructEvent },
    checkout: { sessions: { retrieve: mocks.mockRetrieveSession } },
  },
  mapStripeStatus: vi.fn((s: string) => s),
  mapStripeTierToSubscriptionTier: vi.fn(() => 'free'),
}));

vi.mock('../config/secrets', () => ({
  stripeSecretKey: {},
  stripeWebhookSecret: {},
  getStripeWebhookSecret: () => 'whsec_test_secret',
  printfulApiKey: {},
}));

vi.mock('@indii/shared', () => ({
  buildConversionEventId: (parts: { platform: string; eventType: string; sourceId: string }) =>
    `${parts.platform}:${parts.eventType}:${parts.sourceId}`,
}));

vi.mock('../marketing/conversionEventOutbox', () => ({
  enqueueConversionEvent: vi.fn(),
}));

import { stripeWebhook } from './webhookHandler';

describe('stripeWebhook - micro_transaction (Phase 20 Credit Wallet)', () => {
  const handler = stripeWebhook as any;

  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    writes.length = 0;
    process.env.STRIPE_PRICE_CREDIT_PACK = 'price_credit_pack_standard';
  });

  it('updates users/{userId}/wallet/current and records credit_transactions when checkout completes', async () => {
    const session = {
      id: 'cs_test_mt_123',
      payment_status: 'paid',
      metadata: {
        userId: 'user-artist-42',
        type: 'micro_transaction',
        credits: '500',
      },
    };

    mocks.mockConstructEvent.mockReturnValue({
      id: 'evt_mt_1',
      type: 'checkout.session.completed',
      data: { object: session },
    });

    mocks.mockRetrieveSession.mockResolvedValue({
      id: 'cs_test_mt_123',
      line_items: {
        data: [
          {
            price: { id: 'price_credit_pack_standard' },
            quantity: 500,
          },
        ],
      },
    });

    // Seed existing wallet
    store.set('users/user-artist-42/wallet/current', {
      userId: 'user-artist-42',
      balanceCredits: 100,
      updatedAt: 1000,
    });

    const req = {
      headers: { 'stripe-signature': 'valid_sig' },
      rawBody: Buffer.from('{}'),
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
    };

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ received: true });

    // Verify wallet/current balance was incremented to 100 + 500 = 600
    const walletDoc = store.get('users/user-artist-42/wallet/current');
    expect(walletDoc).toEqual(
      expect.objectContaining({
        balanceCredits: 600,
      })
    );

    // Verify credit_transactions entry created
    const txDoc = store.get('users/user-artist-42/credit_transactions/cs_test_mt_123');
    expect(txDoc).toEqual(
      expect.objectContaining({
        id: 'cs_test_mt_123',
        userId: 'user-artist-42',
        type: 'PURCHASE',
        amountCredits: 500,
        balanceAfter: 600,
        reason: 'Credit Pack Purchase',
        referenceId: 'cs_test_mt_123',
      })
    );
  });
});
