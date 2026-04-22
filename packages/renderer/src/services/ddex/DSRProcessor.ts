import {
    DSRReport,
    RoyaltyCalculation,
    ContributorPayment,
} from './types/dsr';
import { ExtendedGoldenMetadata, RoyaltySplit } from '@/services/metadata/types';

/**
 * DSR Processor
 * Calculates royalties and splits based on sales reports and metadata
 */
export class DSRProcessor {
    /**
     * Process a Full DSR Report against a catalog of metadata
     * @param report The parsed DSR report
     * @param catalog Metadata map (ISRC -> Metadata)
     * @param config Processing configuration (fees, rates)
     */
    async calculateRoyalties(
        report: DSRReport,
        catalog: Map<string, ExtendedGoldenMetadata>,
        config: {
            distributorFeePercent: number; // e.g., 0 for no fee, 15 for 15%
            platformFeePercent: number;
        } = { distributorFeePercent: 0, platformFeePercent: 0 }
    ): Promise<RoyaltyCalculation[]> {
        // First pass: aggregate totals without fetching metadata yet.
        // This avoids N+1 queries by replacing N catalog.get(isrc) lookups with Map lookups
        const tempCalculations: Map<string, { totalStreams: number; totalDownloads: number; grossRevenue: number }> = new Map();

        for (const txn of report.transactions) {
            const isrc = txn.resourceId.isrc;
            if (!isrc) continue; // Skip if no ISRC to match

            let calc = tempCalculations.get(isrc);
            if (!calc) {
                calc = { totalStreams: 0, totalDownloads: 0, grossRevenue: 0 };
                tempCalculations.set(isrc, calc);
            }

            // Aggregate Usage
            if (txn.usageType === 'OnDemandStream' || txn.usageType === 'ProgrammedStream') {
                calc.totalStreams += txn.usageCount;
            } else if (txn.usageType === 'Download' || txn.usageType === 'RingtoneDownload') {
                calc.totalDownloads += txn.usageCount;
            }

            // Aggregate Revenue
            calc.grossRevenue += txn.revenueAmount;
        }

        // Finalize Calculations (Apply Fees & Splits)
        // Second pass: map with metadata only for unique ISRC found in transactions
        const results: RoyaltyCalculation[] = [];
        for (const [isrc, tempCalc] of tempCalculations.entries()) {
            const metadata = catalog.get(isrc);
            if (!metadata) {
                // Skip transactions without matching metadata
                continue;
            }

            const calc = this.createEmptyCalculation(isrc, metadata, report);
            calc.totalStreams = tempCalc.totalStreams;
            calc.totalDownloads = tempCalc.totalDownloads;
            calc.grossRevenue = tempCalc.grossRevenue;

            // 1. Deduct Fees
            // Platform fees are usually deducted before we get the report revenue (Net Receipts), 
            // but if we are acting as distributor, we might take a cut.
            // DSR Revenue is typically "Net Receipts" from DSP.
            const distFeeAmount = calc.grossRevenue * (config.distributorFeePercent / 100);

            calc.distributorFees = distFeeAmount;
            calc.netRevenue = calc.grossRevenue - distFeeAmount;

            // 2. Calculate Splits
            // indiiOS model: Splits applied to Net Revenue
            calc.contributorPayments = this.calculateSplits(calc.netRevenue, metadata.splits);

            results.push(calc);
        }

        return results;
    }

    private createEmptyCalculation(
        isrc: string,
        metadata: ExtendedGoldenMetadata,
        report: DSRReport
    ): RoyaltyCalculation & { distributorFeePercent?: number } {
        return {
            releaseId: metadata.upc || '',
            resourceId: isrc,
            isrc: isrc,
            totalStreams: 0,
            totalDownloads: 0,
            grossRevenue: 0,
            platformFees: 0,
            distributorFees: 0,
            netRevenue: 0,
            contributorPayments: [],
            period: report.reportingPeriod,
            currencyCode: report.currencyCode,
        };
    }

    private calculateSplits(netAmount: number, splits: RoyaltySplit[]): ContributorPayment[] {
        // Validate split sum (should be 100)
        const _totalPercentage = splits.reduce((sum, s) => sum + s.percentage, 0);
        // If not 100, normalize or warn? For now assume valid GoldenMetadata.

        return splits.map(split => {
            const splitAmount = netAmount * (split.percentage / 100);
            return {
                contributorId: split.email, // Use email as ID for now
                contributorName: split.legalName,
                role: split.role,
                splitPercentage: split.percentage,
                grossAmount: splitAmount, // In this context, gross for the user is their split of the net
                netAmount: splitAmount, // Tax/withholding would change this
                paymentStatus: 'pending'
            };
        });
    }
}

export const dsrProcessor = new DSRProcessor();
