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
     * Upload and process a DSR file
     * @param file - The DSR file (CSV, TSV, TXT, or Excel)
     * @param distributorId - The distributor ID (Spotify, Apple Music, etc.)
     * @param userCatalog - Map of user's releases for matching
     */
    async uploadAndProcess(
        file: File,
        distributorId: string,
        userCatalog: Map<string, ExtendedGoldenMetadata>
    ): Promise<DSRUploadResult> {
        try {
            if (!auth.currentUser) {
                throw new Error('User not authenticated');
            }

            const userId = auth.currentUser.uid;

            // Step 1: Read file content
            const content = await this.readFileContent(file);

            // Step 2: Parse the DSR file
            const parseResult = await dsrService.ingestFlatFile(content);

            if (!parseResult.success || !parseResult.data) {
                return {
                    success: false,
                    error: parseResult.error || 'Failed to parse DSR file'
                };
            }

            const report = parseResult.data;

            // Step 3: Process the report and calculate royalties
            const processedBatch = await dsrService.processReport(report, userCatalog);

            // Step 4: Count matched releases
            const matchedReleases = new Set(
                processedBatch.royalties.map(r => r.isrc)
            ).size;

            // Step 5: Save to Firestore for persistence
            await this.saveProcessedReport(userId, distributorId, processedBatch, report);

            return {
                success: true,
                batchId: processedBatch.batchId,
                totalRevenue: processedBatch.totalRevenue,
                transactionCount: processedBatch.transactionCount,
                matchedReleases
            };

        } catch (error) {
            console.error('[DSRUploadService] Upload failed:', error);
            Sentry.captureException(error);

            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Read file content as text
     */
    private async readFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const content = e.target?.result;
                if (typeof content === 'string') {
                    resolve(content);
                } else {
                    reject(new Error('Failed to read file as text'));
                }
            };

            reader.onerror = () => {
                reject(new Error('File reading failed'));
            };

            reader.readAsText(file);
        });
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

            console.log('[DSRUploadService] Report saved successfully:', batch.batchId);
        } catch (error) {
            console.error('[DSRUploadService] Failed to save report:', error);
            // Don't throw here - processing was successful even if save failed
            Sentry.captureException(error);
        }
    }
}

export const dsrUploadService = new DSRUploadService();
