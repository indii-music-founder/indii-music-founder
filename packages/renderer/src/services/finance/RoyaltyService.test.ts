import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    callable: vi.fn(),
    httpsCallable: vi.fn(),
}));

vi.mock('firebase/functions', () => ({ httpsCallable: mocks.httpsCallable }));
vi.mock('@/services/firebase', () => ({ functions: { project: 'test' } }));

import { RoyaltyService } from './RoyaltyService';

describe('RoyaltyService server-owned compatibility boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.httpsCallable.mockReturnValue(mocks.callable);
    });

    it('delegates allocation to the authenticated backend using a durable DSR receipt id', async () => {
        mocks.callable.mockResolvedValue({
            data: {
                success: true,
                processedEarnings: 2,
                alreadyProcessedEarnings: 0,
                heldPayouts: 3,
                blockedEarnings: 1,
            },
        });

        const result = await RoyaltyService.ingestRevenueReport('dsr-stable', [], {});

        expect(mocks.httpsCallable).toHaveBeenCalledWith(
            expect.anything(),
            'calculateRoyaltyAllocations'
        );
        expect(mocks.callable).toHaveBeenCalledWith({ batchId: 'dsr-stable' });
        expect(result).toEqual(expect.objectContaining({
            success: true,
            payoutCount: 3,
            processedGroups: 2,
            error: expect.stringContaining('require split or adjustment review'),
        }));
    });

    it('refuses an unidentified client report before calling the backend', async () => {
        const result = await RoyaltyService.ingestRevenueReport('  ', [], {});

        expect(result.success).toBe(false);
        expect(result.error).toContain('batchId');
        expect(mocks.callable).not.toHaveBeenCalled();
    });

    it('delegates recoupment configuration to the audited backend instead of mutating Firestore', async () => {
        mocks.callable.mockResolvedValue({ data: { success: true } });

        await RoyaltyService.setRecoupmentBalance('track-1', 100);

        expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'setRecoupmentBalance');
        expect(mocks.callable).toHaveBeenCalledWith(expect.objectContaining({
            trackId: 'track-1',
            amount: 100,
            requestId: expect.any(String),
        }));
    });
});
