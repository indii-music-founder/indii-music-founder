/**
 * Regression tests for the P0 metadata-spread fix in createOneTimeCheckout.
 *
 * The webhook routes fulfillment purely on `session.metadata.type`, so client
 * metadata used to be able to override the server-set discriminator
 * (`type: 'one_time'`) and identity (`userId`) — minting credits or completing
 * marketplace purchases for a $0.01 payment. Reserved keys must be stripped
 * from client input and the server values stamped LAST so they always win.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSessionsCreate: vi.fn(),
  mockProductGet: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (col: string) => ({
      doc: (id: string) => ({
        get: () => mocks.mockProductGet(col, id),
      }),
    }),
  }),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, handler: unknown) => handler,
   
  HttpsError: class extends (Error as any) {
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('../stripe/config', () => ({
  stripe: {
    checkout: {
      sessions: { create: mocks.mockSessionsCreate },
    },
  },
}));

vi.mock('../config/secrets', () => ({
  stripeSecretKey: {},
  arcjetKey: {},
}));

import { createOneTimeCheckout } from './createOneTimeCheckout';

// The production export is the v2 onCall wrapper; under test the mock unwraps
// it to the bare handler, so calls go through this narrowed signature.
const callCallable = (request: unknown) =>
    (createOneTimeCheckout as unknown as (req: unknown) => Promise<{ checkoutUrl: string; sessionId: string }>)(request);

const UID = 'artist-uid-1';

function makeRequest(metadata: Record<string, string>, extraData: Record<string, unknown> = {}) {
  return {
    auth: { uid: UID, token: { email: 'artist@example.com' } },
    data: {
      userId: UID,
      items: [{ productId: 'beat_license_1', name: 'Custom beat license', amount: 1000, quantity: 1 }],
      successUrl: 'https://indii.music/success',
      cancelUrl: 'https://indii.music/cancel',
      metadata,
      ...extraData,
    },
     
  } as any;
}

describe('createOneTimeCheckout metadata authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/x', id: 'cs_test_1' });
    mocks.mockProductGet.mockResolvedValue({
      exists: true,
      data: () => ({ title: 'Custom beat license', priceCents: 1000, currency: 'usd', isActive: true }),
    });
  });

  it('ignores client-supplied amount and enforces server-side catalog price', async () => {
    mocks.mockProductGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ title: 'Founder Seat', priceCents: 250000, currency: 'usd', isActive: true }),
    });
    await callCallable({
      auth: { uid: UID, token: { email: 'artist@example.com' } },
      data: {
        userId: UID,
        items: [{ productId: 'founder_seat', name: 'Spoofed', amount: 50, quantity: 1 }],
        successUrl: 'https://indii.music/success',
        cancelUrl: 'https://indii.music/cancel',
      },
    } as any);

    const params = mocks.mockSessionsCreate.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(250000);
    expect(params.line_items[0].price_data.product_data.name).toBe('Founder Seat');
  });

  it('rejects items missing a valid productId', async () => {
    await expect(
      callCallable({
        auth: { uid: UID, token: { email: 'artist@example.com' } },
        data: {
          userId: UID,
          items: [{ name: 'Bypass item', amount: 50, quantity: 1 }],
          successUrl: 'https://indii.music/success',
          cancelUrl: 'https://indii.music/cancel',
        },
      } as any),
    ).rejects.toThrow('Each item must include a valid catalog productId.');
  });

  it('locks the webhook routing discriminator: client cannot set type or userId', async () => {
    await callCallable(
      makeRequest({
        type: 'micro_transaction',
        userId: 'victim-uid',
        credits: '1000000',
      }),
    );

    expect(mocks.mockSessionsCreate).toHaveBeenCalledTimes(1);
    const params = mocks.mockSessionsCreate.mock.calls[0][0];

    // Server values win in BOTH metadata surfaces regardless of client input.
    expect(params.metadata.type).toBe('one_time');
    expect(params.metadata.userId).toBe(UID);
    expect(params.payment_intent_data.metadata.type).toBe('one_time');
    expect(params.payment_intent_data.metadata.userId).toBe(UID);

    // A spoofed micro_transaction route would previously have minted credits.
    expect(params.metadata.type).not.toBe('micro_transaction');
  });

  it('still passes legitimate non-reserved client metadata through', async () => {
    await callCallable(makeRequest({ orderId: 'ord_42', giftNote: 'hi' }));

    const params = mocks.mockSessionsCreate.mock.calls[0][0];
    expect(params.metadata.orderId).toBe('ord_42');
    expect(params.metadata.giftNote).toBe('hi');
  });

  it('drops non-string metadata values instead of passing them to Stripe', async () => {
     
    await callCallable(makeRequest({ sneaky: { nested: 'object' } } as any));

    const params = mocks.mockSessionsCreate.mock.calls[0][0];
    expect(params.metadata.sneaky).toBeUndefined();
  });

  it('rejects an anonymous or unverified user', async () => {
    const anonRequest = {
      ...makeRequest({}),
      auth: { uid: UID, token: { email: 'anon@example.com', firebase: { sign_in_provider: 'anonymous' } } },
    };
    await expect(callCallable(anonRequest)).rejects.toThrow('A verified signed-in user is required');

    const unverifiedRequest = {
      ...makeRequest({}),
      auth: { uid: UID, token: { email: 'unverified@example.com', email_verified: false } },
    };
    await expect(callCallable(unverifiedRequest)).rejects.toThrow('A verified signed-in user is required');
  });
});
