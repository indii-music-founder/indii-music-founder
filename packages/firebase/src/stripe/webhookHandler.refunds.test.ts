/**
 * ISSUE-1406 refund-flow regressions (founder decisions 2026-08-28).
 *
 * 1. Marketplace: a fully refunded sale is clawed back from the seller's
 *    credit balance; an already-spent balance records shortfall debt; the
 *    reservation/purchase/revenue surfaces all flip to refunded in one
 *    transaction, idempotent per charge.
 * 2. Licensing: a fully refunded sync license reverses the payout transfer
 *    from the connected account, then deactivates license + agreement and
 *    writes a negative ledger row. Reversal failure parks the license in
 *    `refund_pending_reversal` with a finance-review doc — never a refund
 *    without recovered funds.
 * 3. Partial refunds claw nothing back on either flow.
 * 4. Binding guards: a reservation bound to a different session is refused.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  const mockListSessions = vi.fn();
  const mockCreateReversal = vi.fn();
  return { mockConstructEvent, mockListSessions, mockCreateReversal };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => fakeDbInstance,
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
    checkout: { sessions: { list: mocks.mockListSessions } },
    transfers: { createReversal: mocks.mockCreateReversal },
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

// ── Minimal stateful Firestore fake ──────────────────────────────────────
// Documents live in a Map keyed by path; writes are recorded for assertions.

interface WriteRecord {
  op: 'tx-set' | 'tx-update' | 'batch-set' | 'ref-set' | 'ref-update';
  path: string;
  data?: Record<string, unknown>;
  merge?: boolean;
}

type FakeRef = {
  path: string;
  id: string;
  collection: (sub: string) => FakeRef;
  doc: (id: string) => FakeRef;
  get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined; get: (f: string) => unknown }>;
  set: (data: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<void>;
  update: (data: Record<string, unknown>) => Promise<void>;
};

const writes: WriteRecord[] = [];
const store = new Map<string, Record<string, unknown>>();

function fakeRef(path: string): FakeRef {
  const ref = {
    path,
    id: path.split('/').pop() as string,
    collection: (sub: string) => fakeRef(`${path}/${sub}`),
    doc: (id: string) => fakeRef(`${path}/${id}`),
    get: async () => {
      const data = store.get(path);
      return {
        exists: data != null,
        data: () => data,
        get: (f: string) => (data as Record<string, unknown> | undefined)?.[f],
      };
    },
    set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      writes.push({ op: 'ref-set', path, data, merge: opts?.merge });
    },
    update: async (data: Record<string, unknown>) => {
      writes.push({ op: 'ref-update', path, data });
    },
  };
  return ref;
}

let fakeDbInstance: {
  collection: (name: string) => FakeRef;
  batch: () => { set: (r: FakeRef, d: Record<string, unknown>, o?: { merge?: boolean }) => void; commit: () => Promise<void> };
  runTransaction: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
};

function setupFirestore(seed: Record<string, Record<string, unknown>> = {}) {
  writes.length = 0;
  store.clear();
  for (const [path, data] of Object.entries(seed)) store.set(path, data);

  fakeDbInstance = {
    collection: (name: string) => fakeRef(name),
    batch: () => ({
      set: (r: FakeRef, d: Record<string, unknown>, o?: { merge?: boolean }) => {
        writes.push({ op: 'batch-set', path: r.path, data: d, merge: o?.merge });
      },
      commit: async () => {},
    }),
    runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async (r: FakeRef) => r.get(),
        set: (r: FakeRef, d: Record<string, unknown>, o?: { merge?: boolean }) => {
          writes.push({ op: 'tx-set', path: r.path, data: d, merge: o?.merge });
        },
        update: (r: FakeRef, d: Record<string, unknown>) => {
          writes.push({ op: 'tx-update', path: r.path, data: d });
        },
      };
      return cb(tx);
    },
  };
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function deliverRefund(charge: Record<string, unknown>, session: Record<string, unknown>) {
  mocks.mockListSessions.mockResolvedValue({ data: [session] });
  const event = { id: 'evt_refund_1', type: 'charge.refunded', data: { object: charge } };
  mocks.mockConstructEvent.mockReturnValue(event);

  const { stripeWebhook } = await import('./webhookHandler');
  const req = { headers: { 'stripe-signature': 'valid_sig' }, rawBody: Buffer.from('{}') };
  const res = makeRes();
  await (stripeWebhook as unknown as (req: unknown, res: unknown) => Promise<void>)(req, res);
  return res;
}

const baseCharge = { id: 'ch_1', payment_intent: 'pi_1', amount: 2500, amount_refunded: 2500, object: 'charge' };

describe('marketplace refund clawback (ISSUE-1406)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestore({
      'marketplace_reservations/res_1': {
        status: 'completed',
        stripeSessionId: 'cs_mkt',
        priceCents: 2500,
        currency: 'usd',
        buyerId: 'b1',
        sellerId: 's1',
        productId: 'p1',
        productTitle: 'Stem pack',
        source: 'direct',
      },
      'user_credits/s1': { balance: 1000 },
    });
  });

  it('claws back the sale from the seller balance, records shortfall, and flips sale surfaces to refunded', async () => {
    await deliverRefund(baseCharge, { id: 'cs_mkt', metadata: { type: 'marketplace_purchase', reservationId: 'res_1' } });

    const logWrite = writes.find((w) => w.path === 'user_credits/s1/transactions/refund_ch_1');
    expect(logWrite).toBeDefined();
    expect(logWrite!.data).toMatchObject({ amount: -2500, applied: 1000, shortfall: 1500, type: 'marketplace_refund' });

    const debit = writes.find((w) => w.op === 'tx-update' && w.path === 'user_credits/s1');
    expect(debit!.data).toMatchObject({ balance: 0 });

    expect(writes.find((w) => w.op === 'tx-update' && w.path === 'marketplace_reservations/res_1')).toBeDefined();
    expect(writes.find((w) => w.path === 'purchases/cs_mkt')).toMatchObject({ data: { status: 'refunded' } });

    const revenueRows = writes.filter((w) => w.path.startsWith('revenue/'));
    expect(revenueRows).toHaveLength(1);
    expect(revenueRows[0].data).toMatchObject({ userId: 's1', amount: -2500, status: 'refunded' });
  });

  it('is idempotent: a duplicate delivery with the refund log present writes nothing', async () => {
    store.set('user_credits/s1/transactions/refund_ch_1', { amount: -2500 });

    await deliverRefund(baseCharge, { id: 'cs_mkt', metadata: { type: 'marketplace_purchase', reservationId: 'res_1' } });

    expect(writes.filter((w) => w.path !== 'stripe_webhook_deliveries/evt_refund_1')).toHaveLength(0);
  });

  it('refuses a reservation bound to a different session', async () => {
    await deliverRefund(baseCharge, { id: 'cs_FORGED', metadata: { type: 'marketplace_purchase', reservationId: 'res_1' } });

    expect(writes.filter((w) => w.op.startsWith('tx-') && !w.path.startsWith('stripe_webhook_deliveries/'))).toHaveLength(0);
  });

  it('refuses when the refunded amount differs from the reserved price', async () => {
    await deliverRefund(
      { ...baseCharge, amount: 999, amount_refunded: 999 },
      { id: 'cs_mkt', metadata: { type: 'marketplace_purchase', reservationId: 'res_1' } },
    );

    expect(writes.filter((w) => w.op.startsWith('tx-') && !w.path.startsWith('stripe_webhook_deliveries/'))).toHaveLength(0);
  });

  it('takes no clawback action on a partial refund', async () => {
    await deliverRefund(
      { ...baseCharge, amount_refunded: 1000 },
      { id: 'cs_mkt', metadata: { type: 'marketplace_purchase', reservationId: 'res_1' } },
    );

    expect(writes.filter((w) => w.op.startsWith('tx-') && !w.path.startsWith('stripe_webhook_deliveries/'))).toHaveLength(0);
  });

  it('skips a reservation that never completed', async () => {
    store.set('marketplace_reservations/res_1', {
      ...(store.get('marketplace_reservations/res_1') as Record<string, unknown>),
      status: 'reserved',
    });

    await deliverRefund(baseCharge, { id: 'cs_mkt', metadata: { type: 'marketplace_purchase', reservationId: 'res_1' } });

    expect(writes.filter((w) => w.op.startsWith('tx-') && !w.path.startsWith('stripe_webhook_deliveries/'))).toHaveLength(0);
  });
});

describe('licensing refund transfer reversal (ISSUE-1406)', () => {
  const license = {
    status: 'active',
    stripeTransferId: 'tr_123',
    userId: 's1',
    agreementId: 'agr_1',
    amount: 5000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestore({ 'licenses/cs_lic': license });
  });

  it('reverses the transfer idempotently and deactivates license, agreement, and ledger', async () => {
    mocks.mockCreateReversal.mockResolvedValue({ id: 'reversal_1' });

    await deliverRefund(baseCharge, { id: 'cs_lic', metadata: { type: 'licensing_purchase' } });

    expect(mocks.mockCreateReversal).toHaveBeenCalledWith('tr_123', undefined, { idempotencyKey: 'reversal_ch_1' });

    const licenseWrite = writes.find((w) => w.path === 'licenses/cs_lic');
    expect(licenseWrite).toMatchObject({ data: { status: 'refunded', stripeReversalId: 'reversal_1' } });

    expect(writes.find((w) => w.path === 'license_agreements/agr_1')).toMatchObject({ data: { status: 'refunded' } });

    const ledger = writes.find((w) => w.path === 'users/s1/ledger/sync_license_refund_ch_1');
    expect(ledger).toBeDefined();
    expect(ledger!.data).toMatchObject({ type: 'sync_license_refund', amount: -5000, status: 'reversed' });
  });

  it('is idempotent: a refunded license is not reversed twice', async () => {
    store.set('licenses/cs_lic', { ...license, status: 'refunded' });
    await deliverRefund(baseCharge, { id: 'cs_lic', metadata: { type: 'licensing_purchase' } });

    expect(mocks.mockCreateReversal).not.toHaveBeenCalled();
    expect(writes.filter((w) => w.op === 'batch-set')).toHaveLength(0);
  });

  it('parks the license in refund_pending_reversal with a finance doc when the reversal fails', async () => {
    mocks.mockCreateReversal.mockRejectedValue(new Error('Insufficient funds in connected account'));

    await deliverRefund(baseCharge, { id: 'cs_lic', metadata: { type: 'licensing_purchase' } });

    expect(writes.find((w) => w.path === 'licenses/cs_lic'))
      .toMatchObject({ data: { status: 'refund_pending_reversal' } });
    expect(writes.find((w) => w.path === 'finance_reversal_failures/ch_1')).toBeDefined();
    // Nothing is marked refunded, and no negative ledger row exists.
    expect(writes.find((w) => w.path.startsWith('users/s1/ledger'))).toBeUndefined();
    expect(writes.find((w) => w.path === 'license_agreements/agr_1')).toBeUndefined();
  });

  it('takes no reversal action on a partial refund', async () => {
    await deliverRefund(
      { ...baseCharge, amount_refunded: 1000 },
      { id: 'cs_lic', metadata: { type: 'licensing_purchase' } },
    );

    expect(mocks.mockCreateReversal).not.toHaveBeenCalled();
    expect(writes.filter((w) => w.op === 'batch-set')).toHaveLength(0);
  });

  it('refuses to reverse when the license lacks a usable transfer binding', async () => {
    store.set('licenses/cs_lic', { ...license, stripeTransferId: 'not-a-transfer' });
    await deliverRefund(baseCharge, { id: 'cs_lic', metadata: { type: 'licensing_purchase' } });

    expect(mocks.mockCreateReversal).not.toHaveBeenCalled();
    expect(writes.filter((w) => w.op === 'batch-set')).toHaveLength(0);
  });
});

describe('charge.refunded routing (ISSUE-1406)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestore();
  });

  it('ignores refunds for purchase types with no clawback flow (e.g. subscriptions)', async () => {
    await deliverRefund(baseCharge, { id: 'cs_sub', metadata: { type: 'subscription' } });

    expect(writes.filter((w) => w.op.startsWith('tx-') && !w.path.startsWith('stripe_webhook_deliveries/'))).toHaveLength(0);
    expect(mocks.mockCreateReversal).not.toHaveBeenCalled();
  });

  it('ignores charges that resolve to no checkout session', async () => {
    mocks.mockListSessions.mockResolvedValue({ data: [] });
    await deliverRefund(baseCharge, {});

    expect(writes.filter((w) => w.op.startsWith('tx-') && !w.path.startsWith('stripe_webhook_deliveries/'))).toHaveLength(0);
  });
});
