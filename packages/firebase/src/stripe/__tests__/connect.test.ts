import { describe, it, expect, vi, beforeEach } from 'vitest';
import functionsTest from 'firebase-functions-test';
import { createTransfer } from '../connect';

const testEnv = functionsTest();

const transfersCreate = vi.fn();

vi.mock('../config', () => ({
    stripe: {
        transfers: {
            get create() { return transfersCreate; },
        },
        accounts: { create: vi.fn(), retrieve: vi.fn() },
        accountLinks: { create: vi.fn() },
    },
}));

vi.mock('firebase-admin', () => {
    const dbMock = { collection: vi.fn(() => ({ doc: vi.fn(() => ({ get: vi.fn(), update: vi.fn(), set: vi.fn() })) })) };
    return {
        firestore: Object.assign(vi.fn(() => dbMock), {
            FieldValue: { serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP') },
        }),
    };
});

const adminAuth = { uid: 'admin-1', token: { admin: true } };

describe('createTransfer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        transfersCreate.mockResolvedValue({ id: 'tr_test_123' });
    });

    it('requires authentication', async () => {
        const wrapped = testEnv.wrap(createTransfer);
        await expect(wrapped({ data: { amount: 1000, destinationId: 'acct_1', payoutId: 'p1' } } as any))
            .rejects.toThrow('User must be signed in.');
    });

    it('requires admin privileges', async () => {
        const wrapped = testEnv.wrap(createTransfer);
        await expect(wrapped({
            data: { amount: 1000, destinationId: 'acct_1', payoutId: 'p1' },
            auth: { uid: 'user-1', token: {} },
        } as any)).rejects.toThrow('Insufficient privileges.');
    });

    // ISSUE-1287: this callable executes a REAL Stripe transfer. Without an
    // idempotency key a retry/double-click creates a duplicate real payout.
    it('refuses to move money without a payoutId to key idempotency on', async () => {
        const wrapped = testEnv.wrap(createTransfer);
        await expect(wrapped({
            data: { amount: 1000, destinationId: 'acct_1' },
            auth: adminAuth,
        } as any)).rejects.toThrow(/payoutId/);

        expect(transfersCreate).not.toHaveBeenCalled();
    });

    it('rejects a blank payoutId rather than sending an unkeyed transfer', async () => {
        const wrapped = testEnv.wrap(createTransfer);
        await expect(wrapped({
            data: { amount: 1000, destinationId: 'acct_1', payoutId: '   ' },
            auth: adminAuth,
        } as any)).rejects.toThrow(/payoutId/);

        expect(transfersCreate).not.toHaveBeenCalled();
    });

    it('passes a stable idempotency key derived from the payout id', async () => {
        const wrapped = testEnv.wrap(createTransfer);
        const result = await wrapped({
            data: { amount: 2500, destinationId: 'acct_artist', payoutId: 'batch_2026_07' },
            auth: adminAuth,
        } as any);

        expect(result).toEqual({ transferId: 'tr_test_123' });
        expect(transfersCreate).toHaveBeenCalledTimes(1);

        const [params, options] = transfersCreate.mock.calls[0];
        expect(params).toMatchObject({ amount: 2500, currency: 'usd', destination: 'acct_artist' });
        expect(options).toEqual({ idempotencyKey: 'transfer_batch_2026_07' });
    });

    it('derives the same key for a retry of the same payout, and a different key for a different payout', async () => {
        const wrapped = testEnv.wrap(createTransfer);
        const call = (payoutId: string) => wrapped({
            data: { amount: 2500, destinationId: 'acct_artist', payoutId },
            auth: adminAuth,
        } as any);

        await call('batch_A');
        await call('batch_A');
        await call('batch_B');

        const keys = transfersCreate.mock.calls.map(([, opts]) => opts.idempotencyKey);
        // Same payout retried -> same key (Stripe dedupes). Different payout -> different
        // key, so two legitimate same-amount payouts are never collapsed into one.
        expect(keys[0]).toBe(keys[1]);
        expect(keys[2]).not.toBe(keys[0]);
    });
});
