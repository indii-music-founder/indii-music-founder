import { beforeEach, describe, expect, it, vi } from 'vitest';

const { accountsRetrieveMock } = vi.hoisted(() => ({ accountsRetrieveMock: vi.fn() }));
vi.mock('../../../stripe/config.js', () => ({
    stripe: {
        accounts: {
            retrieve: accountsRetrieveMock,
        },
    },
}));

vi.mock('firebase-admin');

import { stageStripePayouts } from '../stageStripePayouts.js';
import { McpContext } from '../../types.js';
import * as admin from 'firebase-admin';
import { textContent } from './mcpContent';

const earningsGetMock = vi.fn();
const balancesGetMock = vi.fn();
const splitsGetMock = vi.fn();
const ledgerGetMock = vi.fn();
const ledgerLimitMock = vi.fn(() => ({ get: ledgerGetMock }));
const userGetMock = vi.fn();
const payoutJobsAddMock = vi.fn();
const payoutBatchesAddMock = vi.fn();

const firestoreFn = vi.fn(() => ({
    collection: (name: string) => {
        if (name === 'earnings') return { where: () => ({ get: earningsGetMock }) };
        if (name === 'recoupment_balances') return { where: () => ({ get: balancesGetMock }) };
        if (name === 'payoutJobs') return { add: payoutJobsAddMock };
        if (name === 'payoutBatches') return { add: payoutBatchesAddMock };
        if (name === 'users') {
            return {
                doc: () => ({
                    collection: (sub: string) => {
                        if (sub === 'splits') return { limit: () => ({ get: splitsGetMock }) };
                        if (sub === 'admin_ledger') return { limit: ledgerLimitMock };
                        throw new Error(`unexpected subcollection ${sub}`);
                    },
                    get: userGetMock,
                }),
            };
        }
        throw new Error(`unexpected collection ${name}`);
    },
})) as any;

