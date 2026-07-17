import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin', () => ({
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: Object.assign(vi.fn(), {
        FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    }),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_options: unknown, handler: unknown) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    },
}));

import { processEarningsReport, sanitizeEarningsReport } from '../functions/finance/ingestEarningsReport';

function makeReport() {
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
            serviceName: 'Example DSP',
        }],
    };
}

describe('sanitizeEarningsReport', () => {
    it('rejects a statement whose summary does not reconcile to its rows', () => {
        const report = makeReport();
        report.summary.totalRevenue = 99;

        expect(() => sanitizeEarningsReport(report)).toThrow(/totalRevenue does not reconcile/);
    });

    it('rejects malformed ISRCs before any ledger write', () => {
        const report = makeReport();
        report.transactions[0]!.resourceId.isrc = 'NOT-AN-ISRC';

        expect(() => sanitizeEarningsReport(report)).toThrow(/ISRC/);
    });
});

describe('processEarningsReport', () => {
    it('matches the authenticated owner catalog and commits deterministic server-owned records', async () => {
        const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
        const receipt = { path: 'dsr_processed_reports/receipt', get: vi.fn(async () => ({ exists: false })) };
        const tracksQuery = {
            get: vi.fn(async () => ({
                docs: [{
                    id: 'SONIC-master',
                    data: () => ({
                        trackTitle: 'Water Finds a Way',
                        artistName: 'indii',
                        isrc: 'USABC2600001',
                        upc: '012345678901',
                    }),
                }],
            })),
        };
        const firestore = {
            collection: vi.fn((name: string) => {
                if (name === 'dsr_processed_reports') {
                    return { doc: vi.fn(() => receipt) };
                }
                if (name === 'earnings') {
                    return { doc: vi.fn((id: string) => ({ path: `earnings/${id}` })) };
                }
                if (name === 'users') {
                    return {
                        doc: vi.fn((uid: string) => ({
                            collection: vi.fn(() => ({
                                where: vi.fn(() => tracksQuery),
                                path: `users/${uid}/tracks`,
                            })),
                        })),
                    };
                }
                throw new Error(`Unexpected collection ${name}`);
            }),
            batch: vi.fn(() => ({
                set: vi.fn((target: { path: string }, data: Record<string, unknown>) => writes.push({ path: target.path, data })),
                commit: vi.fn(async () => undefined),
            })),
        };

        const result = await processEarningsReport('owner-1', makeReport(), firestore as never);

        expect(result).toEqual(expect.objectContaining({
            success: true,
            matchedReleases: 1,
            transactionCount: 1,
            alreadyProcessed: false,
        }));
        expect(writes).toHaveLength(2);
        const earningsWrite = writes.find(write => write.path.startsWith('earnings/'));
        expect(earningsWrite?.data).toEqual(expect.objectContaining({
            userId: 'owner-1',
            isrc: 'USABC2600001',
            grossRevenue: 12.5,
            netRevenue: 12.5,
            sourceReceiptId: result.batchId,
            sourceTrust: 'user_uploaded_unverified',
            reconciliationStatus: 'pending_review',
        }));
        expect(writes.find(write => write.path === receipt.path)?.data).toEqual(expect.objectContaining({
            userId: 'owner-1',
            batchId: expect.any(String),
            earningsIds: [earningsWrite?.data.id],
            matchedISRCs: ['USABC2600001'],
            unmatchedISRCs: [],
        }));
    });

    it('chunks large matched catalogs below the Firestore 500-write batch limit and commits the receipt last', async () => {
        const report = makeReport();
        report.transactions = Array.from({ length: 501 }, (_, index) => ({
            ...report.transactions[0]!,
            transactionId: `TX-${index}`,
            resourceId: { isrc: `USABC${String(index).padStart(7, '0')}` },
            usageCount: 1,
            revenueAmount: 1,
        }));
        report.summary.totalUsageCount = 501;
        report.summary.totalRevenue = 501;

        const batchSizes: number[] = [];
        const receipt = { path: 'dsr_processed_reports/receipt', get: vi.fn(async () => ({ exists: false })) };
        const firestore = {
            collection: vi.fn((name: string) => {
                if (name === 'dsr_processed_reports') return { doc: vi.fn(() => receipt) };
                if (name === 'earnings') return { doc: vi.fn((id: string) => ({ path: `earnings/${id}` })) };
                if (name === 'users') {
                    return {
                        doc: vi.fn(() => ({
                            collection: vi.fn(() => ({
                                where: vi.fn((_field: string, _operator: string, values: string[]) => ({
                                    get: vi.fn(async () => ({
                                        docs: values.map(isrc => ({
                                            id: `track-${isrc}`,
                                            data: () => ({ isrc }),
                                        })),
                                    })),
                                })),
                            })),
                        })),
                    };
                }
                throw new Error(`Unexpected collection ${name}`);
            }),
            batch: vi.fn(() => {
                let writes = 0;
                return {
                    set: vi.fn(() => {
                        writes++;
                        if (writes > 500) { console.log('EXCEEDED:', writes); throw new Error('Firestore batch exceeded 500 writes'); }
                    }),
                    commit: vi.fn(async () => {
                        batchSizes.push(writes);
                    }),
                };
            }),
        };

        const result = await processEarningsReport('owner-1', report, firestore as never);

        expect(result.matchedReleases).toBe(501);
        expect(batchSizes.at(-1)).toBe(1);
        expect(batchSizes.slice(0, -1).every(size => size <= 500)).toBe(true);
        expect(batchSizes.reduce((total, size) => total + size, 0)).toBe(502);
    });
});
