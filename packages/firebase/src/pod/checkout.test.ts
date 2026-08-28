/**
 * ISSUE-1407 POD paid-gate regressions for pod_createOrderCheckout.
 *
 * The checkout must be bound server-side to a specific Printful DRAFT order
 * owned by the caller, priced from Printful's own estimate plus a clamped
 * platform markup — never from client input — and must only accept redirects
 * to approved indii.music origins.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockCreateSession = vi.fn();
  const mockGetOrder = vi.fn();
  const mockEstimate = vi.fn();
  const mockGetDoc = vi.fn();
  return { mockCreateSession, mockGetOrder, mockEstimate, mockGetDoc };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: mocks.mockGetDoc,
        set: (data: Record<string, unknown>) => { docWrites.push(data); return Promise.resolve(); },
        collection: () => ({ doc: () => ({ get: mocks.mockGetDoc, set: (data: Record<string, unknown>) => { docWrites.push(data); return Promise.resolve(); } }) }),
      }),
    }),
  }),
  FieldValue: { serverTimestamp: () => 'MOCK_TIMESTAMP' },
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, handler: unknown) => handler,
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) { super(message); }
  },
}));

vi.mock('firebase-functions', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../stripe/config', () => ({
  stripe: { checkout: { sessions: { create: mocks.mockCreateSession } } },
}));

vi.mock('../config/secrets', () => ({
  printfulApiKey: {},
  stripeSecretKey: {},
}));

vi.mock('./printfulApi', () => ({
  getPrintfulOrder: mocks.mockGetOrder,
  estimatePrintfulOrderCosts: mocks.mockEstimate,
}));

interface OrderDocState {
  exists: boolean;
  data?: Record<string, unknown>;
}

let orderDoc: OrderDocState;
const docWrites: Array<Record<string, unknown>> = [];

async function call(data: Record<string, unknown>) {
  const { pod_createOrderCheckout } = await import('./checkout');
  return (pod_createOrderCheckout as unknown as (req: unknown) => Promise<unknown>)({
    auth: { uid: 'u1', token: { email: 'u1@example.com' } },
    data,
  });
}

describe('pod_createOrderCheckout (ISSUE-1407)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    orderDoc = { exists: true, data: { orderId: '101', status: 'created' } };
    docWrites.length = 0;
    mocks.mockGetDoc.mockImplementation(async () => ({
      exists: orderDoc.exists,
      data: () => orderDoc.data,
    }));
    mocks.mockGetOrder.mockResolvedValue({
      status: 'draft',
      items: [{ sync_variant_id: 401, quantity: 2, files: [] }],
      recipient: { name: 'Test' },
    });
    mocks.mockEstimate.mockResolvedValue({ total: '12.50', currency: 'usd' });
    mocks.mockCreateSession.mockResolvedValue({ id: 'cs_pod_1', url: 'https://checkout.stripe.com/x', amount_total: 1563 });
  });

  it('prices the order server-side from the Printful estimate plus markup and binds the session to the draft', async () => {
    const result = (await call({
      orderId: '101',
      successUrl: 'https://app.indii.music/pod/success',
      cancelUrl: 'https://app.indii.music/pod/cancel',
    })) as { customerCents: number; sessionId: string };

    expect(result.customerCents).toBe(1563); // $12.50 + 25% markup, rounded
    expect(docWrites.find((d) => d.status === 'awaiting_payment')).toMatchObject({
      checkoutSessionId: 'cs_pod_1',
      customerCents: 1563,
    });
    expect(mocks.mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: [expect.objectContaining({
          price_data: expect.objectContaining({ unit_amount: 1563, currency: 'usd' }),
        })],
        metadata: expect.objectContaining({ type: 'pod_order', userId: 'u1', printfulOrderId: '101' }),
      }),
      expect.objectContaining({ idempotencyKey: 'pod_checkout_u1_101' }),
    );
    expect(result.sessionId).toBe('cs_pod_1');
  });

  it('refuses an order the caller does not own', async () => {
    orderDoc = { exists: false };
    await expect(call({
      orderId: '999',
      successUrl: 'https://app.indii.music/s',
      cancelUrl: 'https://app.indii.music/c',
    })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(mocks.mockCreateSession).not.toHaveBeenCalled();
  });

  it('refuses an order that is no longer a Printful draft', async () => {
    mocks.mockGetOrder.mockResolvedValue({ status: 'fulfilled', items: [] });
    await expect(call({
      orderId: '101',
      successUrl: 'https://app.indii.music/s',
      cancelUrl: 'https://app.indii.music/c',
    })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mocks.mockCreateSession).not.toHaveBeenCalled();
  });

  it('refuses redirect URLs outside the approved origin allowlist', async () => {
    await expect(call({
      orderId: '101',
      successUrl: 'https://evil.example.com/success',
      cancelUrl: 'https://app.indii.music/cancel',
    })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mocks.mockCreateSession).not.toHaveBeenCalled();
  });

  it('fails closed when Printful returns an unusable estimate', async () => {
    mocks.mockEstimate.mockResolvedValue({ total: null });
    await expect(call({
      orderId: '101',
      successUrl: 'https://app.indii.music/s',
      cancelUrl: 'https://app.indii.music/c',
    })).rejects.toMatchObject({ code: 'internal' });
    expect(mocks.mockCreateSession).not.toHaveBeenCalled();
  });

  it('clamps an absurd configured markup to the 500% ceiling', async () => {
    const { resolvePodMarkupPercent } = await import('./checkout');
    // No config doc data → falls to env, then default; env of 100000 clamps to 500.
    vi.stubEnv('POD_CHECKOUT_MARKUP_PERCENT', '100000');
    await expect(resolvePodMarkupPercent()).resolves.toBe(500);
    vi.unstubAllEnvs();
  });
});
