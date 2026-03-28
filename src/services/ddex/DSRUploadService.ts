import { logger } from '@/utils/logger';
import { dsrService, type ProcessedSalesBatches } from '@/services/ddex/DSRService';
import type { DSRReport, RoyaltyCalculation } from '@/services/ddex/types/dsr';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { db, auth } from '@/services/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
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
 * Handles the complete flow of uploading, parsing, and processing sales reports
 */
export class DSRUploadService {
    private readonly PROCESSED_REPORTS_COLLECTION = 'dsr_processed_reports';

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
            if (!auth.currentUser) {
                throw new Error('User not authenticated');
            }

            const userId = auth.currentUser.uid;

            // Step 1: Deduce distributor from senderId (handled inside DSRService)
            // Note: dsrService handles the distributor fee deduction and grouping.
            const processedBatch = await dsrService.processReport(report, userCatalog);

            // Figure out the distributor ID to save under (matching logic from dsrService)
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

        } catch (error) {
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
            await addDoc(collection(db, this.PROCESSED_REPORTS_COLLECTION), {
                userId,
                distributorId,
                batchId: batch.batchId,
                reportId: batch.reportId,
                totalRevenue: batch.totalRevenue,
                transactionCount: batch.transactionCount,
                processedAt: Timestamp.fromDate(new Date(batch.processedAt)),
                reportPeriod: {
                    start: originalReport.reportingPeriod.startDate,
                    end: originalReport.reportingPeriod.endDate
                },
                // Store aggregated royalties (not raw transactions for privacy/size)
                royaltiesSummary: {
                    count: batch.royalties.length,
                    totalNetRevenue: batch.royalties.reduce((sum: number, r) => sum + r.netRevenue, 0),
                    totalGrossRevenue: batch.royalties.reduce((sum: number, r) => sum + r.grossRevenue, 0)
                },
                metadata: {
                    createdAt: Timestamp.now(),
                    source: 'dsr_upload_modal'
                }
            });

            logger.debug('[DSRUploadService] Report saved successfully:', batch.batchId);
        } catch (error) {
            logger.error('[DSRUploadService] Failed to save report:', error);
            // Don't throw here - processing was successful even if save failed
            Sentry.captureException(error);
        }
    }
}

export const dsrUploadService = new DSRUploadService();
