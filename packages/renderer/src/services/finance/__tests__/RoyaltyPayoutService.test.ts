import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    auth: { currentUser: { uid: 'owner-1' } as { uid: string } | null },
}));

vi.mock('firebase/firestore', () => ({
    collection: mocks.collection,
    getDocs: mocks.getDocs,
    query: mocks.query,
    where: mocks.where,
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    db: { project: 'test' },
}));

import { RoyaltyPayoutService } from '../RoyaltyPayoutService';

describe('RoyaltyPayoutService backend boundary', () => {
    let service: RoyaltyPayoutService;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.currentUser = { uid: 'owner-1' };
        mocks.collection.mockReturnValue({ path: 'payouts' });
        mocks.where.mockReturnValue({ field: 'userId', value: 'owner-1' });
        mocks.query.mockReturnValue({ constrained: true });
        service = new RoyaltyPayoutService();
    });

    it('never lets the renderer create or finalize payout obligations', async () => {
        await expect(service.createPayout({
            artistId: 'artist-1',
            artistName: 'Artist',
            amount: 100,
            currency: 'USD',
            period: '2026-Q1',
            method: 'stripe',
        })).rejects.toThrow(/server-owned/);
        await expect(service.finalizePayout('payout-1')).rejects.toThrow(/server-owned/);
    });

    it('reads only the authenticated owner ledger and filters held obligations by period', async () => {
        mocks.getDocs.mockResolvedValue({
            forEach: (callback: (document: any) => void) => [
                { id: 'held', data: () => ({ period: '2026-Q1', status: 'held_for_reconciliation', amount: 100 }) },
                { id: 'other-period', data: () => ({ period: '2026-Q2', status: 'held_for_reconciliation', amount: 200 }) },
                { id: 'paid', data: () => ({ period: '2026-Q1', status: 'processed', amount: 300 }) },
            ].forEach(callback),
        });

        const result = await service.getPendingForPeriod('2026-Q1');

        expect(mocks.collection).toHaveBeenCalledWith(expect.anything(), 'payouts');
        expect(mocks.where).toHaveBeenCalledWith('userId', '==', 'owner-1');
        expect(result).toEqual([expect.objectContaining({ id: 'held', amount: 100 })]);
    });

    it('exports RFC-style escaped CSV values without changing ledger state', async () => {
        const csv = await service.generateCsv([{
            id: 'payout-1',
            artistId: 'artist-1',
            artistName: 'Artist "One"',
            amount: 100,
            currency: 'USD',
            method: 'wire',
            period: '2026-Q1',
            status: 'held_for_reconciliation',
        }]);

        expect(csv).toContain('"Artist ""One"""');
    });
});
