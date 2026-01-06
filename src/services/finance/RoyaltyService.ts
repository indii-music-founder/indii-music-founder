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

        for (const item of revenueItems) {
            const trackData = metadataMap[item.isrc];

            if (!trackData) {
                // Skip items without metadata - revenue will remain unallocated
                continue;
            }

            // 1. Check Recoupment (Stub)
            // In a real system, we would query a Recoupment Ledger here.
            // if (isRecoupmentActive(trackData.id)) { ... }

            // 2. Distribute based on splits
            const totalSplits = trackData.splits.reduce((sum, s) => sum + s.percentage, 0);

            // Normalize if not 100% (Safety check)
            // If total < 100, the remainder usually goes to the Label/Account Owner

            trackData.splits.forEach(split => {
                const splitAmount = item.grossRevenue * (split.percentage / 100);

                if (splitAmount > 0) {
                    payouts.push({
                        userId: split.email, // Using email as ID for now
                        amount: Number(splitAmount.toFixed(4)), // Avoid floating point drift
                        currency: item.currency,
                        sourceTrackIsrc: item.isrc,
                        role: split.role
                    });
                }
            });
        }

        return payouts;
    }
}
