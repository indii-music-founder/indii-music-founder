/**
 * WO-8: Stripe Webhook Handler Tests
 *
 * Covers:
 * - Signature verification (valid + invalid)
 * - Idempotency guard (duplicate event rejection)
 * - checkout.session.completed (subscription)
 * - customer.subscription.created / updated / deleted
 * - invoice.paid (with ledger entry)
 * - invoice.payment_failed (with dunning notification)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted mocks (available to vi.mock factories via closure)
// ─────────────────────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockAdd = vi.fn().mockResolvedValue(undefined);

    // Firestore doc snapshot factory
    const makeSnap = (exists: boolean, data: Record<string, unknown> = {}) => ({
        exists,
        data: () => data,
        ref: { update: mockUpdate },
        id: data['userId'] as string ?? 'user-123',
    });

    const mockDoc = vi.fn(() => ({ set: mockSet, update: mockUpdate, get: vi.fn() }));
    const mockCollection = vi.fn(() => ({ doc: mockDoc, add: mockAdd, where: vi.fn() }));

    // runTransaction: smartly returns the right snapshot type based on the argument.
    // The idempotency guard passes a doc ref → returns a doc snapshot (exists: false by default).
    // The subscription lookup passes a CollectionQuery → returns a query snapshot (docs array).
    const makeQuerySnap = (found = true) => ({
        empty: !found,
        docs: found ? [{ id: 'user-123', ref: { update: mockUpdate } }] : [],
    });

    const mockRunTransaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        let callCount = 0;
        const tx = {
            // First call is always the idempotency check (doc ref → doc snap).
            // Subsequent calls are subscription queries (query → query snap).
            get: vi.fn().mockImplementation(async () => {
                callCount++;
                return callCount === 1 ? makeSnap(false) : makeQuerySnap(true);
            }),
            set: mockSet,
            update: mockUpdate,
        };
        return cb(tx);
    });

    // where(...).limit(1).get() — returns a subscription snapshot by default
    const mockWhereGet = vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ id: 'user-123', ref: { update: mockUpdate } }],
    });
    const mockLimit = vi.fn(() => ({ get: mockWhereGet }));
    const mockWhere = vi.fn(() => ({ limit: mockLimit }));

    const mockDb = {
        collection: vi.fn((_name: string) => ({
            doc: mockDoc,
            add: mockAdd,
            where: mockWhere,
        })),
        runTransaction: mockRunTransaction,
    };

    const mockConstructEvent = vi.fn();
    const mockRetrieve = vi.fn();
    const mockTransferCreate = vi.fn().mockResolvedValue({ id: 'tr_123' });

    return {
        mockSet,
        mockUpdate,
        mockAdd,
        mockDoc,
        mockCollection,
        mockRunTransaction,
        mockWhereGet,
        mockWhere,
        mockLimit,
        mockDb,
        mockConstructEvent,
        mockRetrieve,
        mockTransferCreate,
        makeSnap,
    };
});

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => mocks.mockDb,
    FieldValue: {
        serverTimestamp: () => 'MOCK_TIMESTAMP',
        delete: () => 'MOCK_DELETE',
        increment: (n: number) => n,
    },
}));

vi.mock('firebase-functions/v2/https', () => ({
    onRequest: (_opts: unknown, handler: unknown) => handler,
}));

vi.mock('firebase-functions/params', () => ({
    defineSecret: vi.fn(() => ({ value: vi.fn(() => 'mock-secret') })),
}));

vi.mock('../config/secrets', () => ({
    stripeSecretKey: { value: vi.fn(() => 'sk_test_mock') },
    stripeWebhookSecret: { value: vi.fn(() => 'whsec_mock') },
    getStripeSecretKey: () => 'sk_test_mock',
    getStripeWebhookSecret: () => 'whsec_mock',
}));

vi.mock('../stripe/config', async () => {
    const actual = await vi.importActual('../stripe/config') as Record<string, unknown>;
    return {
        ...actual,
        stripe: {
            webhooks: { constructEvent: mocks.mockConstructEvent },
            subscriptions: { retrieve: mocks.mockRetrieve },
            transfers: { create: mocks.mockTransferCreate },
        },
        mapStripeStatus: (status: string) => {
            const map: Record<string, string> = {
                active: 'active',
                past_due: 'past_due',
                canceled: 'canceled',
                trialing: 'trialing',
                incomplete: 'incomplete',
                incomplete_expired: 'canceled',
                unpaid: 'past_due',
            };
            return map[status] ?? 'canceled';
        },
        mapStripeTierToSubscriptionTier: (productId: string) => {
            if (productId === 'prod_pro') return 'pro_monthly';
            if (productId === 'prod_studio') return 'studio';
            return null;
        },
    };
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: make a fake req/res
// ─────────────────────────────────────────────────────────────────────────────
function makeReqRes(event: Partial<Stripe.Event>, overrideSignature?: string) {
    const body = JSON.stringify(event);
    const req = {
        headers: { 'stripe-signature': overrideSignature ?? 'valid-sig' },
        rawBody: Buffer.from(body),
    };
    const jsonFn = vi.fn();
    const statusFn = vi.fn(() => ({ json: jsonFn }));
    const res = { json: jsonFn, status: statusFn };
    return { req, res, jsonFn, statusFn };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

// Import once — vi.mock handles isolation per describe
import { stripeWebhook as _stripeWebhook } from '../stripe/webhookHandler';
const stripeWebhook = _stripeWebhook as unknown as (req: unknown, res: unknown) => Promise<void>;

describe('Stripe Webhook Handler (WO-8)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // mockRunTransaction call 1 = idempotency check → tx.get returns doc snap (not exists)
        // mockRunTransaction call 2+ = subscription lookup → tx.get returns query snap (docs=[user-123])
        let txCallCount = 0;
        mocks.mockRunTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
            txCallCount++;
            const isIdempotencyCheck = (txCallCount % 2) === 1; // Odd = idempotency, Even = subscription
            const tx = {
                get: vi.fn().mockResolvedValue(
                    isIdempotencyCheck
                        ? mocks.makeSnap(false)         // idempotency: not yet processed
                        : { empty: false, docs: [{ id: 'user-123', ref: { update: mocks.mockUpdate } }] }
                ),
                set: mocks.mockSet,
                update: mocks.mockUpdate,
            };
            return cb(tx);
        });
        // Non-transaction where-chain mock (used by invoice.paid and invoice.payment_failed)
        mocks.mockWhereGet.mockResolvedValue({
            empty: false,
            docs: [{ id: 'user-123', ref: { update: mocks.mockUpdate } }],
        });
    });

    // ── Signature Verification ───────────────────────────────────────────────

    it('should reject requests with invalid Stripe signature (400)', async () => {
        mocks.mockConstructEvent.mockImplementation(() => {
            throw new Error('Invalid signature');
        });

        const { req, res, statusFn, jsonFn } = makeReqRes({ id: 'evt_bad' }, 'bad-sig');
        await stripeWebhook(req, res);

        expect(statusFn).toHaveBeenCalledWith(400);
        expect(jsonFn).toHaveBeenCalledWith({ error: 'Invalid signature' });
    });

    // ── Idempotency Guard ────────────────────────────────────────────────────

    it('should skip duplicate webhook events gracefully', async () => {
        const event: Partial<Stripe.Event> = { id: 'evt_dup', type: 'checkout.session.completed' };
        mocks.mockConstructEvent.mockReturnValue(event);

        // Simulate Firestore returning "already processed".
        // The source calls snap.get('status') (DocumentSnapshot API), so the mock
        // must provide a .get() method. status='completed' → not 'failed' → returns true.
        mocks.mockRunTransaction.mockImplementationOnce(async (cb) => {
            const snapData: Record<string, unknown> = { status: 'completed' };
            const tx = {
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    get: (field: string) => snapData[field],
                }),
                set: mocks.mockSet,
                update: mocks.mockUpdate,
            };
            return cb(tx);
        });

        const { req, res, jsonFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(jsonFn).toHaveBeenCalledWith({ received: true, duplicate: true });
    });

    // ── checkout.session.completed — Subscription ────────────────────────────

    it('should handle checkout.session.completed for a subscription', async () => {
        const session: Partial<Stripe.Checkout.Session> = {
            id: 'cs_sub_001',
            customer: 'cus_stripe_001',
            subscription: 'sub_001',
            metadata: { userId: 'user-123', tier: 'pro_monthly' },
        };
        const event: Partial<Stripe.Event> = {
            id: 'evt_checkout_sub',
            type: 'checkout.session.completed',
            data: { object: session as Stripe.Checkout.Session },
        };
        mocks.mockConstructEvent.mockReturnValue(event);
        mocks.mockRetrieve.mockResolvedValue({
            id: 'sub_001',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1700086400,
            cancel_at_period_end: false,
        });

        const { req, res, jsonFn, statusFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(statusFn).not.toHaveBeenCalled();
        expect(jsonFn).toHaveBeenCalledWith({ received: true });
        // Subscription doc should be written to Firestore
        expect(mocks.mockDb.collection).toHaveBeenCalledWith('subscriptions');
    });

    // ── customer.subscription.created ────────────────────────────────────────

    it('should handle customer.subscription.created', async () => {
        const subscription = {
            id: 'sub_created',
            customer: 'cus_stripe_001',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1700086400,
            cancel_at_period_end: false,
            items: {
                data: [{
                    price: {
                        product: 'prod_pro',
                        recurring: { interval: 'month' },
                    },
                }],
            },
        };
        const event: Partial<Stripe.Event> = {
            id: 'evt_sub_created',
            type: 'customer.subscription.created',
            data: { object: subscription as unknown as Stripe.Subscription },
        };
        mocks.mockConstructEvent.mockReturnValue(event);

        const { req, res, jsonFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(jsonFn).toHaveBeenCalledWith({ received: true });
        expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    // ── customer.subscription.updated ────────────────────────────────────────

    it('should handle customer.subscription.updated', async () => {
        const subscription = {
            id: 'sub_updated',
            customer: 'cus_stripe_001',
            status: 'active',
            current_period_start: 1700000000,
            current_period_end: 1702678400,
            cancel_at_period_end: false,
            items: {
                data: [{
                    price: {
                        product: 'prod_studio',
                        recurring: { interval: 'month' },
                    },
                }],
            },
        };
        const event: Partial<Stripe.Event> = {
            id: 'evt_sub_updated',
            type: 'customer.subscription.updated',
            data: { object: subscription as unknown as Stripe.Subscription },
        };
        mocks.mockConstructEvent.mockReturnValue(event);

        const { req, res, jsonFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(jsonFn).toHaveBeenCalledWith({ received: true });
        expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    // ── customer.subscription.deleted ────────────────────────────────────────

    it('should handle customer.subscription.deleted — downgrades to free', async () => {
        const subscription = {
            id: 'sub_deleted',
            customer: 'cus_stripe_001',
        };
        const event: Partial<Stripe.Event> = {
            id: 'evt_sub_deleted',
            type: 'customer.subscription.deleted',
            data: { object: subscription as unknown as Stripe.Subscription },
        };
        mocks.mockConstructEvent.mockReturnValue(event);

        const { req, res, jsonFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(jsonFn).toHaveBeenCalledWith({ received: true });
        // Should update to FREE tier — tx.update(docRef, data) is two args
        expect(mocks.mockUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ tier: 'free' })
        );
    });

    // ── invoice.paid ─────────────────────────────────────────────────────────

    it('should handle invoice.paid and write ledger entry', async () => {
        const invoice = {
            id: 'in_paid_001',
            customer: 'cus_stripe_001',
            total: 1999,
            currency: 'usd',
            number: 'INV-001',
            invoice_pdf: 'https://stripe.com/invoice.pdf',
            period_start: 1700000000,
            period_end: 1702678400,
            subscription: 'sub_001',
            customer_email: 'test@test.com',
            attempt_count: 1,
        };
        const event: Partial<Stripe.Event> = {
            id: 'evt_invoice_paid',
            type: 'invoice.paid',
            data: { object: invoice as unknown as Stripe.Invoice },
        };
        mocks.mockConstructEvent.mockReturnValue(event);
        mocks.mockRetrieve.mockResolvedValue({
            id: 'sub_001',
            current_period_end: 1702678400,
        });

        const { req, res, jsonFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(jsonFn).toHaveBeenCalledWith({ received: true });
        // Ledger write must target users/{userId}/ledger
        expect(mocks.mockDb.collection).toHaveBeenCalledWith('users/user-123/ledger');
        expect(mocks.mockAdd).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'subscription_payment',
                invoiceId: 'in_paid_001',
                amount: 1999,
                currency: 'usd',
            })
        );
    });

    // ── invoice.payment_failed ────────────────────────────────────────────────

    it('should handle invoice.payment_failed and queue dunning notification', async () => {
        const invoice = {
            id: 'in_failed_001',
            customer: 'cus_stripe_001',
            total: 1999,
            currency: 'usd',
            customer_email: 'test@test.com',
            attempt_count: 2,
            next_payment_attempt: 1700172800,
        };
        const event: Partial<Stripe.Event> = {
            id: 'evt_invoice_failed',
            type: 'invoice.payment_failed',
            data: { object: invoice as unknown as Stripe.Invoice },
        };
        mocks.mockConstructEvent.mockReturnValue(event);

        const { req, res, jsonFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(jsonFn).toHaveBeenCalledWith({ received: true });
        // Subscription should be marked past_due — tx.update(docRef, data) is two args
        expect(mocks.mockUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ status: 'past_due' })
        );
        // Dunning record must target dunning_notifications collection
        expect(mocks.mockDb.collection).toHaveBeenCalledWith('dunning_notifications');
        expect(mocks.mockAdd).toHaveBeenCalledWith(
            expect.objectContaining({
                invoiceId: 'in_failed_001',
                status: 'pending',
            })
        );
    });

    // ── checkout.session.completed — Licensing Purchase ───────────────────────

    it('should handle checkout.session.completed for a licensing purchase', async () => {
        const session: Partial<Stripe.Checkout.Session> = {
            id: 'cs_lic_001',
            metadata: {
                userId: 'user-123',
                type: 'licensing_purchase',
                connectedAccountId: 'acct_123456',
                artistAmount: '1000000',
                trackTitle: 'Midnight Blaze',
                artist: 'The Flames',
            },
        };
        const event: Partial<Stripe.Event> = {
            id: 'evt_checkout_lic',
            type: 'checkout.session.completed',
            data: { object: session as Stripe.Checkout.Session },
        };
        mocks.mockConstructEvent.mockReturnValue(event);

        const { req, res, jsonFn, statusFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(statusFn).not.toHaveBeenCalled();
        expect(jsonFn).toHaveBeenCalledWith({ received: true });

        // Verify Stripe transfer was created
        expect(mocks.mockTransferCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 1000000,
                currency: 'usd',
                destination: 'acct_123456',
            })
        );

        // Verify active license was recorded in Firestore
        expect(mocks.mockDb.collection).toHaveBeenCalledWith('licenses');
        expect(mocks.mockAdd).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-123',
                title: 'Midnight Blaze',
                artist: 'The Flames',
                licenseType: 'sync',
                status: 'active',
                amount: 1000000,
            })
        );

        // Verify transaction log in user's ledger
        expect(mocks.mockDb.collection).toHaveBeenCalledWith('users/user-123/ledger');
        expect(mocks.mockAdd).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'sync_license_sale',
                amount: 1000000,
                status: 'paid',
            })
        );
    });

    // ── Unknown event type ────────────────────────────────────────────────────

    it('should handle unknown event types gracefully (200 received:true)', async () => {
        const event = {
            id: 'evt_unknown',
            type: 'payment_intent.created',
        } as unknown as Stripe.Event;
        mocks.mockConstructEvent.mockReturnValue(event);

        const { req, res, jsonFn, statusFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(statusFn).not.toHaveBeenCalled();
        expect(jsonFn).toHaveBeenCalledWith({ received: true, status: 'unhandled_event', type: 'payment_intent.created' });
    });

    // ── checkout.session.completed — Marketplace Purchase (ISSUE-977/978) ────

    it('should finalize a marketplace purchase as a durable sale without touching inventory again', async () => {
        const session: Partial<Stripe.Checkout.Session> = {
            id: 'cs_mkt_001',
            metadata: {
                type: 'marketplace_purchase',
                reservationId: 'res-1',
                productId: 'prod-1',
                buyerId: 'buyer-1',
                sellerId: 'seller-1',
            },
        };
        const event: Partial<Stripe.Event> = {
            id: 'evt_checkout_mkt',
            type: 'checkout.session.completed',
            data: { object: session as Stripe.Checkout.Session },
        };
        mocks.mockConstructEvent.mockReturnValue(event);

        // Call 1: outer webhook idempotency check (not yet processed).
        // Call 2: handleMarketplacePurchaseCompleted's own transaction, reading the reservation.
        mocks.mockRunTransaction
            .mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb({
                get: vi.fn().mockResolvedValue(mocks.makeSnap(false)),
                set: mocks.mockSet,
                update: mocks.mockUpdate,
            }))
            .mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb({
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({
                        status: 'reserved',
                        buyerId: 'buyer-1',
                        sellerId: 'seller-1',
                        productId: 'prod-1',
                        productTitle: 'Beat Pack',
                        priceCents: 999,
                        currency: 'USD',
                        source: 'direct',
                    }),
                }),
                set: mocks.mockSet,
                update: mocks.mockUpdate,
            }));

        const { req, res, jsonFn, statusFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(statusFn).not.toHaveBeenCalled();
        expect(jsonFn).toHaveBeenCalledWith({ received: true });

        // A durable purchase record, keyed by the Stripe session id (idempotency key).
        expect(mocks.mockDb.collection).toHaveBeenCalledWith('purchases');
        expect(mocks.mockSet).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ status: 'completed', amount: 999, productId: 'prod-1', transactionId: 'cs_mkt_001' }),
            { merge: true }
        );

        // Revenue is recorded only now — after Stripe confirmed payment.
        expect(mocks.mockDb.collection).toHaveBeenCalledWith('revenue');
        expect(mocks.mockSet).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ userId: 'seller-1', amount: 999, status: 'completed' })
        );

        // The reservation transitions to completed; inventory is never touched here again
        // (it was already decremented atomically at reservation time).
        expect(mocks.mockUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ status: 'completed' })
        );
        expect(mocks.mockUpdate).not.toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ inventory: expect.anything() })
        );
    });

    it('should release the inventory reservation when a marketplace checkout session expires unpaid', async () => {
        const session: Partial<Stripe.Checkout.Session> = {
            id: 'cs_mkt_expired',
            metadata: {
                type: 'marketplace_purchase',
                reservationId: 'res-2',
                productId: 'prod-2',
                buyerId: 'buyer-1',
                sellerId: 'seller-1',
            },
        };
        const event: Partial<Stripe.Event> = {
            id: 'evt_checkout_expired',
            type: 'checkout.session.expired',
            data: { object: session as Stripe.Checkout.Session },
        };
        mocks.mockConstructEvent.mockReturnValue(event);

        // Call 1: outer webhook idempotency check (not yet processed) — runs for every event type.
        // Call 2: handleMarketplaceCheckoutExpired's own transaction, releasing the reservation.
        mocks.mockRunTransaction
            .mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb({
                get: vi.fn().mockResolvedValue(mocks.makeSnap(false)),
                set: mocks.mockSet,
                update: mocks.mockUpdate,
            }))
            .mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb({
                get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({ status: 'reserved', hasInventoryTracking: true }),
                }),
                set: mocks.mockSet,
                update: mocks.mockUpdate,
            }));

        const { req, res, jsonFn, statusFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(statusFn).not.toHaveBeenCalled();
        expect(jsonFn).toHaveBeenCalledWith({ received: true });

        expect(mocks.mockUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ inventory: 1 }) // FieldValue.increment(1) mocked as identity passthrough of n
        );
        expect(mocks.mockUpdate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ status: 'released', releasedReason: 'checkout_expired' })
        );
    });
});
