import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for Stripe webhook sale conversion emission.
 * Verifies that checkout.session.completed events emit conversion events to the outbox.
 */

const USER_ID = 'artist-uid-123';
const SESSION_ID = 'cs_test_12345';
const AMOUNT_CENTS = 2599; // $25.99

const stub = vi.hoisted(() => {
  const db = {
    outbox: [] as Record<string, unknown>[],
  };
  return { db };
});

const { db } = stub;

// Mock conversionEventOutbox
vi.mock('../marketing/conversionEventOutbox.ts', () => ({
  enqueueConversionEvent: async (event: Record<string, unknown>) => {
    db.outbox.push(event);
  },
}));

// Must mock before importing the module
vi.mock('firebase-functions/v2', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// buildConversionEventId from shared
vi.mock('@indii/shared', () => ({
  buildConversionEventId: (parts: any) => `${parts.platform}:${parts.eventType}:${parts.sourceId}`,
}));

import { emitSaleConversion } from './webhookHandler';

beforeEach(() => {
  db.outbox.length = 0;
});

describe('Stripe webhook sale conversion', () => {
  it('emits conversion event for paid checkout session with userId', async () => {
    const session = {
      id: SESSION_ID,
      amount_total: AMOUNT_CENTS,
      currency: 'usd',
      metadata: { userId: USER_ID },
    } as any;

    await emitSaleConversion(session);

    expect(db.outbox.length).toBe(1);
    const event = db.outbox[0];
    expect(event.eventType).toBe('sale');
    expect(event.platform).toBe('stripe');
    expect(event.revenueMinor).toBe(AMOUNT_CENTS);
    expect(event.artistId).toBe(USER_ID);
  });

  it('includes stripeSessionId in metadata', async () => {
    const session = {
      id: SESSION_ID,
      amount_total: AMOUNT_CENTS,
      currency: 'usd',
      metadata: { userId: USER_ID },
    } as any;

    await emitSaleConversion(session);

    const event = db.outbox[0] as any;
    expect(event.metadata?.stripeSessionId).toBe(SESSION_ID);
  });

  it('includes fbclid in metadata if present', async () => {
    const session = {
      id: SESSION_ID,
      amount_total: AMOUNT_CENTS,
      currency: 'usd',
      metadata: { userId: USER_ID, fbclid: 'click-123' },
    } as any;

    await emitSaleConversion(session);

    const event = db.outbox[0] as any;
    expect(event.metadata?.fbclid).toBe('click-123');
  });

  it('skips conversion if userId not in metadata', async () => {
    const session = {
      id: SESSION_ID,
      amount_total: AMOUNT_CENTS,
      currency: 'usd',
      metadata: {},
    } as any;

    await emitSaleConversion(session);

    expect(db.outbox.length).toBe(0);
  });

  it('skips conversion if amount_total is zero or negative', async () => {
    const session = {
      id: SESSION_ID,
      amount_total: 0,
      currency: 'usd',
      metadata: { userId: USER_ID },
    } as any;

    await emitSaleConversion(session);

    expect(db.outbox.length).toBe(0);
  });

  it('uses currency from session or defaults to USD', async () => {
    const session = {
      id: SESSION_ID,
      amount_total: AMOUNT_CENTS,
      currency: 'eur',
      metadata: { userId: USER_ID },
    } as any;

    await emitSaleConversion(session);

    const event = db.outbox[0] as any;
    expect(event.currency).toBe('EUR');
  });

  it('defaults to USD if currency missing', async () => {
    const session = {
      id: SESSION_ID,
      amount_total: AMOUNT_CENTS,
      metadata: { userId: USER_ID },
    } as any;

    await emitSaleConversion(session);

    const event = db.outbox[0] as any;
    expect(event.currency).toBe('USD');
  });
});
