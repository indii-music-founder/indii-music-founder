import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockCustomersCreate = vi.fn();
  const mockSessionsCreate = vi.fn();
  const mockDocGet = vi.fn();
  const mockDocUpdate = vi.fn();
  const mockDocSet = vi.fn();
  const mockDoc = vi.fn(() => ({
    get: mockDocGet,
    update: mockDocUpdate,
    set: mockDocSet,
    ref: { update: mockDocUpdate, set: mockDocSet },
  }));
  const mockCollection = vi.fn(() => ({ doc: mockDoc }));
  const mockDb = { collection: mockCollection };

  return {
    mockCustomersCreate,
    mockSessionsCreate,
    mockDocGet,
    mockDocUpdate,
    mockDocSet,
    mockDoc,
    mockCollection,
    mockDb,
  };
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
}));

vi.mock('../config/secrets', () => ({
  stripeSecretKey: {},
}));

import { createMicroTransaction } from './createMicroTransaction';

function makeRequest(overrides: Partial<{
  userId: string;
  credits: number;
  authUid: string;
  successUrl: string;
  cancelUrl: string;
}> = {}) {
  const authUid = overrides.authUid !== undefined ? overrides.authUid : (overrides.userId ?? 'user-123');
  return {
    data: {
      userId: overrides.userId ?? 'user-123',
      credits: overrides.credits ?? 100,
      successUrl: overrides.successUrl ?? 'https://indii.music/success',
      cancelUrl: overrides.cancelUrl ?? 'https://indii.music/cancel',
    },
    auth: authUid ? { uid: authUid, token: { email: 'artist@indii.music' } } : undefined,
  };
}

describe('createMicroTransaction', () => {
  const originalEnv = process.env.STRIPE_PRICE_CREDIT_PACK;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_CREDIT_PACK = 'price_credit_pack_test';
    mocks.mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ stripeCustomerId: 'cus_existing_123' }),
    });
    mocks.mockSessionsCreate.mockResolvedValue({
      id: 'cs_mt_test_123',
      url: 'https://checkout.stripe.com/cs_mt_test_123',
    });
  });

  afterEach(() => {
    process.env.STRIPE_PRICE_CREDIT_PACK = originalEnv;
  });

  it('rejects unauthenticated requests or cross-user caller mismatch', async () => {
    const fn = createMicroTransaction as any;

    await expect(fn(makeRequest({ authUid: '' }))).rejects.toThrow('Unauthorized');
    await expect(fn(makeRequest({ userId: 'alice', authUid: 'bob' }))).rejects.toThrow('Unauthorized');
  });

  it('rejects non-positive credit requests', async () => {
    const fn = createMicroTransaction as any;

    await expect(fn(makeRequest({ credits: 0 }))).rejects.toThrow('Credits must be greater than 0');
    await expect(fn(makeRequest({ credits: -50 }))).rejects.toThrow('Credits must be greater than 0');
  });

  it('fails if STRIPE_PRICE_CREDIT_PACK is not configured', async () => {
    delete process.env.STRIPE_PRICE_CREDIT_PACK;
    const fn = createMicroTransaction as any;

    await expect(fn(makeRequest())).rejects.toThrow('No Stripe price configured for micro-transactions');
  });

  it('creates checkout session with correct line items and metadata', async () => {
    const fn = createMicroTransaction as any;
    const result = await fn(makeRequest({ credits: 250 }));

    expect(result).toEqual({
      checkoutUrl: 'https://checkout.stripe.com/cs_mt_test_123',
      sessionId: 'cs_mt_test_123',
    });
    expect(mocks.mockSessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      customer: 'cus_existing_123',
      line_items: [
        {
          price: 'price_credit_pack_test',
          quantity: 250,
        },
      ],
      metadata: expect.objectContaining({
        userId: 'user-123',
        type: 'micro_transaction',
        credits: '250',
      }),
    }));
  });
});
