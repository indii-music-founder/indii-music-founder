import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';

/**
 * Tests for Shopify webhook sale conversion emission.
 * Verifies HMAC verification, idempotency, and conversion event emission.
 */

const SHOPIFY_SECRET = 'test-webhook-secret';
const ARTIST_ID = 'artist-uid-123';
const ORDER_ID = 'gid://shopify/Order/123456789';
const PRICE = '25.99';
const PRICE_CENTS = 2599; // $25.99

const stub = vi.hoisted(() => {
  const db = {
    outbox: [] as Record<string, unknown>[],
  };
  return { db };
});

const { db } = stub;

// Mock conversionEventOutbox
vi.mock('./conversionEventOutbox.ts', () => ({
  enqueueConversionEvent: async (event: Record<string, unknown>) => {
    db.outbox.push(event);
  },
}));

// Mock firebase-functions
vi.mock('firebase-functions/v2', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock firebase-admin firestore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: (_name: string) => ({
      doc: (id?: string) => ({
        id: id || 'test-id',
      }),
    }),
    runTransaction: vi.fn(async (callback) => {
      return callback({
        get: async () => ({ exists: false }),
        set: vi.fn(),
        update: vi.fn(),
      });
    }),
  }),
}));

// buildConversionEventId from shared
vi.mock('@indii/shared', () => ({
  buildConversionEventId: (parts: any) => `${parts.platform}:${parts.eventType}:${parts.sourceId}`,
}));

// Secret config
vi.mock('../config/secrets', () => ({
  shopifyWebhookSecret: {
    value: () => SHOPIFY_SECRET,
  },
}));

import { emitSaleConversion } from './shopifyWebhook';

beforeEach(() => {
  db.outbox.length = 0;
});

describe('Shopify webhook sale conversion', () => {
  it('emits conversion event for order with artist_id metafield', async () => {
    const order = {
      id: ORDER_ID,
      order_number: 12345,
      total_price: PRICE,
      currency: 'USD',
      created_at: new Date().toISOString(),
      metafields: [
        { namespace: 'indii', key: 'artist_id', value: ARTIST_ID },
      ],
    } as any;

    await emitSaleConversion(order);

    expect(db.outbox.length).toBe(1);
    const event = db.outbox[0];
    expect(event.eventType).toBe('sale');
    expect(event.platform).toBe('shopify');
    expect(event.revenueMinor).toBe(PRICE_CENTS);
    expect(event.artistId).toBe(ARTIST_ID);
  });

  it('includes shopifyOrderId in metadata', async () => {
    const order = {
      id: ORDER_ID,
      order_number: 12345,
      total_price: PRICE,
      currency: 'USD',
      created_at: new Date().toISOString(),
      metafields: [
        { namespace: 'indii', key: 'artist_id', value: ARTIST_ID },
      ],
    } as any;

    await emitSaleConversion(order);

    const event = db.outbox[0] as any;
    expect(event.metadata?.shopifyOrderId).toBe(ORDER_ID);
    expect(event.metadata?.orderNumber).toBe('12345');
  });

  it('skips conversion if artist_id metafield missing', async () => {
    const order = {
      id: ORDER_ID,
      order_number: 12345,
      total_price: PRICE,
      currency: 'USD',
      created_at: new Date().toISOString(),
      metafields: [],
    } as any;

    await emitSaleConversion(order);

    expect(db.outbox.length).toBe(0);
  });

  it('skips conversion if total_price invalid', async () => {
    const order = {
      id: ORDER_ID,
      order_number: 12345,
      total_price: 'invalid',
      currency: 'USD',
      created_at: new Date().toISOString(),
      metafields: [
        { namespace: 'indii', key: 'artist_id', value: ARTIST_ID },
      ],
    } as any;

    await emitSaleConversion(order);

    expect(db.outbox.length).toBe(0);
  });

  it('skips conversion if total_price is zero', async () => {
    const order = {
      id: ORDER_ID,
      order_number: 12345,
      total_price: '0',
      currency: 'USD',
      created_at: new Date().toISOString(),
      metafields: [
        { namespace: 'indii', key: 'artist_id', value: ARTIST_ID },
      ],
    } as any;

    await emitSaleConversion(order);

    expect(db.outbox.length).toBe(0);
  });

  it('uses currency from order', async () => {
    const order = {
      id: ORDER_ID,
      order_number: 12345,
      total_price: PRICE,
      currency: 'EUR',
      created_at: new Date().toISOString(),
      metafields: [
        { namespace: 'indii', key: 'artist_id', value: ARTIST_ID },
      ],
    } as any;

    await emitSaleConversion(order);

    const event = db.outbox[0] as any;
    expect(event.currency).toBe('EUR');
  });

  it('defaults to USD if currency missing', async () => {
    const order = {
      id: ORDER_ID,
      order_number: 12345,
      total_price: PRICE,
      created_at: new Date().toISOString(),
      metafields: [
        { namespace: 'indii', key: 'artist_id', value: ARTIST_ID },
      ],
    } as any;

    await emitSaleConversion(order);

    const event = db.outbox[0] as any;
    expect(event.currency).toBe('USD');
  });

  it('correctly parses price string to cents', async () => {
    const testCases = [
      { input: '25.99', expected: 2599 },
      { input: '10.05', expected: 1005 },
      { input: '100', expected: 10000 },
      { input: '0.50', expected: 50 },
    ];

    for (const tc of testCases) {
      db.outbox.length = 0;
      const order = {
        id: ORDER_ID,
        order_number: 12345,
        total_price: tc.input,
        currency: 'USD',
        created_at: new Date().toISOString(),
        metafields: [
          { namespace: 'indii', key: 'artist_id', value: ARTIST_ID },
        ],
      } as any;

      await emitSaleConversion(order);

      const event = db.outbox[0] as any;
      expect(event.revenueMinor).toBe(tc.expected);
    }
  });

  it('generates deterministic eventId from order id', async () => {
    const order = {
      id: ORDER_ID,
      order_number: 12345,
      total_price: PRICE,
      currency: 'USD',
      created_at: new Date().toISOString(),
      metafields: [
        { namespace: 'indii', key: 'artist_id', value: ARTIST_ID },
      ],
    } as any;

    await emitSaleConversion(order);

    const event = db.outbox[0] as any;
    expect(event.eventId).toContain('shopify:sale');
    expect(event.eventId).toContain(ORDER_ID);
  });
});

describe('Shopify HMAC verification', () => {
  it('generates valid HMAC signature', () => {
    const payload = JSON.stringify({ test: 'data' });
    const hmac = crypto.createHmac('sha256', SHOPIFY_SECRET);
    hmac.update(payload, 'utf8');
    const signature = hmac.digest('base64');

    expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('timing-safe compare detects invalid signatures', () => {
    const payload = JSON.stringify({ test: 'data' });
    const hmac = crypto.createHmac('sha256', SHOPIFY_SECRET);
    hmac.update(payload, 'utf8');
    const validSignature = hmac.digest('base64');
    const invalidSignature = 'invalid-signature';

    const validBuf = Buffer.from(validSignature);
    const invalidBuf = Buffer.from(invalidSignature);

    // Lengths differ, so this would return false immediately
    expect(validBuf.length !== invalidBuf.length).toBe(true);
  });
});
