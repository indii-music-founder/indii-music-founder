/**
 * ISSUE-1407 webhook-side POD gate regressions: a paid `pod_order` session
 * only confirms the Printful order when the ownership doc is bound to that
 * exact session, the live Stripe amount matches the recorded price, and the
 * order was awaiting payment. Confirm failures park the order and throw so
 * Stripe retries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  const mockRetrieveSession = vi.fn();
  const mockConfirmOrder = vi.fn();
  return { mockConstructEvent, mockRetrieveSession, mockConfirmOrder };
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
    checkout: {
      sessions: {
        list: vi.fn(async () => ({ data: [] })),
        retrieve: mocks.mockRetrieveSession,
      },
    },
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

vi.mock('../pod/printfulApi', () => ({
  confirmPrintfulOrder: mocks.mockConfirmOrder,
}));

const writes: Array<{ op: string; path: string; data?: Record<string, unknown> }> = [];
const store = new Map<string, Record<string, unknown>>();

type FakeRef = {
  path: string;
  get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  set: (data: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<void>;
  update: (data: Record<string, unknown>) => Promise<void>;
};

function fakeRef(path: string): FakeRef {
  const ref = {
    path,
    get: async () => {
      const data = store.get(path);
      return { exists: data != null, data: () => data };
    },
    set: async (data: Record<string, unknown>) => { writes.push({ op: 'ref-set', path, data }); },
    update: async (data: Record<string, unknown>) => { writes.push({ op: 'ref-update', path, data }); },
  };
  return Object.assign(ref as never, {
    collection: (sub: string) => fakeRef(`${path}/${sub}`),
    doc: (id: string) => fakeRef(`${path}/${id}`),
  }) as FakeRef;
}

let fakeDbInstance: {
  collection: (name: string) => FakeRef;
  batch: () => { set: () => void; commit: () => Promise<void> };
  runTransaction: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
};

function setupFirestore(seed: Record<string, Record<string, unknown>> = {}) {
  writes.length = 0;
  store.clear();
  for (const [path, data] of Object.entries(seed)) store.set(path, data);
  fakeDbInstance = {
    collection: (name: string) => fakeRef(name),
    batch: () => ({ set: () => {}, commit: async () => {} }),
    runTransaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ get: async () => ({ exists: false }), set: () => {}, update: () => {} }),
  };
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function deliverPaidPodSession(session: Record<string, unknown>) {
  const event = { id: 'evt_pod_1', type: 'checkout.session.completed', data: { object: session } };
  mocks.mockConstructEvent.mockReturnValue(event);
  const { stripeWebhook } = await import('./webhookHandler');
  const req = { headers: { 'stripe-signature': 'valid_sig' }, rawBody: Buffer.from('{}') };
  const res = makeRes();
  await (stripeWebhook as unknown as (req: unknown, res: unknown) => Promise<void>)(req, res);
  return res;
}

const ORDER_PATH = 'users/u1/pod_orders/101';
const boundSession = {
  id: 'cs_pod_1',
  payment_status: 'paid',
  amount_total: 1563,
  payment_intent: 'pi_pod_1',
  metadata: { type: 'pod_order', userId: 'u1', printfulOrderId: '101' },
};

describe('handlePodOrderPaid webhook gate (ISSUE-1407)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestore({
      [ORDER_PATH]: {
        status: 'awaiting_payment',
        checkoutSessionId: 'cs_pod_1',
        customerCents: 1563,
      },
    });
    mocks.mockRetrieveSession.mockResolvedValue(boundSession);
    mocks.mockConfirmOrder.mockResolvedValue({ id: 101, status: 'pending' });
  });

  it('confirms the Printful order when binding and amount verify', async () => {
    await deliverPaidPodSession(boundSession);

    expect(mocks.mockConfirmOrder).toHaveBeenCalledWith('101');
    const confirmWrite = writes.find((w) => w.path === ORDER_PATH && w.data?.status === 'confirmed');
    expect(confirmWrite).toMatchObject({ data: { stripeSessionId: 'cs_pod_1', paidCents: 1563 } });
  });

  it('refuses a session not bound to the order doc', async () => {
    await deliverPaidPodSession({ ...boundSession, id: 'cs_FORGED' });

    expect(mocks.mockConfirmOrder).not.toHaveBeenCalled();
    expect(writes.find((w) => w.path === ORDER_PATH && w.data?.status === 'confirmed')).toBeUndefined();
  });

  it('refuses when the live Stripe amount differs from the recorded price', async () => {
    mocks.mockRetrieveSession.mockResolvedValue({ ...boundSession, amount_total: 1 });
    await deliverPaidPodSession(boundSession);

    expect(mocks.mockConfirmOrder).not.toHaveBeenCalled();
  });

  it('skips duplicate deliveries of an already-confirmed order', async () => {
    store.set(ORDER_PATH, {
      status: 'confirmed',
      checkoutSessionId: 'cs_pod_1',
      customerCents: 1563,
      stripeSessionId: 'cs_pod_1',
    });
    await deliverPaidPodSession(boundSession);

    expect(mocks.mockConfirmOrder).not.toHaveBeenCalled();
    expect(writes.find((w) => w.path === ORDER_PATH && w.data?.status === 'confirmed')).toBeUndefined();
  });

  it('parks the order and fails the delivery when the Printful confirm fails, so Stripe retries', async () => {
    mocks.mockConfirmOrder.mockRejectedValue(new Error('Printful 500'));

    const res = await deliverPaidPodSession(boundSession);

    expect(res.status).toHaveBeenCalledWith(500);
    const parked = writes.find((w) => w.path === ORDER_PATH && w.data?.status === 'payment_received_confirm_failed');
    expect(parked).toBeDefined();
    expect(parked!.data).toMatchObject({ confirmError: 'Printful 500' });
  });

  it('never confirms an unpaid session', async () => {
    await deliverPaidPodSession({ ...boundSession, payment_status: 'unpaid' });

    expect(mocks.mockConfirmOrder).not.toHaveBeenCalled();
  });
});
