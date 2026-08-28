/**
 * ISSUE-1410 regressions: invoice.paid must derive subscription status from
 * the LIVE Stripe subscription object, never hardcode 'active'. A late
 * invoice.paid after cancellation must not resurrect the subscription, and
 * one-time invoices must not touch subscription status at all (but still get
 * their ledger entry).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  const mockRetrieveSubscription = vi.fn();
  const mockRunTransaction = vi.fn();
  const mockCollection = vi.fn();
  return { mockConstructEvent, mockRetrieveSubscription, mockRunTransaction, mockCollection };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: mocks.mockCollection, runTransaction: mocks.mockRunTransaction }),
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
    subscriptions: { retrieve: mocks.mockRetrieveSubscription },
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

const subDocUpdates: Array<Record<string, unknown>> = [];
const ledgerSets: Array<{ path: string; data?: Record<string, unknown>; op?: string }> = [];

function setupFirestore() {
  subDocUpdates.length = 0;
  ledgerSets.length = 0;

  mocks.mockCollection.mockImplementation((name: string) => {
    if (name === 'subscriptions') {
      const subDocRef = {
        update: async (data: Record<string, unknown>) => { subDocUpdates.push(data); },
      };
      return {
        doc: () => subDocRef,
        where: () => ({
          limit: () => ({
            __isQuery: true,
            get: async () => ({ empty: false, docs: [{ ref: subDocRef, id: 'u1' }] }),
          }),
        }),
      };
    }
    return {
      doc: (id: string) => ({
        set: async (data: Record<string, unknown>) => { ledgerSets.push({ path: `${name}/${id}`, data }); },
        update: async (data: Record<string, unknown>) => { ledgerSets.push({ path: `${name}/${id}`, data, op: 'update' }); },
      }),
    };
  });

  mocks.mockRunTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      // Delivery-guard refs (plain doc refs) read as "not yet processed";
      // query refs (updateSubscriptionByCustomer) read as an existing sub doc.
      get: async (ref: { __isQuery?: boolean }) => {
        if (ref?.__isQuery) {
          return { empty: false, docs: [{ ref: { update: async (d: Record<string, unknown>) => { subDocUpdates.push(d); } }, id: 'u1' }] };
        }
        return { exists: false, data: () => undefined, get: () => undefined };
      },
      set: async () => {},
      update: async (_ref: unknown, data: Record<string, unknown>) => { subDocUpdates.push(data); },
    }));
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function deliverInvoice(invoice: Record<string, unknown>) {
  const event = { id: 'evt_inv_1', type: 'invoice.paid', data: { object: invoice } };
  mocks.mockConstructEvent.mockReturnValue(event);
  const { stripeWebhook } = await import('./webhookHandler');
  const req = { headers: { 'stripe-signature': 'valid_sig' }, rawBody: Buffer.from('{}') };
  const res = makeRes();
  await (stripeWebhook as unknown as (req: unknown, res: unknown) => Promise<void>)(req, res);
  return res;
}

describe('handleInvoicePaid status authority (ISSUE-1410)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestore();
  });

  it('does NOT resurrect a canceled subscription: status derives from the live object', async () => {
    mocks.mockRetrieveSubscription.mockResolvedValue({
      status: 'canceled',
      current_period_start: 100,
      current_period_end: 200,
      cancel_at_period_end: false,
    });

    await deliverInvoice({
      id: 'in_1',
      customer: 'cus_1',
      subscription: 'sub_1',
      total: 2500,
      currency: 'usd',
    });

    expect(mocks.mockRetrieveSubscription).toHaveBeenCalledWith('sub_1');
    expect(subDocUpdates.length).toBeGreaterThan(0);
    expect(subDocUpdates[0]).toMatchObject({ status: 'canceled' });
    // Payment history is still recorded.
    expect(ledgerSets.find((l) => l.path === 'users/u1/ledger/subscription_payment_in_1')).toBeDefined();
  });

  it('writes past_due for an unpaid live subscription', async () => {
    mocks.mockRetrieveSubscription.mockResolvedValue({
      status: 'unpaid',
      current_period_start: 100,
      current_period_end: 200,
      cancel_at_period_end: true,
    });

    await deliverInvoice({ id: 'in_2', customer: 'cus_1', subscription: 'sub_1', total: 2500, currency: 'usd' });

    expect(subDocUpdates[0]).toMatchObject({ status: 'unpaid', cancelAtPeriodEnd: true });
  });

  it('keeps active-subscription behavior (no regression)', async () => {
    mocks.mockRetrieveSubscription.mockResolvedValue({
      status: 'active',
      current_period_start: 100,
      current_period_end: 200,
      cancel_at_period_end: false,
    });

    await deliverInvoice({ id: 'in_3', customer: 'cus_1', subscription: 'sub_1', total: 2500, currency: 'usd' });

    expect(subDocUpdates[0]).toMatchObject({ status: 'active', currentPeriodEnd: 200000 });
  });

  it('one-time invoices never touch subscription status but still write the ledger entry', async () => {
    await deliverInvoice({ id: 'in_once', customer: 'cus_1', total: 999, currency: 'usd' });

    expect(mocks.mockRetrieveSubscription).not.toHaveBeenCalled();
    expect(subDocUpdates).toHaveLength(0);
    expect(ledgerSets.find((l) => l.path === 'users/u1/ledger/subscription_payment_in_once')).toBeDefined();
  });
});
