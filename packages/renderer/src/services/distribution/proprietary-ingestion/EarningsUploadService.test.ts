import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EarningsReportReport } from './types/dsr';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

/**
 * ISSUE-967: DSR import must never partially write earnings (one release
 * committed, another not) and must never return success without a durable
 * receipt. These tests cover the actual atomicity/idempotency contract.
 */

const mocks = vi.hoisted(() => {
    const mockBatchSet = vi.fn();
    const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
    const mockGetDoc = vi.fn();
    const mockDoc = vi.fn((..._args: unknown[]) => ({ __docRefArgs: _args }));
    const mockWriteBatch = vi.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

    return { mockBatchSet, mockBatchCommit, mockGetDoc, mockDoc, mockWriteBatch };
});

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        doc: mocks.mockDoc,
        getDoc: mocks.mockGetDoc,
        writeBatch: mocks.mockWriteBatch,
    };
});

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: { currentUser: { uid: 'user-1' } },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
}));

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import { dsrUploadService } from './EarningsUploadService';

function makeReport(reportId: string): EarningsReportReport {
    return {
        reportId,
        senderId: 'PASystemIdentityA',
        recipientId: 'PASystemIdentityB',
        reportingPeriod: { startDate: '2025-01-01', endDate: '2025-01-31' },
        reportCreatedDateTime: '2025-02-01T12:00:00Z',
        currencyCode: 'USD',
        summary: { totalUsageCount: 1, totalRevenue: 100, currencyCode: 'USD' },
        transactions: [{
            transactionId: 'TX-1',
            resourceId: { isrc: 'US1234567890' },
            usageType: 'Download',
            usageCount: 1,
            revenueAmount: 100,
            currencyCode: 'USD',
            territoryCode: 'US',
        }],
    };
}

function makeCatalog(): Map<string, ExtendedGoldenMetadata> {
    const catalog = new Map<string, ExtendedGoldenMetadata>();
    catalog.set('US1234567890', {
        title: 'Test Track', artist: 'Test Artist', isrc: 'US1234567890', upc: '1234567890123',
        releaseDate: '2024-01-01', genre: 'Pop', releaseType: 'Single', territories: ['US'],
        splits: [], tracks: [], copyrightYear: '2024', copyrightOwner: 'Test Label',
    } as unknown as ExtendedGoldenMetadata);
    return catalog;
}

describe('EarningsReportUploadService.processAndSaveReport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockBatchCommit.mockResolvedValue(undefined);
    });

    it('commits earnings and the receipt atomically in a single batch, never partially', async () => {
        mocks.mockGetDoc.mockResolvedValue({ exists: () => false });

        const result = await dsrUploadService.processAndSaveReport(makeReport('RPT-ATOMIC'), makeCatalog());

        expect(result.success).toBe(true);
        // One batch, one commit — not N independent writes.
        expect(mocks.mockWriteBatch).toHaveBeenCalledTimes(1);
        expect(mocks.mockBatchCommit).toHaveBeenCalledTimes(1);
        // Earnings record(s) + the receipt were both staged before that single commit.
        expect(mocks.mockBatchSet).toHaveBeenCalledTimes(2); // 1 earnings record (1 matched ISRC) + 1 receipt
    });

    it('returns success:false (never a swallowed partial success) when the atomic commit fails', async () => {
        mocks.mockGetDoc.mockResolvedValue({ exists: () => false });
        mocks.mockBatchCommit.mockRejectedValueOnce(new Error('Firestore unavailable'));

        const result = await dsrUploadService.processAndSaveReport(makeReport('RPT-FAIL'), makeCatalog());

        expect(result.success).toBe(false);
        expect(result.error).toContain('Firestore unavailable');
    });

    it('is idempotent: re-importing the identical report returns the existing receipt without reprocessing', async () => {
        const existingReceipt = {
            totalRevenue: 100,
            transactionCount: 1,
            royaltiesSummary: { count: 1, totalNetRevenue: 85, totalGrossRevenue: 100 },
        };
        mocks.mockGetDoc.mockResolvedValue({ exists: () => true, data: () => existingReceipt });

        const result = await dsrUploadService.processAndSaveReport(makeReport('RPT-DUPLICATE'), makeCatalog());

        expect(result.success).toBe(true);
        expect(result.totalRevenue).toBe(100);
        expect(result.matchedReleases).toBe(1);
        // Must short-circuit before ever touching a batch.
        expect(mocks.mockWriteBatch).not.toHaveBeenCalled();
    });

    it('derives the same batch ID for the same (user, distributor, reportId) — the idempotency key', async () => {
        mocks.mockGetDoc.mockResolvedValue({ exists: () => false });

        await dsrUploadService.processAndSaveReport(makeReport('RPT-STABLE-KEY'), makeCatalog());
        const firstCallDocArgs = mocks.mockDoc.mock.calls.find(args => String(args[1]).includes('dsr_'));

        vi.clearAllMocks();
        mocks.mockGetDoc.mockResolvedValue({ exists: () => false });
        mocks.mockBatchCommit.mockResolvedValue(undefined);

        await dsrUploadService.processAndSaveReport(makeReport('RPT-STABLE-KEY'), makeCatalog());
        const secondCallDocArgs = mocks.mockDoc.mock.calls.find(args => String(args[1]).includes('dsr_'));

        expect(firstCallDocArgs?.[1]).toBe(secondCallDocArgs?.[1]);
    });

    it('rejects when no user is authenticated', async () => {
        const { auth } = await import('@/services/firebase');
        (auth as unknown as { currentUser: unknown }).currentUser = null;

        const result = await dsrUploadService.processAndSaveReport(makeReport('RPT-NOAUTH'), makeCatalog());

        expect(result.success).toBe(false);
        expect(result.error).toContain('not authenticated');

        (auth as unknown as { currentUser: unknown }).currentUser = { uid: 'user-1' };
    });
});
