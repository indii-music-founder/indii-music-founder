import { Timestamp } from 'firebase/firestore';
import { auth } from '@/services/firebase';
import { FirestoreService } from '@/services/FirestoreService';
import type { DSRProcessedReportDocument } from '@/types/firestore';
import type { DSRReport } from '@/services/ddex/types/dsr';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { dsrService, type ProcessedSalesBatches } from '@/services/ddex/DSRService';
import { logger } from '@/utils/logger';
import * as Sentry from '@sentry/react';

export interface DSRUploadResult {
    success: boolean;
    batchId?: string;
    totalRevenue?: number;
    transactionCount?: number;
    matchedReleases?: number;
    error?: string;
}

/**
 * DSR Upload Service
 * Handles the complete flow of uploading, parsing, and processing sales reports.
 */
export class DSRUploadService extends FirestoreService<DSRProcessedReportDocument> {
    constructor() {
        super('dsr_processed_reports');
    }

    /**
     * Process a parsed DSR report and save earnings/royalties
     * @param report - The parsed DSR report
     * @param userCatalog - Map of user's releases for matching
     */
    async processAndSaveReport(
        report: DSRReport,
        userCatalog: Map<string, ExtendedGoldenMetadata>
    ): Promise<DSRUploadResult> {
        try {
            const userId = auth.currentUser?.uid;
            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Step 1: Deduce distributor from senderId (handled inside DSRService)
            const processedBatch = await dsrService.processReport(report, userCatalog);

            // Figure out the distributor ID to save under
            const { DISTRIBUTORS } = await import('@/core/config/distributors');
            const distributorKey = Object.keys(DISTRIBUTORS).find(
                key => DISTRIBUTORS[key]!.ddexPartyId === report.senderId
            ) || 'unknown';

            // Step 2: Count matched releases
            const matchedReleases = new Set(
                processedBatch.royalties.map(r => r.isrc)
            ).size;

            // Step 3: Save to Firestore for persistence
            await this.saveProcessedReport(userId, distributorKey, processedBatch, report);

            return {
                success: true,
                batchId: processedBatch.batchId,
                totalRevenue: processedBatch.totalRevenue,
                transactionCount: processedBatch.transactionCount,
                matchedReleases
            };

        } catch (error: unknown) {
            logger.error('[DSRUploadService] Processing failed:', error);
            Sentry.captureException(error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Save processed report to Firestore
     */
    private async saveProcessedReport(
        userId: string,
        distributorId: string,
        batch: ProcessedSalesBatches,
        originalReport: DSRReport
    ): Promise<void> {
        try {
            const reportData: Omit<DSRProcessedReportDocument, 'id' | 'createdAt' | 'updatedAt'> = {
                userId,
                distributorId,
                batchId: batch.batchId,
                reportId: batch.reportId,
                totalRevenue: batch.totalRevenue,
                transactionCount: batch.transactionCount,
                processedAt: Timestamp.fromDate(new Date(batch.processedAt)),
                reportPeriod: {
                    start: originalReport.reportingPeriod.startDate,
                    end: originalReport.reportingPeriod.endDate || new Date().toISOString()
                },
                royaltiesSummary: {
                    count: batch.royalties.length,
                    totalNetRevenue: batch.royalties.reduce((sum, r) => sum + r.netRevenue, 0),
                    totalGrossRevenue: batch.royalties.reduce((sum, r) => sum + r.grossRevenue, 0)
                },
                metadata: {
                    createdAt: Timestamp.now(),
                    source: 'dsr_upload_modal'
                }
            };

            await this.add(reportData);
            logger.debug('[DSRUploadService] Report saved successfully:', batch.batchId);
        } catch (error: unknown) {
            logger.error('[DSRUploadService] Failed to save report:', error);
            Sentry.captureException(error);
        }
    }
}

export const dsrUploadService = new DSRUploadService();
