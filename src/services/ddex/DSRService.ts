import { DDEXParser } from './DDEXParser';
import { dsrProcessor } from './DSRProcessor';
import type { DSRReport, RoyaltyCalculation } from './types/dsr';
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
 * DSR Service
 * Manages ingestion and processing of Digital Sales Reports (DSR)
 */
export class DSRService {
    /**
     * Ingest a flat-file DSR
     */
    async ingestFlatFile(content: string): Promise<{ success: boolean; data?: DSRReport; error?: string }> {
        // Use the parser to convert flat file to structured DSR object
        return DDEXParser.parseDSR(content);
    }

    /**
     * Process a DSR report and calculate earnings summary
     * In a real app, this would likely write to a database
     */
    async processReport(
        report: DSRReport,
        catalog: Map<string, ExtendedGoldenMetadata>
    ): Promise<ProcessedSalesBatches> {
        const summary = report.summary;

        // Determine Distributor Fee from Config
        let distributorFeePercent = 0;

        // Find distributor by DDEX Party ID
        const distributorKey = Object.keys(DISTRIBUTORS).find(
            key => DISTRIBUTORS[key].ddexPartyId === report.senderId
        );

        if (distributorKey) {
            const adapter = DistributorService.getAdapter(distributorKey as DistributorId);
            if (adapter) {
                const payoutPercentage = adapter.requirements.pricing.payoutPercentage;
                // If payout is 85%, fee is 15%
                distributorFeePercent = Math.max(0, 100 - payoutPercentage);
            }
        }

        // Calculate Royalties via Processor
        // In a real scenario, we might fetch config from DB
        const royalties = await dsrProcessor.calculateRoyalties(report, catalog, {
            distributorFeePercent,
            platformFeePercent: 0
        });

        // Here we would stick the results into a database
        // await db.royalties.insertMany(royalties);

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
    getRevenueByTerritory(report: DSRReport): Record<string, number> {
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
    getRevenueByService(report: DSRReport): Record<string, number> {
        const serviceMap: Record<string, number> = {};

        report.transactions.forEach((txn) => {
            const service = txn.serviceName || 'Unknown';
            serviceMap[service] = (serviceMap[service] || 0) + txn.revenueAmount;
        });

        return serviceMap;
    }
}

export const dsrService = new DSRService();
