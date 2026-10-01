import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    ingestCallable: vi.fn(),
    allocationCallable: vi.fn(),
    httpsCallable: vi.fn(),
    auth: { currentUser: { uid: 'user-1' } as { uid: string } | null },
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: mocks.httpsCallable,
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    functions: { project: 'test' },
}));

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { dsrUploadService } from './EarningsUploadService';

function makeFile(): File {
    return {
        name: 'earnings.tsv',
        size: 6,
        arrayBuffer: async () => new TextEncoder().encode('report').buffer,
    } as File;
}

describe('EarningsReportUploadService.processAndSaveStatement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.currentUser = { uid: 'user-1' };
        mocks.httpsCallable.mockImplementation((_functions, name) =>
            name === 'calculateRoyaltyAllocations' ? mocks.allocationCallable : mocks.ingestCallable
        );
    });

    it('delegates all ledger writes to the authenticated backend callable', async () => {
        mocks.ingestCallable.mockResolvedValue({
            data: {
                success: true,
                batchId: 'dsr-stable',
                totalRevenue: 12.5,
                transactionCount: 1,
                matchedReleases: 1,
                unmatchedISRCs: [],
                alreadyProcessed: false,
            },
        });
        mocks.allocationCallable.mockResolvedValue({
            data: {
                success: true,
                batchId: 'dsr-stable',
                processedEarnings: 1,
                alreadyProcessedEarnings: 0,
                heldPayouts: 2,
                blockedEarnings: 0,
            },
        });
        const file = makeFile();

        const result = await dsrUploadService.processAndSaveStatement(file);

        expect(mocks.httpsCallable).toHaveBeenCalledWith(
            expect.anything(),
            'parseAndIngestRoyaltyReport'
        );
        expect(mocks.ingestCallable).toHaveBeenCalledWith({ fileName: 'earnings.tsv', contentBase64: 'cmVwb3J0' });
        expect(mocks.allocationCallable).toHaveBeenCalledWith({ batchId: 'dsr-stable' });
        expect(result).toEqual(expect.objectContaining({
            success: true,
            batchId: 'dsr-stable',
            matchedReleases: 1,
            allocation: expect.objectContaining({
                heldPayouts: 2,
                blockedEarnings: 0,
            }),
        }));
    });

    it('returns a failure when the backend rejects reconciliation', async () => {
        mocks.ingestCallable.mockRejectedValue(new Error('totalRevenue does not reconcile'));

        const result = await dsrUploadService.processAndSaveStatement(makeFile());

        expect(result.success).toBe(false);
        expect(result.error).toContain('does not reconcile');
    });

    it('refuses to submit without an authenticated user', async () => {
        mocks.auth.currentUser = null;

        const result = await dsrUploadService.processAndSaveStatement(makeFile());

        expect(result.success).toBe(false);
        expect(result.error).toContain('not authenticated');
        expect(mocks.ingestCallable).not.toHaveBeenCalled();
        expect(mocks.allocationCallable).not.toHaveBeenCalled();
    });
});
