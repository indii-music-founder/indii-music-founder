import { logger } from '@/utils/logger';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { db } from '@/services/firebase';
import { Timestamp, FieldValue, doc, runTransaction, setDoc, serverTimestamp } from 'firebase/firestore';

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
    createdAt?: Timestamp | FieldValue;
}

export interface RecoupmentBalance {
    releaseId: string; // releaseId or trackIsrc
    balance: number; // Remaining amount to recoup
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
    /** Payout docs written by THIS ingestion (0 when the report was already processed). */
    payoutCount: number;
    /** Release groups processed by this call. */
    processedGroups: number;
    /** Release groups skipped because a claim for (reportId, releaseId) already existed. */
    skippedGroups: number;
    /** True when every release group in the report had already been ingested. */
    alreadyProcessed: boolean;
    error?: string;
}

export class RoyaltyService {
    private static readonly PAYOUTS_COLLECTION = 'payouts';
    private static readonly RECOUPMENT_COLLECTION = 'recoupment_balances';
    private static readonly REPORT_CLAIMS_COLLECTION = 'royalty_report_claims';

    /**
     * Ingest a batch of revenue items and calculate payouts, applying recoupment.
     *
     * Idempotent per (reportId, releaseId): each release group is claimed by a
     * `royalty_report_claims` doc written in the same transaction as its payouts
     * and recoupment update, so re-ingesting the same report (double upload,
     * retry after a partial failure) never duplicates payouts or deducts
     * recoupment twice — already-claimed groups are skipped, unclaimed groups
     * from a partial failure are picked up.
     */
    static async ingestRevenueReport(
        reportId: string,
        items: RevenueReportItem[],
        metadataMap: Record<string, ExtendedGoldenMetadata>
    ): Promise<RevenueIngestionResult> {
        if (!reportId?.trim()) {
            return {
                success: false,
                payoutCount: 0,
                processedGroups: 0,
                skippedGroups: 0,
                alreadyProcessed: false,
                error: 'reportId is required: ingestion is idempotent per report and cannot claim an unidentified report'
            };
        }
        try {
            // Group items by releaseId to minimize database queries
            const releaseGroups: Record<string, RevenueReportItem[]> = {};

            for (const item of items) {
                const trackData = metadataMap[item.isrc];
                if (!trackData) continue;

                const releaseId = trackData.id || item.isrc;
                if (!releaseGroups[releaseId]) {
                    releaseGroups[releaseId] = [];
                }
                releaseGroups[releaseId].push(item);
            }

            const transactionPromises = Object.entries(releaseGroups).map(async ([releaseId, groupItems]) => {
                let payoutsStoredInThisTx = 0;
                let claimAlreadyExisted = false;
                // Use transaction for atomic claim + recoupment update + payout recording per release
                await runTransaction(db, async (transaction) => {
                    // Firestore may re-run this callback on contention — reset per attempt
                    payoutsStoredInThisTx = 0;
                    claimAlreadyExisted = false;

                    // All reads must precede all writes inside a Firestore transaction.
                    const claimRef = doc(db, this.REPORT_CLAIMS_COLLECTION, this.buildClaimId(reportId, releaseId));
                    const claimDoc = await transaction.get(claimRef);
                    if (claimDoc.exists()) {
                        claimAlreadyExisted = true;
                        return; // this (report, release) group was already ingested — no writes
                    }

                    const recoupRef = doc(db, this.RECOUPMENT_COLLECTION, releaseId);
                    const recoupDoc = await transaction.get(recoupRef);

                    let currentBalance = 0;

                    if (recoupDoc.exists()) {
                        const data = recoupDoc.data() as RecoupmentBalance;
                        currentBalance = data.balance;
                    }

                    const initialBalance = currentBalance;

                    // Deterministic payout ids make a re-run overwrite instead of duplicate;
                    // identical (report, transaction, isrc, payee, role) keys merge amounts.
                    const payoutsById = new Map<string, PayoutRecord>();

                    for (const item of groupItems) {
                        const trackData = metadataMap[item.isrc];
                        if (!trackData) continue;

                        let unallocatedRevenue = item.grossRevenue;

                        if (currentBalance > 0) {
                            const deduction = Math.min(unallocatedRevenue, currentBalance);
                            currentBalance -= deduction;
                            unallocatedRevenue -= deduction;
                        }

                        if (unallocatedRevenue <= 0) continue;

                        // Calculate splits on the remaining revenue for this item
                        const payouts = this.calculateSplitsFromUnallocated(unallocatedRevenue, trackData, item);

                        for (const payout of payouts) {
                            const payoutId = this.buildPayoutId(reportId, item, payout);
                            const existing = payoutsById.get(payoutId);
                            if (existing) {
                                existing.amount = Number((existing.amount + payout.amount).toFixed(4));
                            } else {
                                payoutsById.set(payoutId, payout);
                            }
                        }
                    }

                    // Record each payout in the transaction
                    for (const [payoutId, payout] of payoutsById) {
                        const payoutRef = doc(db, this.PAYOUTS_COLLECTION, payoutId);
                        transaction.set(payoutRef, {
                            ...payout,
                            reportId,
                            status: 'pending',
                            createdAt: serverTimestamp()
                        });
                        payoutsStoredInThisTx++;
                    }

                    if (initialBalance !== currentBalance) {
                        transaction.update(recoupRef, {
                            balance: currentBalance,
                            updatedAt: serverTimestamp()
                        });
                        logger.debug(`[RoyaltyService] Recooped ${initialBalance - currentBalance} for ${releaseId}. Remaining: ${currentBalance}`);
                    }

                    const claim: RoyaltyReportClaim = {
                        reportId,
                        releaseId,
                        payoutCount: payoutsStoredInThisTx,
                        recoupmentApplied: initialBalance - currentBalance,
                        processedAt: serverTimestamp()
                    };
                    transaction.set(claimRef, claim);
                });
                return { payouts: payoutsStoredInThisTx, skipped: claimAlreadyExisted };
            });

            const results = await Promise.all(transactionPromises);
            const skippedGroups = results.filter(r => r.skipped).length;
            const processedGroups = results.length - skippedGroups;
            const totalPayoutsStored = results.reduce((acc, r) => acc + (r.skipped ? 0 : r.payouts), 0);

            if (skippedGroups > 0) {
                logger.info(`[RoyaltyService] Report ${reportId}: skipped ${skippedGroups} already-ingested release group(s).`);
            }

            return {
                success: true,
                payoutCount: totalPayoutsStored,
                processedGroups,
                skippedGroups,
                alreadyProcessed: results.length > 0 && processedGroups === 0
            };
        } catch (error: unknown) {
            logger.error('[RoyaltyService] Ingestion failed:', error);
            return {
                success: false,
                payoutCount: 0,
                processedGroups: 0,
                skippedGroups: 0,
                alreadyProcessed: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /** Firestore doc ids cannot contain '/'; every segment feeding a deterministic id must sanitize identically on every run. */
    private static sanitizeIdSegment(value: string): string {
        return value.trim().replace(/[/\s]+/g, '_');
    }

    private static buildClaimId(reportId: string, releaseId: string): string {
        return `${this.sanitizeIdSegment(reportId)}--${this.sanitizeIdSegment(releaseId)}`;
    }

    private static buildPayoutId(reportId: string, item: RevenueReportItem, payout: PayoutRecord): string {
        return [reportId, item.transactionId, item.isrc, payout.userId, payout.role]
            .map(segment => this.sanitizeIdSegment(segment))
            .join('--');
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
                    userId: 'label_hq@indii.music',
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
        await setDoc(doc(db, this.RECOUPMENT_COLLECTION, releaseId), {
            releaseId,
            balance: amount,
            totalExpense: amount,
            updatedAt: serverTimestamp()
        });
    }
}
