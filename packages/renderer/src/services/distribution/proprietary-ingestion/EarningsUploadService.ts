import { Timestamp, doc, writeBatch, getDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { FirestoreService } from '@/services/FirestoreService';
import { EarningsService } from '@/services/distribution/EarningsService';
import type { DSRProcessedReportDocument, EarningsDocument } from '@/types/firestore';
import type { EarningsReportReport } from '@/services/distribution/proprietary-ingestion/types/dsr';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { earningsReportService } from '@/services/distribution/proprietary-ingestion/EarningsReportService';
import { logger } from '@/utils/logger';
import * as Sentry from '@sentry/react';

export interface EarningsReportUploadResult {
    success: boolean;
    batchId?: string;
    totalRevenue?: number;
    transactionCount?: number;
    matchedReleases?: number;
    error?: string;
}

/**
 * EarningsReport Upload Service
 * Handles the complete flow of uploading, parsing, and processing sales reports.
 */
export class EarningsReportUploadService extends FirestoreService<DSRProcessedReportDocument> {
    constructor() {
        super('dsr_processed_reports');
    }

    /**
     * Derive a deterministic batch/receipt ID from (userId, distributor, reportId)
     * instead of a timestamp — this is what makes re-importing the exact same
     * report idempotent rather than a duplicate (ISSUE-967).
     */
    private buildBatchId(userId: string, distributorId: string, reportId: string): string {
        const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
        return `dsr_${safe(userId)}_${safe(distributorId)}_${safe(reportId)}`;
    }

    /**
     * Process a parsed EarningsReport report and save earnings/royalties.
     *
     * ISSUE-967 fix: the batch ID is now deterministic (userId+distributor+
     * reportId), so re-submitting the same report short-circuits to the
     * existing receipt instead of reprocessing/duplicating. All earnings
     * writes plus the receipt are committed in ONE atomic Firestore batch —
     * either every release lands together with the receipt, or none do.
     * There is no more silent catch around the receipt save: a batch commit
     * failure propagates to the outer catch and returns success:false.
     *
     * @param report - The parsed EarningsReport report
     * @param userCatalog - Map of user's releases for matching
     */
    async processAndSaveReport(
        report: EarningsReportReport,
        userCatalog: Map<string, ExtendedGoldenMetadata>
    ): Promise<EarningsReportUploadResult> {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Figure out the distributor ID to save under
            const { DISTRIBUTORS } = await import('@/core/config/distributors');
            const distributorId = Object.keys(DISTRIBUTORS).find(
                key => DISTRIBUTORS[key]!.systemIdentifier === report.senderId
            ) || 'unknown';

            const batchId = this.buildBatchId(userId, distributorId, report.reportId);

            // Idempotency: an identical (user, distributor, reportId) import
            // already landed — return the existing receipt rather than
            // reprocessing (which would otherwise re-run the whole pipeline
            // and could double-count if the ID scheme ever changes).
            const existingSnap = await getDoc(doc(db, this.collectionPath, batchId));
            if (existingSnap.exists()) {
                const existing = existingSnap.data() as DSRProcessedReportDocument;
                logger.info(`[EarningsReportUploadService] Duplicate import of report ${report.reportId} — returning existing batch ${batchId}`);
                return {
                    success: true,
                    batchId,
                    totalRevenue: existing.totalRevenue,
                    transactionCount: existing.transactionCount,
                    matchedReleases: existing.royaltiesSummary.count
                };
            }

            // Pure calculation — no I/O, no partial-commit risk in here.
            const processedBatch = await earningsReportService.processReport(report, userCatalog);
            const matchedReleases = new Set(processedBatch.royalties.map(r => r.isrc)).size;

            // Build ONE atomic batch: every earnings record + the receipt.
            const batch = writeBatch(db);

            for (const calc of processedBatch.royalties) {
                const period = {
                    startDate: calc.period.startDate,
                    endDate: calc.period.endDate || new Date().toISOString()
                };
                const earningsId = EarningsService.buildEarningsId(distributorId, calc.releaseId, period);
                const earningsRecord: EarningsDocument = {
                    id: earningsId,
                    userId,
                    distributorId,
                    releaseId: calc.releaseId,
                    period,
                    streams: calc.totalStreams,
                    downloads: calc.totalDownloads,
                    grossRevenue: calc.grossRevenue,
                    distributorFee: calc.distributorFees,
                    netRevenue: calc.netRevenue,
                    platformFee: calc.platformFees,
                    currencyCode: calc.currencyCode,
                    matchedReleases: 1,
                    unmatchedISRCs: [],
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };
                batch.set(doc(db, 'earnings', earningsId), earningsRecord, { merge: true });
            }

            const reportData: DSRProcessedReportDocument = {
                id: batchId,
                userId,
                distributorId,
                batchId,
                reportId: processedBatch.reportId,
                totalRevenue: processedBatch.totalRevenue,
                transactionCount: processedBatch.transactionCount,
                processedAt: Timestamp.fromDate(new Date(processedBatch.processedAt)),
                reportPeriod: {
                    start: report.reportingPeriod.startDate,
                    end: report.reportingPeriod.endDate || new Date().toISOString()
                },
                royaltiesSummary: {
                    count: processedBatch.royalties.length,
                    totalNetRevenue: processedBatch.royalties.reduce((sum, r) => sum + r.netRevenue, 0),
                    totalGrossRevenue: processedBatch.royalties.reduce((sum, r) => sum + r.grossRevenue, 0)
                },
                metadata: {
                    createdAt: Timestamp.now(),
                    source: 'dsr_upload_modal'
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };
            batch.set(doc(db, this.collectionPath, batchId), reportData);

            // Atomic commit — either everything above lands, or nothing does.
            // No try/catch here: a failure must propagate to the outer catch.
            await batch.commit();
            logger.debug('[EarningsReportUploadService] Batch committed successfully:', batchId);

            return {
                success: true,
                batchId,
                totalRevenue: processedBatch.totalRevenue,
                transactionCount: processedBatch.transactionCount,
                matchedReleases
            };

        } catch (error: unknown) {
            logger.error('[EarningsReportUploadService] Processing failed:', error);
            Sentry.captureException(error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
}

export const dsrUploadService = new EarningsReportUploadService();
