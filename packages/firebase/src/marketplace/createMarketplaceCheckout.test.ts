/**
 * ISSUE-977 / ISSUE-978: createMarketplaceCheckout must never trust a
 * client-supplied price, must atomically reserve inventory before ever
 * contacting Stripe, and must release that reservation if Stripe session
 * creation fails.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
    const mockProductRef = { id: 'mock-product-ref' };
    const mockReservationRef = { id: 'reservation-1' };
    const mockReservationUpdate = vi.fn().mockResolvedValue(undefined);

    const mockTx = {
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
    };

    const mockRunTransaction = vi.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));

    const mockCollection = vi.fn((name: string) => ({
        doc: vi.fn((id?: string) => {
            if (name === 'products') return { ...mockProductRef, id: id ?? mockProductRef.id };
            if (name === 'marketplace_reservations') return { ...mockReservationRef, update: mockReservationUpdate };
            return { id: id ?? 'mock-doc' };
        }),
    }));

    const mockDb = {
        collection: mockCollection,
        runTransaction: mockRunTransaction,
    };

    const mockSessionsCreate = vi.fn();

    return {
        mockTx,
        mockRunTransaction,
        mockCollection,
        mockDb,
        mockSessionsCreate,
        mockReservationUpdate,
        mockReservationRef,
    };
});

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => mocks.mockDb,
    FieldValue: {
        serverTimestamp: () => 'MOCK_TIMESTAMP',
        increment: (n: number) => ({ __increment: n }),
    },
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

vi.mock('firebase-functions', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../stripe/config', () => ({
    stripe: {
        checkout: {
            sessions: {
                create: mocks.mockSessionsCreate,
            },
        },
    },
}));

vi.mock('../config/secrets', () => ({
    stripeSecretKey: { value: vi.fn(() => 'sk_test_mock') },
}));

import { createMarketplaceCheckout } from './createMarketplaceCheckout';

function callable() {
    return createMarketplaceCheckout as unknown as (request: {
        data: unknown;
        auth?: { uid: string; token?: { email?: string } };
    }) => Promise<{ checkoutUrl: string; sessionId: string }>;
}

describe('createMarketplaceCheckout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockRunTransaction.mockImplementation((cb: (tx: typeof mocks.mockTx) => Promise<unknown>) => cb(mocks.mockTx));
    });

    it('throws unauthenticated when there is no signed-in user', async () => {
        await expect(callable()({ data: { productId: 'p1', successUrl: 'https://a', cancelUrl: 'https://b' } }))
            .rejects.toThrow(expect.objectContaining({ code: 'unauthenticated' }));
    });

    it('loads price from Firestore server-side and NEVER accepts a client amount, even if one is supplied', async () => {
        mocks.mockTx.get.mockResolvedValueOnce({
            exists: true,
            data: () => ({ isActive: true, sellerId: 'seller-1', title: 'Beat Pack', price: 999, currency: 'USD' }),
        });
        mocks.mockSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/cs_1', id: 'cs_1' });

        const maliciousClientPayload = {
            productId: 'p1',
            amount: 1, // an attacker-supplied near-zero amount — must be fully ignored
            price: 1,
            successUrl: 'https://a',
            cancelUrl: 'https://b',
        };

        const result = await callable()({ data: maliciousClientPayload, auth: { uid: 'buyer-1' } });

        expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/cs_1', sessionId: 'cs_1' });
        expect(mocks.mockSessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                line_items: [expect.objectContaining({
                    price_data: expect.objectContaining({ unit_amount: 999 }), // from Firestore, not the client
                })],
            })
        );
    });

    it('atomically reserves inventory (decrements by 1) before ever contacting Stripe', async () => {
        mocks.mockTx.get.mockResolvedValueOnce({
            exists: true,
            data: () => ({ isActive: true, sellerId: 'seller-1', title: 'Ltd Vinyl', price: 2500, currency: 'USD', inventory: 1 }),
        });
        mocks.mockSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/cs_2', id: 'cs_2' });

        await callable()({ data: { productId: 'p1', successUrl: 'https://a', cancelUrl: 'https://b' }, auth: { uid: 'buyer-1' } });

        expect(mocks.mockTx.update).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ inventory: { __increment: -1 } })
        );
    });

    it('rejects when the last unit is already sold — prevents oversell', async () => {
        mocks.mockTx.get.mockResolvedValueOnce({
            exists: true,
            data: () => ({ isActive: true, sellerId: 'seller-1', title: 'Sold Out Ticket', price: 5000, currency: 'USD', inventory: 0 }),
        });

        await expect(callable()({ data: { productId: 'p1', successUrl: 'https://a', cancelUrl: 'https://b' }, auth: { uid: 'buyer-1' } }))
            .rejects.toThrow(expect.objectContaining({ code: 'failed-precondition' }));
        expect(mocks.mockSessionsCreate).not.toHaveBeenCalled();
    });

    it('rejects a seller attempting to buy their own listing', async () => {
        mocks.mockTx.get.mockResolvedValueOnce({
            exists: true,
            data: () => ({ isActive: true, sellerId: 'buyer-1', title: 'Own Beat', price: 1000, currency: 'USD' }),
        });

        await expect(callable()({ data: { productId: 'p1', successUrl: 'https://a', cancelUrl: 'https://b' }, auth: { uid: 'buyer-1' } }))
            .rejects.toThrow(expect.objectContaining({ code: 'failed-precondition' }));
    });

    it('releases the reservation (restores inventory) if Stripe session creation fails', async () => {
        mocks.mockTx.get
            .mockResolvedValueOnce({
                exists: true,
                data: () => ({ isActive: true, sellerId: 'seller-1', title: 'Flaky Item', price: 1000, currency: 'USD', inventory: 3 }),
            })
            .mockResolvedValueOnce({
                exists: true,
                data: () => ({ status: 'reserved', hasInventoryTracking: true }),
            });
        mocks.mockSessionsCreate.mockRejectedValueOnce(new Error('Stripe is down'));

        await expect(callable()({ data: { productId: 'p1', successUrl: 'https://a', cancelUrl: 'https://b' }, auth: { uid: 'buyer-1' } }))
            .rejects.toThrow();

        // Second transaction call should restore the +1 that was reserved in the first.
        expect(mocks.mockTx.update).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ inventory: { __increment: 1 } })
        );
    });
});
