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
                    collection: () => ({ get: splitsGetMock }),
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

    it('splits across multiple recipients by percentage using the splits subcollection', async () => {
        earningsGetMock.mockResolvedValue({
            docs: [
                { id: 'e1', data: () => ({ netRevenueMicros: 100_000_000, period: { startDate: '2026-03-01', endDate: '2026-03-31' } }) },
            ],
        });
        splitsGetMock.mockResolvedValue({
            empty: false,
            docs: [
                { id: 'writer-a', data: () => ({ percentage: 60, stripeAccountId: 'acct_a' }) },
                { id: 'writer-b', data: () => ({ percentage: 40, stripeAccountId: 'acct_b' }) },
            ],
        });
        accountsRetrieveMock.mockResolvedValue(verifiedAccount);

        const result = await stageStripePayouts.handler(
            { artistId: 'user-1', payoutPeriod: '2026-03' },
            context('user-1'),
        );
        const payload = JSON.parse(textContent(result));

        expect(result.isError).toBeUndefined();
        expect(payload.data.recipients).toEqual([
            { uid: 'writer-a', percentage: 60, amountMicros: 60_000_000, stripeAccountId: 'acct_a', accountStatus: 'verified' },
            { uid: 'writer-b', percentage: 40, amountMicros: 40_000_000, stripeAccountId: 'acct_b', accountStatus: 'verified' },
        ]);
        expect(accountsRetrieveMock).toHaveBeenCalledWith('acct_a');
        expect(accountsRetrieveMock).toHaveBeenCalledWith('acct_b');
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
