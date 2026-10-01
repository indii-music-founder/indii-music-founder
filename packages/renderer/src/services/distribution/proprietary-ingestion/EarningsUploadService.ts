import { httpsCallable } from 'firebase/functions';
import * as Sentry from '@sentry/react';

import { auth, functions } from '@/services/firebase';
import { logger } from '@/utils/logger';

export const MAX_ROYALTY_REPORT_BYTES = 6 * 1024 * 1024;

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
 * Sends the original report file to the authenticated backend parser and ledger.
 *
 * Financial collections are intentionally backend-only in Firestore Rules.
 * The server re-validates totals/identifiers and loads the caller's catalog
 * itself; client-provided catalog metadata is never trusted for ledger writes.
 */
export class EarningsReportUploadService {
    async processAndSaveStatement(file: File): Promise<EarningsReportUploadResult> {
        try {
            if (!auth.currentUser?.uid) {
                throw new Error('User not authenticated');
            }
            if (file.size <= 0 || file.size > MAX_ROYALTY_REPORT_BYTES) {
                throw new Error('Choose a report file between 1 byte and 6 MB.');
            }

            const contentBase64 = await fileToBase64(file);

            const ingest = httpsCallable<
                { fileName: string; contentBase64: string },
                BackendEarningsIngestionResult
            >(functions, 'parseAndIngestRoyaltyReport');
            const response = await ingest({ fileName: file.name, contentBase64 });
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

async function fileToBase64(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

export const dsrUploadService = new EarningsReportUploadService();
