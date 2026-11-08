import { describe, it, expect, vi, beforeEach } from 'vitest';
import functionsTest from 'firebase-functions-test';
import { initiateSplitEscrow, signEscrow, releaseEscrow } from '../splitEscrow';
import { stripe } from '../config';
import * as admin from 'firebase-admin';

const testEnv = functionsTest();

// Mock Stripe config
vi.mock('../config', () => ({
    stripe: {
        paymentIntents: {
            create: vi.fn(),
            retrieve: vi.fn(),
            capture: vi.fn(),
        },
        transfers: {
            create: vi.fn(),
        },
    },
}));

// Mock Firebase Admin
vi.mock('firebase-admin', () => {
    const mockRunTransaction = vi.fn((cb) => {
        return cb({
            get: vi.fn(),
            update: vi.fn(),
        });
    });

    const docMock = {
        get: vi.fn(),
        update: vi.fn(),
    };

    const addMock = vi.fn().mockResolvedValue({ id: 'escrow_doc_123' });
    const collectionMock = {
        add: addMock,
        doc: vi.fn(() => docMock),
    };

    const dbMock = {
        collection: vi.fn(() => collectionMock),
        runTransaction: mockRunTransaction,
    };

    const fieldValueMock = {
        serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
    };

    return {
        firestore: Object.assign(vi.fn(() => dbMock), { FieldValue: fieldValueMock }),
    };
});

describe('Split Escrow Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.STRIPE_PLATFORM_ACCOUNT_ID = 'acct_12345';
    });

    describe('initiateSplitEscrow', () => {
        it('should require authentication', async () => {
            const wrapped = testEnv.wrap(initiateSplitEscrow);
            await expect(wrapped({ data: { trackId: '123', holdAmount: 1000, parties: ['user1'] } } as any))
                .rejects.toThrow('User must be signed in.');
        });

        it('should validate inputs', async () => {
            const wrapped = testEnv.wrap(initiateSplitEscrow);
            await expect(wrapped({ data: { holdAmount: 1000, parties: ['user1'] }, auth: { uid: 'user1' } } as any))
                .rejects.toThrow('trackId, holdAmount (positive integer cents), and non-empty parties array are required.');
        });

        it('rejects non-integer holdAmount values (e.g. fractional cents)', async () => {
            const wrapped = testEnv.wrap(initiateSplitEscrow);
            await expect(wrapped({
                data: { trackId: 'track_1', holdAmount: 100.5, parties: ['user1'] },
                auth: { uid: 'user1', token: { email_verified: true } },
            } as any)).rejects.toThrow('trackId, holdAmount (positive integer cents), and non-empty parties array are required.');
        });

        it('creates an escrow awaiting funding with clientSecret when payment intent is unconfirmed', async () => {
            vi.mocked(stripe.paymentIntents.create).mockResolvedValueOnce({
                id: 'pi_unconfirmed_123',
                client_secret: 'pi_secret_xyz',
                status: 'requires_payment_method',
            } as any);

            const wrapped = testEnv.wrap(initiateSplitEscrow);
            const res = await wrapped({
                data: { trackId: 'track_1', holdAmount: 5000, parties: ['user1', 'user2'] },
                auth: { uid: 'user1', token: { email_verified: true } },
            } as any);

            expect(res).toMatchObject({
                escrowDocId: 'escrow_doc_123',
                fundsHeld: false,
                status: 'AWAITING_FUNDING',
                stripePaymentIntentId: 'pi_unconfirmed_123',
                clientSecret: 'pi_secret_xyz',
                amountCents: 5000,
            });

            const db = admin.firestore();
            expect(db.collection).toHaveBeenCalledWith('split_escrows');
            expect(db.collection('split_escrows').add).toHaveBeenCalledWith(expect.objectContaining({
                trackId: 'track_1',
                holdAmountCents: 5000,
                status: 'AWAITING_FUNDING',
                fundsHeld: false,
                stripePaymentIntentId: 'pi_unconfirmed_123',
            }));
        });

        it('creates an escrow with fundsHeld: true when payment intent status is requires_capture', async () => {
            vi.mocked(stripe.paymentIntents.create).mockResolvedValueOnce({
                id: 'pi_confirmed_123',
                client_secret: 'pi_secret_abc',
                status: 'requires_capture',
            } as any);

            const wrapped = testEnv.wrap(initiateSplitEscrow);
            const res = await wrapped({
                data: {
                    trackId: 'track_1',
                    holdAmount: 5000,
                    parties: ['user1', 'user2'],
                    paymentMethodId: 'pm_card_visa',
                    confirm: true,
                },
                auth: { uid: 'user1', token: { email_verified: true } },
            } as any);

            expect(res).toMatchObject({
                escrowDocId: 'escrow_doc_123',
                fundsHeld: true,
                status: 'PENDING_SIGNATURES',
                stripePaymentIntentId: 'pi_confirmed_123',
                clientSecret: 'pi_secret_abc',
                amountCents: 5000,
            });

            expect(stripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
                amount: 5000,
                payment_method: 'pm_card_visa',
                confirm: true,
                capture_method: 'manual',
            }));
        });
    });

    describe('signEscrow', () => {
        it('should require authentication', async () => {
            const wrapped = testEnv.wrap(signEscrow);
            await expect(wrapped({ data: { escrowDocId: 'escrow123' } } as any))
                .rejects.toThrow('User must be signed in.');
        });

        it('transitions AWAITING_FUNDING escrow to PENDING_SIGNATURES if intent is confirmed', async () => {
            vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValueOnce({
                id: 'pi_123',
                status: 'requires_capture',
            } as any);

            const db = admin.firestore();
            const mockUpdate = vi.fn();
            vi.mocked(db.runTransaction).mockImplementationOnce(async (cb) => {
                return cb({
                    get: vi.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            status: 'AWAITING_FUNDING',
                            parties: ['user1', 'user2'],
                            signoffs: { user1: false, user2: false },
                            stripePaymentIntentId: 'pi_123',
                        }),
                    }),
                    update: mockUpdate,
                } as any);
            });

            const wrapped = testEnv.wrap(signEscrow);
            const res = await wrapped({
                data: { escrowDocId: 'escrow123' },
                auth: { uid: 'user1', token: { email_verified: true } },
            } as any);

            expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_123');
            expect(res.status).toBe('PENDING_SIGNATURES');
            expect(mockUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                fundsHeld: true,
                status: 'PENDING_SIGNATURES',
            }));
        });
    });

    describe('releaseEscrow', () => {
        it('should require authentication', async () => {
            const wrapped = testEnv.wrap(releaseEscrow);
            await expect(wrapped({ data: { escrowDocId: 'escrow123' } } as any))
                .rejects.toThrow('User must be signed in.');
        });
    });
});
