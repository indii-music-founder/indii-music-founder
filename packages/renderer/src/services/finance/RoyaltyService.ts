import type { FieldValue, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/services/firebase';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { logger } from '@/utils/logger';

export interface RevenueReportItem {
    transactionId: string;
    isrc: string;
    platform: string;
    territory: string;
    grossRevenue: number;
    currency: string;
}

export interface PayoutRecord {
    /** Account that owns the obligation ledger, never a contributor email. */
    userId: string;
    recipientEmail?: string;
    amount: number;
    currency: string;
    sourceTrackIsrc: string;
    role: string;
    status: 'held_for_reconciliation' | 'pending' | 'paid' | 'failed';
    reportId?: string;
    createdAt?: Timestamp | FieldValue;
}

export interface RecoupmentBalance {
    userId?: string;
    releaseId: string;
    balance: number;
    balanceMicros?: number;
    totalExpense: number;
    updatedAt: Timestamp | FieldValue;
}

export interface RoyaltyReportClaim {
    reportId: string;
    releaseId: string;
    payoutCount: number;
    recoupmentApplied: number;
    processedAt: Timestamp | FieldValue;
}

export interface RevenueIngestionResult {
    success: boolean;
    payoutCount: number;
    processedGroups: number;
    skippedGroups: number;
    alreadyProcessed: boolean;
    error?: string;
}

interface BackendAllocationResult {
    success: true;
    processedEarnings: number;
    alreadyProcessedEarnings: number;
    heldPayouts: number;
    blockedEarnings: number;
}

/**
 * Compatibility facade for the server-owned royalty allocation pipeline.
 *
 * @deprecated New DSR imports should use EarningsReportUploadService, which
 * validates the report and automatically invokes the same backend stage.
 */
export class RoyaltyService {
    static async ingestRevenueReport(
        batchId: string,
        _items: RevenueReportItem[],
        _metadataMap: Record<string, ExtendedGoldenMetadata>
    ): Promise<RevenueIngestionResult> {
        if (!batchId?.trim()) {
            return {
                success: false,
                payoutCount: 0,
                processedGroups: 0,
                skippedGroups: 0,
                alreadyProcessed: false,
                error: 'A backend DSR receipt batchId is required.',
            };
        }

        try {
            const calculate = httpsCallable<{ batchId: string }, BackendAllocationResult>(
                functions,
                'calculateRoyaltyAllocations'
            );
            const { data } = await calculate({ batchId: batchId.trim() });
            return {
                success: true,
                payoutCount: data.heldPayouts,
                processedGroups: data.processedEarnings,
                skippedGroups: data.alreadyProcessedEarnings,
                alreadyProcessed: data.processedEarnings === 0 && data.alreadyProcessedEarnings > 0,
                ...(data.blockedEarnings > 0
                    ? { error: `${data.blockedEarnings} earnings record(s) require split or adjustment review.` }
                    : {}),
            };
        } catch (error: unknown) {
            logger.error('[RoyaltyService] Backend allocation failed:', error);
            return {
                success: false,
                payoutCount: 0,
                processedGroups: 0,
                skippedGroups: 0,
                alreadyProcessed: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    static async setRecoupmentBalance(trackId: string, amount: number): Promise<void> {
        const configure = httpsCallable<
            { trackId: string; amount: number; requestId: string; reason: string },
            { success: true }
        >(functions, 'setRecoupmentBalance');
        await configure({
            trackId,
            amount,
            requestId: crypto.randomUUID(),
            reason: 'Owner-confirmed recoupment balance configuration',
        });
    }
}
