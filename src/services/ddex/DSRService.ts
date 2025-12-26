import { DDEXParser } from './DDEXParser';
import type { DSRReport } from './types/dsr';

export interface ProcessedSalesBatches {
    batchId: string;
    reportId: string;
    totalRevenue: number;
    transactionCount: number;
    processedAt: string;
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
    async processReport(report: DSRReport): Promise<ProcessedSalesBatches> {
        const summary = report.summary;

        // Logic to save individual transactions to database would go here
        // for (const txn of report.transactions) { ... }

        return {
            batchId: `BATCH-${Date.now()}`,
            reportId: report.reportId,
            totalRevenue: summary.totalRevenue,
            transactionCount: summary.totalUsageCount,
            processedAt: new Date().toISOString(),
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