firestoreFn.FieldValue = { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') };
vi.mocked(admin.firestore).mockImplementation(firestoreFn);
vi.mocked(admin.firestore).FieldValue = firestoreFn.FieldValue;

// `McpContext.user` is a full `DecodedIdToken`; the tool under test reads only
// `uid`/`admin`, so the fixture intentionally supplies just those two. Matches
// the `as never` convention used by the other mcp/tools test doubles.
const context = (uid: string, isAdmin = false): McpContext => ({ user: { uid, admin: isAdmin } as never });

/** A schema-valid, create-only admin ledger receipt as masterIngestionRunbook writes it. */
function ledgerReceipt(input: { id: string; isrc: string; recording: [string, number][]; lockedAt?: string }) {
    const holders = new Set(input.recording.map(([name]) => name));
    return {
        id: input.id,
        userId: 'user-1',
        schemaVersion: 'admin-ledger-receipt.v1',
        masterHash: 'a'.repeat(64),
        storageGeneration: '1700000000000000',
        splits: {
            recording: input.recording.map(([collaboratorId, shareBasisUnits]) => ({ collaboratorId, shareBasisUnits })),
            publishing: [{ collaboratorId: input.recording[0][0], shareBasisUnits: 1_000_000 }],
        },
        signatories: [...holders].map((collaboratorId) => ({
            collaboratorId,
            method: 'split-invitation@v1',
            signedAt: '2026-02-01T00:00:00.000Z',
            receiptHash: 'b'.repeat(64),
        })),
        identifiers: { isrc: input.isrc },
        lockedAt: input.lockedAt ?? '2026-02-01T00:00:00.000Z',
    };
}

const ledgerDocs = (...receipts: Record<string, unknown>[]) => ({
    docs: receipts.map((receipt) => ({ id: String(receipt.id), data: () => receipt })),
});

const marchEarning = (id: string, netRevenueMicros: number, isrc?: string) => ({
    id,
    data: () => ({ netRevenueMicros, isrc, period: { startDate: '2026-03-01', endDate: '2026-03-31' } }),
});

const verifiedAccount = {
    payouts_enabled: true,
    charges_enabled: true,
    capabilities: { transfers: 'active' },
};

describe('stageStripePayouts MCP tool', () => {
    beforeEach(() => {
        earningsGetMock.mockReset();
        balancesGetMock.mockReset();
        splitsGetMock.mockReset();
        userGetMock.mockReset();
        payoutJobsAddMock.mockReset().mockResolvedValue({ id: 'job-1' });
        payoutBatchesAddMock.mockReset().mockResolvedValue({ id: 'batch-1' });
        accountsRetrieveMock.mockReset();
        balancesGetMock.mockResolvedValue({ docs: [] });
        splitsGetMock.mockResolvedValue({ empty: true, docs: [] });
        ledgerGetMock.mockReset().mockResolvedValue({ docs: [] });
        ledgerLimitMock.mockClear();
    });

    it('stages a verified single-recipient payout batch when caller has no splits subcollection', async () => {
        earningsGetMock.mockResolvedValue({
            docs: [
                { id: 'e1', data: () => ({ netRevenueMicros: 10_000_000, period: { startDate: '2026-03-01', endDate: '2026-03-31' } }) },
            ],
        });
        userGetMock.mockResolvedValue({ exists: true, data: () => ({ stripeAccountId: 'acct_artist' }) });
        accountsRetrieveMock.mockResolvedValue(verifiedAccount);

        const result = await stageStripePayouts.handler(
            { artistId: 'user-1', payoutPeriod: '2026-03' },
            context('user-1'),
        );
        const payload = JSON.parse(textContent(result));

        expect(result.isError).toBeUndefined();
        expect(payload.status).toBe('succeeded');
        expect(payload.data.status).toBe('staged_pending_approval');
        expect(payload.data.stagedNetMicros).toBe(10_000_000);
        expect(payload.data.recipients).toEqual([
            { uid: 'user-1', percentage: 100, amountMicros: 10_000_000, stripeAccountId: 'acct_artist', accountStatus: 'verified' },
        ]);

        // Stripe was actually called to verify the account
        expect(accountsRetrieveMock).toHaveBeenCalledWith('acct_artist');

        // No money moved — only account verification + Firestore writes
        expect(payload.warnings.join(' ')).toContain('NO Stripe transfer');
        expect(payload.warnings.join(' ')).toContain('No approval endpoint exists yet');

        // payoutBatches doc written with transfer group id
        expect(payoutBatchesAddMock).toHaveBeenCalledTimes(1);
        const batchWritten = payoutBatchesAddMock.mock.calls[0][0];
        expect(batchWritten.transferGroupId).toBe('payout_user-1_2026-03_job-1');
        expect(batchWritten.status).toBe('staged_pending_approval');
    });

    it('fails closed when unverified client-written split documents exist (ISSUE-1725)', async () => {
        earningsGetMock.mockResolvedValue({ docs: [marchEarning('e1', 100_000_000, 'USABC2600001')] });
        splitsGetMock.mockResolvedValue({
            empty: false,
            docs: [{ id: 'attacker', data: () => ({ percentage: 100, stripeAccountId: 'acct_attacker' }) }],
        });
        userGetMock.mockResolvedValue({ exists: true, data: () => ({ stripeAccountId: 'acct_artist' }) });
        accountsRetrieveMock.mockResolvedValue(verifiedAccount);

        const result = await stageStripePayouts.handler(
            { artistId: 'user-1', payoutPeriod: '2026-03' },
            context('user-1'),
        );
        const payload = JSON.parse(textContent(result));

        expect(result.isError).toBe(true);
        expect(payload.error.code).toBe('UNVERIFIED_SPLIT_DOCUMENTS');
        expect(payload.error.retryable).toBe(false);
        expect(payoutJobsAddMock).not.toHaveBeenCalled();
        expect(payoutBatchesAddMock).not.toHaveBeenCalled();
        expect(accountsRetrieveMock).not.toHaveBeenCalled();
    });

    it('holds multi-party locked splits, stages sole-holder and unreceipted ISRCs to the artist, and records what was held', async () => {
        earningsGetMock.mockResolvedValue({
            docs: [
                marchEarning('e-multi', 60_000_000, 'USABC2600001'),
                marchEarning('e-sole', 30_000_000, 'USABC2600002'),
                marchEarning('e-none', 10_000_000, 'USABC2600003'),
            ],
        });
        ledgerGetMock.mockResolvedValue(ledgerDocs(
            ledgerReceipt({ id: 'led_v1_aaaaaaaa01', isrc: 'USABC2600001', recording: [['Ada Writer', 600_000], ['Ben Producer', 400_000]] }),
            ledgerReceipt({ id: 'led_v1_aaaaaaaa02', isrc: 'USABC2600002', recording: [['Ada Writer', 1_000_000]] }),
        ));
        userGetMock.mockResolvedValue({ exists: true, data: () => ({ stripeAccountId: 'acct_artist' }) });
        accountsRetrieveMock.mockResolvedValue(verifiedAccount);

        const result = await stageStripePayouts.handler(
            { artistId: 'user-1', payoutPeriod: '2026-03' },
            context('user-1'),
        );
        const payload = JSON.parse(textContent(result));
        const warnings = payload.warnings.join(' ');

        expect(result.isError).toBeUndefined();
        expect(payload.data.stagedNetMicros).toBe(40_000_000);
        expect(payload.data.heldNetMicros).toBe(60_000_000);
        expect(payload.data.recipients).toEqual([
            { uid: 'user-1', percentage: 100, amountMicros: 40_000_000, stripeAccountId: 'acct_artist', accountStatus: 'verified' },
        ]);
        expect(warnings).toContain('HELD: 60000000 micros for ISRC USABC2600001');
        expect(warnings).toContain('No locked split receipt exists for 1 ISRC(s) (USABC2600003)');

        const batchWritten = payoutBatchesAddMock.mock.calls[0][0];
        expect(batchWritten.recipientSource).toBe('artist_sole');
        expect(batchWritten.heldNetMicros).toBe(60_000_000);
        expect(batchWritten.heldEarnings).toEqual([
            { isrc: 'USABC2600001', netMicros: 60_000_000, reason: 'multi_party_locked_split', ledgerReceiptId: 'led_v1_aaaaaaaa01' },
        ]);
        expect(batchWritten.ledgerReceiptIds).toEqual(['led_v1_aaaaaaaa02']);
    });

    it('matches a receipt whose ISRC is hyphenated or lower-case, so a multi-party split cannot slip through as unreceipted', async () => {
        earningsGetMock.mockResolvedValue({ docs: [marchEarning('e1', 50_000_000, 'USABC2600001')] });
        ledgerGetMock.mockResolvedValue(ledgerDocs(
            ledgerReceipt({ id: 'led_v1_aaaaaaaa03', isrc: 'us-abc-26-00001', recording: [['Ada Writer', 500_000], ['Ben Producer', 500_000]] }),
        ));

        const result = await stageStripePayouts.handler(
            { artistId: 'user-1', payoutPeriod: '2026-03' },
            context('user-1'),
        );
        const payload = JSON.parse(textContent(result));

        expect(payload.data.stagedNetMicros).toBe(0);
        expect(payload.data.heldNetMicros).toBe(50_000_000);
        expect(payload.warnings.join(' ')).toContain('All 50000000 micros of net earnings are held');
        expect(payoutJobsAddMock).not.toHaveBeenCalled();
        expect(payoutBatchesAddMock).not.toHaveBeenCalled();
    });

    it('holds earnings when the latest receipt for an ISRC fails validation, even if an older valid sole-holder receipt exists', async () => {
        earningsGetMock.mockResolvedValue({ docs: [marchEarning('e1', 20_000_000, 'USABC2600001'), marchEarning('e2', 5_000_000)] });
        const valid = ledgerReceipt({ id: 'led_v1_aaaaaaaa04', isrc: 'USABC2600001', recording: [['Ada Writer', 1_000_000]] });
        const corrupt = { ...ledgerReceipt({ id: 'led_v1_aaaaaaaa05', isrc: 'USABC2600001', recording: [['Ada Writer', 1_000_000]], lockedAt: '2026-01-01T00:00:00.000Z' }), splits: { recording: [], publishing: [] } };
        ledgerGetMock.mockResolvedValue(ledgerDocs(valid, corrupt));
        userGetMock.mockResolvedValue({ exists: true, data: () => ({ stripeAccountId: 'acct_artist' }) });
        accountsRetrieveMock.mockResolvedValue(verifiedAccount);

        const result = await stageStripePayouts.handler(
            { artistId: 'user-1', payoutPeriod: '2026-03' },
            context('user-1'),
        );
        const payload = JSON.parse(textContent(result));

        expect(payload.data.stagedNetMicros).toBe(5_000_000);
        expect(payload.data.heldEarnings).toEqual([
            { isrc: 'USABC2600001', netMicros: 20_000_000, reason: 'invalid_ledger_receipt', ledgerReceiptId: 'led_v1_aaaaaaaa05' },
        ]);
        expect(payload.warnings.join(' ')).toContain('1 earnings document(s) carry no ISRC');
    });

    it('fails closed with LEDGER_SCAN_LIMIT when the ledger is too large to check completely', async () => {
        earningsGetMock.mockResolvedValue({ docs: [marchEarning('e1', 10_000_000, 'USABC2600001')] });
        ledgerGetMock.mockResolvedValue({
            docs: Array.from({ length: 2001 }, (_, index) => ({ id: `led_${index}`, data: () => ({}) })),
        });

        const result = await stageStripePayouts.handler(
            { artistId: 'user-1', payoutPeriod: '2026-03' },
            context('user-1'),
        );
        const payload = JSON.parse(textContent(result));

        expect(result.isError).toBe(true);
        expect(payload.error.code).toBe('LEDGER_SCAN_LIMIT');
        expect(ledgerLimitMock).toHaveBeenCalledWith(2001);
        expect(payoutJobsAddMock).not.toHaveBeenCalled();
        expect(payoutBatchesAddMock).not.toHaveBeenCalled();
    });

    it('surfaces a missing Stripe account as a BLOCKING warning, not a silent skip', async () => {
        earningsGetMock.mockResolvedValue({
            docs: [{ id: 'e1', data: () => ({ netRevenueMicros: 5_000_000, period: { startDate: '2026-03-01', endDate: '2026-03-31' } }) }],
        });
        userGetMock.mockResolvedValue({ exists: true, data: () => ({}) }); // no stripeAccountId

        const result = await stageStripePayouts.handler(
            { artistId: 'user-1', payoutPeriod: '2026-03' },
            context('user-1'),
        );
        const payload = JSON.parse(textContent(result));

        expect(result.isError).toBeUndefined();
        expect(payload.data.status).toBe('blocked_no_verified_recipients');
        expect(payload.data.recipients[0].accountStatus).toBe('missing');
        expect(payload.warnings.join(' ')).toContain('BLOCKING: recipient user-1');
        expect(payload.warnings.join(' ')).toContain('No stripeAccountId on file');
        expect(accountsRetrieveMock).not.toHaveBeenCalled();
    });

    it('surfaces a Stripe-blocked account (not payouts_enabled) as a BLOCKING warning', async () => {
        earningsGetMock.mockResolvedValue({
            docs: [{ id: 'e1', data: () => ({ netRevenueMicros: 5_000_000, period: { startDate: '2026-03-01', endDate: '2026-03-31' } }) }],
        });
        userGetMock.mockResolvedValue({ exists: true, data: () => ({ stripeAccountId: 'acct_blocked' }) });
        accountsRetrieveMock.mockResolvedValue({ payouts_enabled: false, charges_enabled: true, capabilities: { transfers: 'active' } });

        const result = await stageStripePayouts.handler(
            { artistId: 'user-1', payoutPeriod: '2026-03' },
            context('user-1'),
        );
        const payload = JSON.parse(textContent(result));

        expect(payload.data.recipients[0].accountStatus).toBe('blocked');
        expect(payload.warnings.join(' ')).toContain('not payouts_enabled');
        expect(payload.data.status).toBe('blocked_no_verified_recipients');
    });

    it('never creates a Stripe transfer or payout — no stripe.transfers call exists in this tool', async () => {
        earningsGetMock.mockResolvedValue({
            docs: [{ id: 'e1', data: () => ({ netRevenueMicros: 5_000_000, period: { startDate: '2026-03-01', endDate: '2026-03-31' } }) }],
        });
        userGetMock.mockResolvedValue({ exists: true, data: () => ({ stripeAccountId: 'acct_artist' }) });
        accountsRetrieveMock.mockResolvedValue(verifiedAccount);

        await stageStripePayouts.handler({ artistId: 'user-1', payoutPeriod: '2026-03' }, context('user-1'));

        // Only accounts.retrieve was ever called on the stripe mock — no transfers/payouts methods exist on it.
        expect(accountsRetrieveMock).toHaveBeenCalled();
    });

    it('still fails closed with FORBIDDEN for cross-tenant artistId', async () => {
        const result = await stageStripePayouts.handler(
            { artistId: 'someone-else', payoutPeriod: '2026-03' },
            context('user-1'),
        );
        const payload = JSON.parse(textContent(result));
        expect(result.isError).toBe(true);
        expect(payload.error.code).toBe('FORBIDDEN');
        expect(payoutJobsAddMock).not.toHaveBeenCalled();
        expect(payoutBatchesAddMock).not.toHaveBeenCalled();
    });
});
