import { IngestionParser } from './IngestionParser';
import type { EarningsReportReport, RoyaltyCalculation } from './types/dsr';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { DISTRIBUTORS } from '@/core/config/distributors';
import { DistributorService } from '@/services/distribution/DistributorService';
import type { DistributorId } from '@/services/distribution/types/distributor';

export interface ProcessedSalesBatches {
    batchId: string;
    reportId: string;
    totalRevenue: number;
    transactionCount: number;
    processedAt: string;
    royalties: RoyaltyCalculation[];
}

/**
 * EarningsReport Service
 * Manages ingestion and processing of Digital Sales Reports (EarningsReport)
 */
export class EarningsReportService {
    /**
     * Ingest a flat-file EarningsReport
     */
    async ingestFlatFile(content: string): Promise<{ success: boolean; data?: EarningsReportReport; error?: string }> {
        // Use the parser to convert flat file to structured EarningsReport object
        return IngestionParser.parseEarningsReport(content);
    }

    /**
     * Process a EarningsReport report and calculate earnings summary
     * In a real app, this would likely write to a database
     */
    async processReport(
        report: EarningsReportReport,
        catalog: Map<string, ExtendedGoldenMetadata>
    ): Promise<ProcessedSalesBatches> {
        const summary = report.summary;

        // Determine Distributor Fee from Config
        let distributorFeePercent = 0;

        // Find distributor by Ingestion Party ID
        const distributorKey = Object.keys(DISTRIBUTORS).find(
            key => DISTRIBUTORS[key]!.systemIdentifier === report.senderId
        );

        if (distributorKey) {
            const adapter = DistributorService.getAdapter(distributorKey as DistributorId);
            if (adapter) {
                const payoutPercentage = adapter.requirements.pricing.payoutPercentage;
                // If payout is 85%, fee is 15%
                distributorFeePercent = Math.max(0, 100 - payoutPercentage);
            }
        }

        // Calculate Royalties (placeholder — full calculation in EarningsService)
        // In a real scenario, this would fetch detailed config from DB
        const royalties: RoyaltyCalculation[] = [];

        // indii Phase 4: Persist processed earnings to Firestore
        const { earningsService } = await import('@/services/distribution/EarningsService');

        // Find distributorId from mapping
        const distributorId = (distributorKey || 'unknown') as DistributorId;

        // Group royalties by release to create DistributorEarnings records
        for (const calc of royalties) {
            await earningsService.recordEarnings({
                distributorId,
                releaseId: calc.releaseId,
                period: {
                    startDate: calc.period.startDate,
                    endDate: calc.period.endDate || new Date().toISOString()
                },
                streams: calc.totalStreams,
                downloads: calc.totalDownloads,
                grossRevenue: calc.grossRevenue,
                distributorFee: calc.distributorFees,
                netRevenue: calc.netRevenue,
                currencyCode: calc.currencyCode,
                matchedReleases: 1, // Individual record per release
                unmatchedISRCs: []
            });
        }

        return {
            batchId: `BATCH-${Date.now()}`,
            reportId: report.reportId,
            totalRevenue: summary.totalRevenue,
            transactionCount: summary.totalUsageCount,
            processedAt: new Date().toISOString(),
            royalties
        };
    }

    /**
     * Aggregate revenue by territory from a report
     */
    getRevenueByTerritory(report: EarningsReportReport): Record<string, number> {
        const revenueMap: Record<string, number> = {};

        report.transactions.forEach((txn) => {
            const territory = txn.territoryCode;
            revenueMap[territory] = (revenueMap[territory] || 0) + txn.revenueAmount;
        });

        return revenueMap;
    }

    /**
     * Aggregate revenue by DSP (Service Name)
     */
    getRevenueByService(report: EarningsReportReport): Record<string, number> {
        const serviceMap: Record<string, number> = {};

        report.transactions.forEach((txn) => {
            const service = txn.serviceName || 'Unknown';
            serviceMap[service] = (serviceMap[service] || 0) + txn.revenueAmount;
        });

        return serviceMap;
    }
}

export const earningsReportService = new EarningsReportService();
