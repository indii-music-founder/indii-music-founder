/**
 * createCheckoutSession is the function that actually takes a paying
 * customer's money — this is the live, in-production subscription
 * revenue path. It must never let a caller create a checkout session on
 * behalf of a different user, never sell the FREE tier, never let a
 * client self-serve the manually-activated FOUNDER tier, and it must
 * reuse an existing Stripe customer rather than creating duplicates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockCustomersCreate = vi.fn();
  const mockSessionsCreate = vi.fn();
  const mockDocGet = vi.fn();
  const mockDocUpdate = vi.fn();
  const mockDoc = vi.fn(() => ({ get: mockDocGet, update: mockDocUpdate, ref: { update: mockDocUpdate } }));
  const mockCollection = vi.fn(() => ({ doc: mockDoc }));
  const mockDb = { collection: mockCollection };

  return { mockCustomersCreate, mockSessionsCreate, mockDocGet, mockDocUpdate, mockDoc, mockCollection, mockDb };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mocks.mockDb,
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, handler: unknown) => handler,
  HttpsError: class extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('../stripe/config', () => ({
  stripe: {
    customers: { create: mocks.mockCustomersCreate },
    checkout: { sessions: { create: mocks.mockSessionsCreate } },
  },
  getPriceId: vi.fn(() => 'price_test_pro_monthly'),
}));

vi.mock('../config/secrets', () => ({
  stripeSecretKey: {},
}));

function makeRequest(overrides: Partial<{
  userId: string;
  tier: string;
  authUid: string;
  successUrl: string;
  cancelUrl: string;
}> = {}) {
  return {
    data: {
      userId: overrides.userId ?? 'user-123',
      tier: overrides.tier ?? 'pro_monthly',
      successUrl: overrides.successUrl ?? 'https://indii.music/success',
      cancelUrl: overrides.cancelUrl ?? 'https://indii.music/cancel',
    },
    auth: { uid: overrides.authUid ?? 'user-123', token: { email: 'artist@indii.music' } },
  };
}

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockDocGet.mockResolvedValue({ exists: false });
  });

  it('rejects a request whose userId does not match the authenticated caller', async () => {
    const { createCheckoutSession } = await import('./createCheckoutSession');
    const request = makeRequest({ userId: 'user-123', authUid: 'a-different-user' });

    await expect(
      (createCheckoutSession as unknown as (req: unknown) => Promise<unknown>)(request)
    ).rejects.toMatchObject({ code: 'unauthenticated' });

    expect(mocks.mockSessionsCreate).not.toHaveBeenCalled();
    expect(mocks.mockCustomersCreate).not.toHaveBeenCalled();
  });

  it('rejects checkout for the FREE tier — there is nothing to charge for', async () => {
    const { createCheckoutSession } = await import('./createCheckoutSession');
    const request = makeRequest({ tier: 'free' });

    await expect(
      (createCheckoutSession as unknown as (req: unknown) => Promise<unknown>)(request)
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    expect(mocks.mockSessionsCreate).not.toHaveBeenCalled();
  });

  it('rejects checkout for the FOUNDER tier — that seat is activated manually by an admin, never self-serve', async () => {
    const { createCheckoutSession } = await import('./createCheckoutSession');
    const request = makeRequest({ tier: 'founder' });

    await expect(
      (createCheckoutSession as unknown as (req: unknown) => Promise<unknown>)(request)
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    expect(mocks.mockSessionsCreate).not.toHaveBeenCalled();
  });

  it('creates a real subscription checkout session for a new customer and returns the checkout URL', async () => {
    mocks.mockCustomersCreate.mockResolvedValue({ id: 'cus_new_customer' });
    mocks.mockSessionsCreate.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/cs_test_123' });

    const { createCheckoutSession } = await import('./createCheckoutSession');
    const request = makeRequest({ tier: 'pro_monthly' });

    const result = await (createCheckoutSession as unknown as (req: unknown) => Promise<{ checkoutUrl: string; sessionId: string }>)(request);

    expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/cs_test_123', sessionId: 'cs_test_123' });
    expect(mocks.mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'artist@indii.music', metadata: { userId: 'user-123' } }),
      { idempotencyKey: 'create_customer_user-123' }
    );
    expect(mocks.mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_new_customer',
        client_reference_id: 'user-123',
        line_items: [{ price: 'price_test_pro_monthly', quantity: 1 }],
      })
    );
  });

  it('reuses an existing Stripe customer instead of creating a duplicate', async () => {
    mocks.mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ stripeCustomerId: 'cus_existing_customer' }),
      ref: { update: mocks.mockDocUpdate },
    });
    mocks.mockSessionsCreate.mockResolvedValue({ id: 'cs_test_456', url: 'https://checkout.stripe.com/cs_test_456' });

    const { createCheckoutSession } = await import('./createCheckoutSession');
    const request = makeRequest({ tier: 'pro_monthly' });

    await (createCheckoutSession as unknown as (req: unknown) => Promise<unknown>)(request);

    expect(mocks.mockCustomersCreate).not.toHaveBeenCalled();
    expect(mocks.mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing_customer' })
    );
  });
});
