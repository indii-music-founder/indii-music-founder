import { beforeEach, describe, expect, it, vi } from 'vitest';

const balanceGetMock = vi.fn();
const earningsGetMock = vi.fn();
const whereMock = vi.fn();
const docMock = vi.fn(() => ({ get: balanceGetMock }));
const collectionMock = vi.fn((collectionName: string) => {
    if (collectionName === 'recoupment_balances') return { doc: docMock };
    if (collectionName === 'earnings') return { where: whereMock };
    throw new Error(`Unexpected collection ${collectionName}`);
});

whereMock.mockReturnValue({ where: whereMock, get: earningsGetMock });

vi.mock('firebase-admin', () => ({
    firestore: vi.fn(() => ({ collection: collectionMock })),
}));

import { calculateRecoupment } from '../calculateRecoupment.js';
import { McpContext } from '../../types.js';

const context = (uid: string, admin = false): McpContext => ({
    user: { uid, admin } as never,
});

describe('calculateRecoupment MCP tool', () => {
    beforeEach(() => {
        balanceGetMock.mockReset();
        earningsGetMock.mockReset();
        docMock.mockClear();
        collectionMock.mockClear();
        whereMock.mockClear();
        whereMock.mockReturnValue({ where: whereMock, get: earningsGetMock });
    });

    it('calculates recoupment from Firestore ledgers instead of hardcoded figures', async () => {
        balanceGetMock.mockResolvedValueOnce({
            exists: true,
            data: () => ({
                balanceMicros: 2_500_000,
                totalExpenseMicros: 10_000_000,
                currency: 'USD',
            }),
        });
        earningsGetMock.mockResolvedValueOnce({
            docs: [
                { id: 'earn-1', data: () => ({ grossRevenueMicros: 4_000_000, netRevenueMicros: 3_000_000 }) },
                { id: 'earn-2', data: () => ({ grossRevenue: 2, netRevenue: 1.25 }) },
            ],
        });

        const result = await calculateRecoupment.handler({ releaseId: 'rel-1' }, context('user-1'));
        const payload = JSON.parse(result.content[0].text);

        expect(result.isError).toBeUndefined();
        expect(collectionMock).toHaveBeenCalledWith('recoupment_balances');
        expect(collectionMock).toHaveBeenCalledWith('earnings');
        expect(whereMock).toHaveBeenCalledWith('userId', '==', 'user-1');
        expect(whereMock).toHaveBeenCalledWith('releaseId', '==', 'rel-1');
        expect(payload).toMatchObject({
            artistId: 'user-1',
            releaseId: 'rel-1',
            currency: 'USD',
            grossRevenue: 6,
            netRevenue: 4.25,
            totalRecoupable: 10,
            recoupedToDate: 7.5,
            outstandingBalance: 2.5,
            projectedRemainingAfterCurrentEarnings: 0,
            isRecouped: false,
            earningsCount: 2,
            earningsIds: ['earn-1', 'earn-2'],
        });
    });

    it('denies cross-user calculations for non-admin callers before Firestore reads', async () => {
        const result = await calculateRecoupment.handler({ releaseId: 'rel-1', artistId: 'user-2' }, context('user-1'));

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Forbidden');
        expect(balanceGetMock).not.toHaveBeenCalled();
        expect(earningsGetMock).not.toHaveBeenCalled();
    });
});
