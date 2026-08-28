/**
 * Regression tests for webhook fulfillment authority guards (P0 fix).
 *
 * 1. A `micro_transaction` session must be re-verified against the live
 *    Stripe session (one line item at STRIPE_PRICE_CREDIT_PACK, quantity ==
 *    credits) before user_credits are touched. Metadata alone is never
 *    authority for minting credits.
 * 2. A `marketplace_purchase` session must be bound to the reservation's
 *    stored stripeSessionId and the paid amount must equal the reserved
 *    price before a purchase/revenue record is written.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  const mockRetrieveSession = vi.fn();
  const mockRunTransaction = vi.fn();
  const mockCollection = vi.fn();
  const mockDb = { collection: mockCollection, runTransaction: mockRunTransaction };
  return { mockConstructEvent, mockRetrieveSession, mockRunTransaction, mockCollection, mockDb };
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

interface RefLike {
  tag: string;
  update?: ReturnType<typeof vi.fn>;
}

function setupFirestore(opts: {
  deliveryExists?: boolean;
  deliveryStatus?: string;
  reservation?: Record<string, unknown> | null;
  creditBalance?: number;
} = {}) {
  // All update() mocks return a catchable thenable — production code chains
  // .catch() onto best-effort delivery-status updates.
  const catchable = () => {
    const t: { catch: ReturnType<typeof vi.fn> } = { catch: vi.fn() };
    t.catch.mockReturnValue(undefined);
    return t;
  };
  const deliveryDocRef: RefLike & Record<string, unknown> = { tag: 'delivery', update: vi.fn(catchable) };
  const logDocRef: RefLike & Record<string, unknown> = { tag: 'log' };
  const creditsRef = Object.assign(
    {
      tag: 'credits',
      collection: vi.fn(() => ({ doc: vi.fn(() => logDocRef) })),
    },
  );
  const reservationRef: RefLike & Record<string, unknown> = { tag: 'reservation' };

  mocks.mockCollection.mockImplementation((name: string) => {
    if (name === 'stripe_webhook_deliveries') return { doc: vi.fn(() => deliveryDocRef) };
    if (name === 'user_credits') return { doc: vi.fn(() => creditsRef) };
    if (name === 'marketplace_reservations') return { doc: vi.fn(() => reservationRef) };
    return { doc: vi.fn(() => ({ id: 'gen-id' })) };
  });

  const mockTx = {
    get: vi.fn(async (ref: RefLike) => {
      if (ref === deliveryDocRef) {
        return {
          exists: opts.deliveryExists ?? false,
          get: (field: string) => (field === 'status' ? opts.deliveryStatus ?? 'processing' : undefined),
        };
      }
      if (ref === reservationRef) {
        return opts.reservation == null ? { exists: false } : { exists: true, data: () => opts.reservation };
      }
      if (ref === creditsRef) return { exists: true, data: () => ({ balance: opts.creditBalance ?? 0 }) };
      if (ref === logDocRef) return { exists: false };
      throw new Error(`unexpected tx.get for ${String(ref?.tag)}`);
    }),
    set: vi.fn(),
    update: vi.fn(),
  };

  mocks.mockRunTransaction.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx as any),
  );

  return { deliveryDocRef, logDocRef, creditsRef, reservationRef, mockTx };
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function deliver(session: Record<string, unknown>) {
  const event = {
    id: `evt_${session.id as string}`,
    type: 'checkout.session.completed',
    data: { object: session },
  };
  mocks.mockConstructEvent.mockReturnValue(event);

  const { stripeWebhook } = await import('./webhookHandler');
  const req = {
    headers: { 'stripe-signature': 'valid_sig' },
    rawBody: Buffer.from('{}'),
  };
  const res = makeRes();
  await (stripeWebhook as unknown as (req: unknown, res: unknown) => Promise<void>)(req, res);
  return res;
}

describe('micro_transaction fulfillment authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_PRICE_CREDIT_PACK', 'price_credit_pack');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('credits a genuine credit-pack session (single line item at the configured price, qty == credits)', async () => {
    const { creditsRef, mockTx } = setupFirestore({ creditBalance: 50 });
    mocks.mockRetrieveSession.mockResolvedValue({
      id: 'cs_ok',
      line_items: { data: [{ price: { id: 'price_credit_pack' }, quantity: 100 }] },
    });

    await deliver({
      id: 'cs_ok',
      amount_total: 10000,
      payment_status: 'paid',
      metadata: { userId: 'u1', type: 'micro_transaction', credits: '100' },
    });

    expect(mocks.mockRetrieveSession).toHaveBeenCalledWith('cs_ok', expect.objectContaining({ expand: ['line_items'] }));
    const balanceUpdate = mockTx.update.mock.calls.find((call) => call[0] === creditsRef);
    expect(balanceUpdate).toBeDefined();
    // 50 existing + 100 purchased — the metadata-declared amount was honored
    // only after the live Stripe line item verified it.
    expect(balanceUpdate![1].balance).toBe(150);
  });

  it('refuses to credit when the paid session is not the configured pack (ad-hoc $0.01 item)', async () => {
    const { creditsRef } = setupFirestore({});
    mocks.mockRetrieveSession.mockResolvedValue({
      id: 'cs_forge',
      line_items: { data: [{ price: { id: null }, quantity: 1 }] }, // ad-hoc price_data → no price ID
    });

    await deliver({
      id: 'cs_forge',
      amount_total: 1,
      payment_status: 'paid',
      metadata: { userId: 'u1', type: 'micro_transaction', credits: '1000000' },
    });

    // The guard runs before any Firestore credit surface is touched.
    expect(creditsRef.collection).not.toHaveBeenCalled();
  });

  it('refuses to credit when quantity does not match the declared credits', async () => {
    const { creditsRef } = setupFirestore({});
    mocks.mockRetrieveSession.mockResolvedValue({
      id: 'cs_qty',
      line_items: { data: [{ price: { id: 'price_credit_pack' }, quantity: 1 }] },
    });

    await deliver({
      id: 'cs_qty',
      amount_total: 100,
      payment_status: 'paid',
      metadata: { userId: 'u1', type: 'micro_transaction', credits: '1000000' },
    });

    expect(creditsRef.collection).not.toHaveBeenCalled();
  });
});

describe('marketplace_purchase fulfillment authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes a reservation bound to this exact session with a matching paid amount', async () => {
    const { mockTx, reservationRef } = setupFirestore({
      reservation: {
        status: 'reserved',
        stripeSessionId: 'cs_mkt',
        priceCents: 2500,
        currency: 'usd',
        buyerId: 'b1',
        sellerId: 's1',
        productId: 'p1',
        productTitle: 'Stem pack',
        source: 'direct',
      },
    });

    await deliver({
      id: 'cs_mkt',
      amount_total: 2500,
      payment_status: 'paid',
      metadata: { type: 'marketplace_purchase', reservationId: 'res_1' },
    });

    const purchaseWrite = mockTx.set.mock.calls.filter((call) => call[0]?.tag === undefined);
    expect(purchaseWrite.length).toBeGreaterThanOrEqual(2); // purchases + revenue docs
    const reservationUpdate = mockTx.update.mock.calls.find((call) => call[0] === reservationRef);
    expect(reservationUpdate).toBeDefined();
  });

  it('refuses when the reservation is bound to a DIFFERENT Stripe session (forged reservationId)', async () => {
    const { mockTx, reservationRef } = setupFirestore({
      reservation: {
        status: 'reserved',
        stripeSessionId: 'cs_REAL_checkout',
        priceCents: 2500,
        buyerId: 'b1',
        sellerId: 's1',
      },
    });

    await deliver({
      id: 'cs_FORGED',
      amount_total: 1,
      payment_status: 'paid',
      metadata: { type: 'marketplace_purchase', reservationId: 'res_1' },
    });

    // No purchase/revenue writes; no reservation completion.
    expect(mockTx.set).not.toHaveBeenCalledWith(expect.objectContaining({ tag: 'reservation' }), expect.anything());
    const nonLedgerSets = mockTx.set.mock.calls.filter((call) => call[0]?.tag !== 'delivery');
    expect(nonLedgerSets).toHaveLength(0);
    const reservationUpdate = mockTx.update.mock.calls.find((call) => call[0] === reservationRef);
    expect(reservationUpdate).toBeUndefined();
  });

  it('refuses when the paid amount does not equal the reserved server-side price', async () => {
    const { mockTx } = setupFirestore({
      reservation: {
        status: 'reserved',
        stripeSessionId: 'cs_underpaid',
        priceCents: 2500,
        buyerId: 'b1',
        sellerId: 's1',
      },
    });

    await deliver({
      id: 'cs_underpaid',
      amount_total: 100, // underpaid vs reserved 2500
      payment_status: 'paid',
      metadata: { type: 'marketplace_purchase', reservationId: 'res_1' },
    });

    const nonLedgerSets = mockTx.set.mock.calls.filter((call) => call[0]?.tag !== 'delivery');
    expect(nonLedgerSets).toHaveLength(0);
  });
});
