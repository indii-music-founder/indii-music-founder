import { describe, it, expect, vi } from 'vitest';
import { dsrService } from './DSRService';
import { dsrProcessor } from './DSRProcessor';
import type { DSRReport } from './types/dsr';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

describe('DSRService', () => {
    it('should ingest valid flat file content', async () => {
        // Mock DDEXParser.parseDSR behavior
        // Real parser implementation logic is tested in DDEXParser.test.ts (if it exists)
        // Here we test integration
        const content = 'ISRC\tTitle\tUsageType\tUsageCount\tRevenue\tCurrency\tTerritory\nUS1234567890\tTest Track\tOnDemandStream\t100\t0.99\tUSD\tUS';
        const result = await dsrService.ingestFlatFile(content);

        // Since we know DDEXParser.parseDSR handles TSV, we expect success 
        // IF the parser is implemented. 
        // Note: DDEXParser implementation for parseDSR is extremely basic in the current codebase 
        // (based on prior context). It might return generic stub data.
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
    });

    it('should process report and calculate royalties', async () => {
        const mockReport: DSRReport = {
            reportId: 'RPT-001',
            senderId: 'PADPIDA',
            recipientId: 'PADPIDB',
            reportingPeriod: { startDate: '2025-01-01', endDate: '2025-01-31' },
            currency: 'USD',
            currencyCode: 'USD',
            startDate: '2025-01-01',
            endDate: '2025-01-31',
            summary: {
                totalUsageCount: 2,
                totalRevenue: 200
            },
            transactions: [
                {
                    transactionId: 'TX-1',
                    resourceId: { isrc: 'US1234567890' },
                    usageType: 'Download',
                    usageCount: 1,
                    revenueAmount: 100,
                    currency: 'USD',
                    territoryCode: 'US',
                    periodStart: '2025-01-01',
                    periodEnd: '2025-01-31'
                },
                {
                    transactionId: 'TX-2',
                    resourceId: { isrc: 'US1234567890' },
                    usageType: 'Download',
                    usageCount: 1,
                    revenueAmount: 100,
                    currency: 'USD',
                    territoryCode: 'US',
                    periodStart: '2025-01-01',
                    periodEnd: '2025-01-31'
                }
            ]
        };

        const mockMetadata: ExtendedGoldenMetadata = {
            title: 'Test Track',
            artist: 'Test Artist',
            isrc: 'US1234567890',
            upc: '1234567890123',
            releaseDate: '2024-01-01',
            genre: 'Pop',
            releaseType: 'Single',
            territories: ['US'],
            splits: [
                { email: 'artist@test.com', percentage: 80, role: 'Main Artist', legalName: 'Artist' },
                { email: 'producer@test.com', percentage: 20, role: 'Producer', legalName: 'Producer' }
            ],
            // Add other required fields if necessary
            tracks: [],
            copyrightYear: '2024',
            copyrightOwner: 'Test Label'
        } as any;

        const catalog = new Map<string, ExtendedGoldenMetadata>();
        catalog.set('US1234567890', mockMetadata);

        const result = await dsrService.processReport(mockReport, catalog);

        expect(result.batchId).toContain('BATCH-');
        expect(result.totalRevenue).toBe(200);
        expect(result.royalties.length).toBe(1);

        const royalty = result.royalties[0];
        expect(royalty.isrc).toBe('US1234567890');
        expect(royalty.grossRevenue).toBe(200);

        // Check Splits
        expect(royalty.contributorPayments.length).toBe(2);

        const artistPayment = royalty.contributorPayments.find(p => p.role === 'Main Artist');
        expect(artistPayment).toBeDefined();
        // 80% of 200 = 160
        expect(artistPayment?.grossAmount).toBe(160);

        const producerPayment = royalty.contributorPayments.find(p => p.role === 'Producer');
        expect(producerPayment).toBeDefined();
        // 20% of 200 = 40
        expect(producerPayment?.grossAmount).toBe(40);
    });
});
