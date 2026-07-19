import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EarningsReportReport } from './types/dsr';

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

function makeReport(): EarningsReportReport {
    return {
        reportId: 'RPT-001',
        senderId: 'PADPIDA2011112001R',
        recipientId: 'PA-DPIDA-INDII',
        reportingPeriod: { startDate: '2026-06-01', endDate: '2026-06-30' },
        reportCreatedDateTime: '2026-07-15T12:00:00.000Z',
        currencyCode: 'USD',
        summary: { totalUsageCount: 10, totalRevenue: 12.5, currencyCode: 'USD' },
        transactions: [{
            transactionId: 'TX-1',
            resourceId: { isrc: 'USABC2600001' },
            usageType: 'OnDemandStream',
            usageCount: 10,
            revenueAmount: 12.5,
            currencyCode: 'USD',
            territoryCode: 'US',
        }],
    };
}

describe('EarningsReportUploadService.processAndSaveReport', () => {
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
        const report = makeReport();

        const result = await dsrUploadService.processAndSaveReport(report);

        expect(mocks.httpsCallable).toHaveBeenCalledWith(
            expect.anything(),
            'ingestEarningsReport'
        );
        expect(mocks.ingestCallable).toHaveBeenCalledWith({ report });
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

        const result = await dsrUploadService.processAndSaveReport(makeReport());

        expect(result.success).toBe(false);
        expect(result.error).toContain('does not reconcile');
    });

    it('refuses to submit without an authenticated user', async () => {
        mocks.auth.currentUser = null;

        const result = await dsrUploadService.processAndSaveReport(makeReport());

        expect(result.success).toBe(false);
        expect(result.error).toContain('not authenticated');
        expect(mocks.ingestCallable).not.toHaveBeenCalled();
        expect(mocks.allocationCallable).not.toHaveBeenCalled();
    });
});
