/* eslint-disable @typescript-eslint/no-explicit-any -- Service with dynamic external data */
import { logger } from '@/utils/logger';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { db } from '@/services/firebase';
import {
    collection,
    doc,
    runTransaction,
    addDoc,
    serverTimestamp,
    getDocs,
    query,
    where
} from 'firebase/firestore';

export interface RevenueReportItem {
    transactionId: string;
    isrc: string;
    platform: string;
    territory: string;
    grossRevenue: number;
    currency: string;
}

export interface PayoutRecord {
    userId: string; // The email or UID of the specific payee
    amount: number;
    currency: string;
    sourceTrackIsrc: string;
    role: string;
    status: 'pending' | 'paid';
    reportId?: string;
    createdAt?: any;
}

export interface RecoupmentBalance {
    releaseId: string; // releaseId or trackIsrc
    balance: number; // Remaining amount to recoup
    totalExpense: number;
    updatedAt: any;
}

export class RoyaltyService {
    private static readonly PAYOUTS_COLLECTION = 'payouts';
    private static readonly RECOUPMENT_COLLECTION = 'recoupment_balances';

    /**
     * Ingest a batch of revenue items and calculate payouts, applying recoupment.
     */
    static async ingestRevenueReport(
        reportId: string,
        items: RevenueReportItem[],
        metadataMap: Record<string, ExtendedGoldenMetadata>
    ): Promise<{ success: boolean; payoutCount: number; error?: string }> {
        try {
            let totalPayoutsStored = 0;

            for (const item of items) {
                const trackData = metadataMap[item.isrc];
                if (!trackData) continue;

                const releaseId = trackData.id || item.isrc;

                // Use transaction for atomic recoupment update and payout recording
                await runTransaction(db, async (transaction) => {
                    const recoupRef = doc(db, this.RECOUPMENT_COLLECTION, releaseId);
                    const recoupDoc = await transaction.get(recoupRef);

                    let unallocatedRevenue = item.grossRevenue;
                    let currentBalance = 0;

                    if (recoupDoc.exists()) {
                        const data = recoupDoc.data() as RecoupmentBalance;
                        currentBalance = data.balance;

                        if (currentBalance > 0) {
                            const deduction = Math.min(unallocatedRevenue, currentBalance);
                            currentBalance -= deduction;
                            unallocatedRevenue -= deduction;

                            transaction.update(recoupRef, {
                                balance: currentBalance,
                                updatedAt: serverTimestamp()
                            });
                            logger.debug(`[RoyaltyService] Recooped ${deduction} for ${releaseId}. Remaining: ${currentBalance}`);
                        }
                    }

                    if (unallocatedRevenue <= 0) return;

                    // Calculate splits on the remaining revenue
                    const payouts = this.calculateSplitsFromUnallocated(unallocatedRevenue, trackData, item);

                    // Record each payout in the transaction
                    for (const payout of payouts) {
                        const payoutRef = doc(collection(db, this.PAYOUTS_COLLECTION));
                        transaction.set(payoutRef, {
                            ...payout,
                            reportId,
                            status: 'pending',
                            createdAt: serverTimestamp()
                        });
                        totalPayoutsStored++;
                    }
                });
            }

            return { success: true, payoutCount: totalPayoutsStored };
        } catch (error) {
            logger.error('[RoyaltyService] Ingestion failed:', error);
            return { success: false, payoutCount: 0, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Internal logic helper for split distribution.
     */
    private static calculateSplitsFromUnallocated(
        unallocatedRevenue: number,
        trackData: ExtendedGoldenMetadata,
        item: RevenueReportItem
    ): PayoutRecord[] {
        const payouts: PayoutRecord[] = [];
        const totalSplits = trackData.splits.reduce((sum, s) => sum + s.percentage, 0);

        // 1. Distribute defined splits
        trackData.splits.forEach(split => {
            const normalizedPercentage = totalSplits > 100 ? (split.percentage / totalSplits) * 100 : split.percentage;
            const splitAmount = unallocatedRevenue * (normalizedPercentage / 100);

            if (splitAmount > 0) {
                payouts.push({
                    userId: split.email,
                    amount: Number(splitAmount.toFixed(4)),
                    currency: item.currency,
                    sourceTrackIsrc: item.isrc,
                    role: split.role,
                    status: 'pending'
                });
            }
        });

        // 2. Handle Leftovers (to Label)
        if (totalSplits < 100) {
            const labelPercentage = 100 - totalSplits;
            const labelAmount = unallocatedRevenue * (labelPercentage / 100);

            if (labelAmount > 0) {
                payouts.push({
                    userId: 'label_hq@indiios.com',
                    amount: Number(labelAmount.toFixed(4)),
                    currency: item.currency,
                    sourceTrackIsrc: item.isrc,
                    role: 'Label',
                    status: 'pending'
                });
            }
        }

        return payouts;
    }

    /**
     * Manual override or initialization of recoupment balance.
     */
    static async setRecoupmentBalance(releaseId: string, amount: number): Promise<void> {
        await addDoc(collection(db, this.RECOUPMENT_COLLECTION), {
            releaseId,
            balance: amount,
            totalExpense: amount,
            updatedAt: serverTimestamp()
        });
    }
}
