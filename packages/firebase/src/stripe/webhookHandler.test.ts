/**
 * stripeWebhook must reject any request whose Stripe signature doesn't
 * verify, before touching Firestore or dispatching to any event handler.
 * A forged/unsigned request must never be able to trigger a subscription
 * change, transfer, or ledger write. It must also treat a duplicate
 * delivery of an already-processed event as a no-op, so Stripe's retry
 * behavior can never re-run a handler's side effects twice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  const mockRunTransaction = vi.fn();
  const mockCollection = vi.fn();
  const mockDb = {
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  };

  return { mockConstructEvent, mockRunTransaction, mockCollection, mockDb };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mocks.mockDb,
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
    webhooks: {
      constructEvent: mocks.mockConstructEvent,
    },
  },
  mapStripeStatus: vi.fn((s: string) => s),
  mapStripeTierToSubscriptionTier: vi.fn(() => 'free'),
}));

vi.mock('../config/secrets', () => ({
  stripeSecretKey: {},
  stripeWebhookSecret: {},
  getStripeWebhookSecret: () => 'whsec_test_secret',
}));

function makeReq(overrides: Partial<{ signature: string; rawBody: string }> = {}) {
  return {
    headers: { 'stripe-signature': overrides.signature ?? 'bad_sig' },
    rawBody: Buffer.from(overrides.rawBody ?? '{}'),
  };
}

function makeRes() {
  const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe('stripeWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a request with an invalid signature and never touches Firestore', async () => {
    mocks.mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const { stripeWebhook } = await import('./webhookHandler');
    const req = makeReq({ signature: 'not_a_real_signature' });
    const res = makeRes();

    await (stripeWebhook as unknown as (req: unknown, res: unknown) => Promise<void>)(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    expect(mocks.mockRunTransaction).not.toHaveBeenCalled();
    expect(mocks.mockCollection).not.toHaveBeenCalled();
  });

  it('skips a duplicate delivery of an already-processed event without re-running the handler', async () => {
    const event = {
      id: 'evt_already_processed',
      type: 'checkout.session.completed',
      data: { object: { metadata: {} } },
    };
    mocks.mockConstructEvent.mockReturnValue(event);

    const deliverySnap = {
      exists: true,
      get: (field: string) => {
        if (field === 'status') return 'processed';
        if (field === 'receivedAt') return { toMillis: () => Date.now() };
        return undefined;
      },
    };
    const deliveryDocRef = { update: vi.fn() };
    const mockTx = { get: vi.fn().mockResolvedValue(deliverySnap) };
    mocks.mockRunTransaction.mockImplementation((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));
    mocks.mockCollection.mockImplementation((name: string) => ({
      doc: vi.fn(() => (name === 'stripe_webhook_deliveries' ? deliveryDocRef : { id: 'unused' })),
    }));

    const { stripeWebhook } = await import('./webhookHandler');
    const req = makeReq({ signature: 'valid_sig' });
    const res = makeRes();

    await (stripeWebhook as unknown as (req: unknown, res: unknown) => Promise<void>)(req, res);

    expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true });
    expect(res.status).not.toHaveBeenCalled();
    // The duplicate short-circuit must fire before any handler dispatch or
    // delivery-status update — a second webhook write must never happen.
    expect(deliveryDocRef.update).not.toHaveBeenCalled();
  });
});
