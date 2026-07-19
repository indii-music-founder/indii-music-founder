import { httpsCallable } from 'firebase/functions';
import * as Sentry from '@sentry/react';

import { auth, functions } from '@/services/firebase';
import { logger } from '@/utils/logger';
import type { EarningsReportReport } from '@/services/distribution/proprietary-ingestion/types/dsr';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

export interface EarningsReportUploadResult {
    success: boolean;
    batchId?: string;
    totalRevenue?: number;
    transactionCount?: number;
    matchedReleases?: number;
    unmatchedISRCs?: string[];
    alreadyProcessed?: boolean;
    allocation?: BackendRoyaltyAllocationResult;
    allocationError?: string;
    error?: string;
}

interface BackendEarningsIngestionResult {
    success: true;
    batchId: string;
    totalRevenue: number;
    transactionCount: number;
    matchedReleases: number;
    unmatchedISRCs: string[];
    alreadyProcessed: boolean;
}

interface BackendRoyaltyAllocationResult {
    success: true;
    batchId: string;
    processedEarnings: number;
    alreadyProcessedEarnings: number;
    heldPayouts: number;
    blockedEarnings: number;
}

/**
 * Sends a parsed DSR to the authenticated backend ingestion boundary.
 *
 * Financial collections are intentionally backend-only in Firestore Rules.
 * The server re-validates totals/identifiers and loads the caller's catalog
 * itself; client-provided catalog metadata is never trusted for ledger writes.
 */
export class EarningsReportUploadService {
    async processAndSaveReport(
        report: EarningsReportReport,
        _userCatalog?: Map<string, ExtendedGoldenMetadata>
    ): Promise<EarningsReportUploadResult> {
        try {
            if (!auth.currentUser?.uid) {
                throw new Error('User not authenticated');
            }

            const ingest = httpsCallable<
                { report: EarningsReportReport },
                BackendEarningsIngestionResult
            >(functions, 'ingestEarningsReport');
            const response = await ingest({ report });
            if (response.data.matchedReleases === 0) return response.data;

            try {
                const calculateAllocations = httpsCallable<
                    { batchId: string },
                    BackendRoyaltyAllocationResult
                >(functions, 'calculateRoyaltyAllocations');
                const allocationResponse = await calculateAllocations({ batchId: response.data.batchId });
                return { ...response.data, allocation: allocationResponse.data };
            } catch (allocationError: unknown) {
                // The validated earnings receipt remains durable and retryable.
                // Never pretend provisional obligations were calculated when the
                // second, idempotent backend stage could not complete.
                logger.error('[EarningsReportUploadService] Royalty allocation failed:', allocationError);
                Sentry.captureException(allocationError);
                return {
                    ...response.data,
                    allocationError: allocationError instanceof Error
                        ? allocationError.message
                        : 'Royalty allocation could not be calculated.',
                };
            }
        } catch (error: unknown) {
            logger.error('[EarningsReportUploadService] Processing failed:', error);
            Sentry.captureException(error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }
}

export const dsrUploadService = new EarningsReportUploadService();
