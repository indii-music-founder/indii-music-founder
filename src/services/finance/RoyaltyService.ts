import { ExtendedGoldenMetadata } from '@/services/metadata/types';

export interface RevenueReportItem {
    transactionId: string;
    isrc: string;
    platform: string;
    territory: string;
    grossRevenue: number;
    currency: string;
}

export interface PayoutRecord {
    userId: string; // The specific payee (e.g. producer@gmail.com)
    amount: number;
    currency: string;
    sourceTrackIsrc: string;
    role: string;
}

export interface RecoupmentBalance {
    id: string; // releaseId or trackIsrc
    balance: number; // Remaining amount to recoup
    totalExpense: number;
}

export class RoyaltyService {

    /**
     * Calculate splits for a batch of revenue items against track metadata.
     * @param revenueItems Raw revenue lines from DSPs
     * @param metadataMap Map of ISRC -> ExtendedGoldenMetadata
     */
    static calculateSplits(
        revenueItems: RevenueReportItem[],
        metadataMap: Record<string, ExtendedGoldenMetadata>
    ): PayoutRecord[] {
        const payouts: PayoutRecord[] = [];
        // Mock recoupment balances (In production, caller or service would provide this)
        const recoupmentBalances: Record<string, number> = {};

        for (const item of revenueItems) {
            const trackData = metadataMap[item.isrc];

            if (!trackData) {
                continue;
            }

            // 1. Check Recoupment
            // Deduct the gross revenue from the recoupment balance first
            let unallocatedRevenue = item.grossRevenue;
            const releaseId = trackData.id || item.isrc;

            if (recoupmentBalances[releaseId] && recoupmentBalances[releaseId] > 0) {
                const deduction = Math.min(unallocatedRevenue, recoupmentBalances[releaseId]);
                recoupmentBalances[releaseId] -= deduction;
                unallocatedRevenue -= deduction;
                console.log(`[RoyaltyService] Recooped ${deduction} for ${releaseId}. Remaining balance: ${recoupmentBalances[releaseId]}`);
            }

            if (unallocatedRevenue <= 0) continue;

            // 2. Distribute based on splits
            const totalSplits = trackData.splits.reduce((sum, s) => sum + s.percentage, 0);

            if (totalSplits > 100) {
                console.warn(`[RoyaltyService] Total splits exceed 100% (${totalSplits}%) for ${item.isrc}. Normalizing...`);
            }

            // Distribute defined splits
            trackData.splits.forEach(split => {
                // If total > 100, we normalize to prevent paying out more than we have
                const normalizedPercentage = totalSplits > 100 ? (split.percentage / totalSplits) * 100 : split.percentage;
                const splitAmount = unallocatedRevenue * (normalizedPercentage / 100);

                if (splitAmount > 0) {
                    payouts.push({
                        userId: split.email,
                        amount: Number(splitAmount.toFixed(4)),
                        currency: item.currency,
                        sourceTrackIsrc: item.isrc,
                        role: split.role
                    });
                }
            });

            // 3. Handle Leftovers (Auto-allocate to Label/Owner)
            if (totalSplits < 100) {
                const labelPercentage = 100 - totalSplits;
                const labelAmount = unallocatedRevenue * (labelPercentage / 100);

                if (labelAmount > 0) {
                    payouts.push({
                        userId: 'label_hq@indiios.com', // Default Label/Owner ID
                        amount: Number(labelAmount.toFixed(4)),
                        currency: item.currency,
                        sourceTrackIsrc: item.isrc,
                        role: 'Label'
                    });
                    console.log(`[RoyaltyService] Allocated leftover ${labelPercentage}% (${labelAmount}) to Label HQ.`);
                }
            }
        }

        return payouts;
    }
}
