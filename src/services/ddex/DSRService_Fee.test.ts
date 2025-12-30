import { describe, it, expect } from 'vitest';
import { dsrService } from './DSRService';
import { DISTRIBUTORS } from '@/core/config/distributors';
import type { DSRReport } from './types/dsr';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

describe('DSRService Fee Calculation', () => {
    it('should apply distributor fee for Symphonic (15% fee)', async () => {
        // Symphonic has 85% payout, so fee is 15%.
        // Party ID: PADPIDA2011030901S
        const symphonicPartyId = DISTRIBUTORS.symphonic.ddexPartyId;

        const mockReport: DSRReport = {
            reportId: 'RPT-SYM-001',
            senderId: symphonicPartyId,
            recipientId: 'PADPIDA',
            reportingPeriod: { startDate: '2025-01-01', endDate: '2025-01-31' },
            reportCreatedDateTime: '2025-02-01T12:00:00Z',
            currencyCode: 'USD',
            summary: {
                totalUsageCount: 1,
                totalRevenue: 100,
                currencyCode: 'USD'
            },
            transactions: [
                {
                    transactionId: 'TX-1',
                    resourceId: { isrc: 'USSYM1234567' },
                    usageType: 'Download',
                    usageCount: 1,
                    revenueAmount: 100,
                    currencyCode: 'USD',
                    territoryCode: 'US'
                }
            ]
        };

        const mockMetadata: ExtendedGoldenMetadata = {
            title: 'Symphonic Track',
            artist: 'Test Artist',
            isrc: 'USSYM1234567',
            upc: '1234567890123',
            releaseDate: '2024-01-01',
            genre: 'Pop',
            releaseType: 'Single',
            territories: ['US'],
            splits: [
                { email: 'artist@test.com', percentage: 100, role: 'Main Artist', legalName: 'Artist' }
            ],
            tracks: [],
            copyrightYear: '2024',
            copyrightOwner: 'Test Label'
        } as any;

        const catalog = new Map<string, ExtendedGoldenMetadata>();
        catalog.set('USSYM1234567', mockMetadata);

        const result = await dsrService.processReport(mockReport, catalog);

        const royalty = result.royalties[0];

        // Gross Revenue = 100
        expect(royalty.grossRevenue).toBe(100);

        // Fee should be 15% of 100 = 15
        expect(royalty.distributorFees).toBe(15);

        // Net Revenue should be 100 - 15 = 85
        expect(royalty.netRevenue).toBe(85);
    });

    it('should apply 0 fee for DistroKid (100% payout)', async () => {
        // DistroKid has 100% payout, so fee is 0%.
        const distrokidPartyId = DISTRIBUTORS.distrokid.ddexPartyId;

        const mockReport: DSRReport = {
            reportId: 'RPT-DK-001',
            senderId: distrokidPartyId,
            recipientId: 'PADPIDA',
            reportingPeriod: { startDate: '2025-01-01', endDate: '2025-01-31' },
            reportCreatedDateTime: '2025-02-01T12:00:00Z',
            currencyCode: 'USD',
            summary: {
                totalUsageCount: 1,
                totalRevenue: 100,
                currencyCode: 'USD'
            },
            transactions: [
                {
                    transactionId: 'TX-1',
                    resourceId: { isrc: 'USDK1234567' },
                    usageType: 'Download',
                    usageCount: 1,
                    revenueAmount: 100,
                    currencyCode: 'USD',
                    territoryCode: 'US'
                }
            ]
        };

        const mockMetadata: ExtendedGoldenMetadata = {
            title: 'DistroKid Track',
            artist: 'Test Artist',
            isrc: 'USDK1234567',
            splits: [{ email: 'artist@test.com', percentage: 100, role: 'Main Artist', legalName: 'Artist' }]
        } as any;

        const catalog = new Map<string, ExtendedGoldenMetadata>();
        catalog.set('USDK1234567', mockMetadata);

        const result = await dsrService.processReport(mockReport, catalog);
        const royalty = result.royalties[0];

        expect(royalty.distributorFees).toBe(0);
        expect(royalty.netRevenue).toBe(100);
    });
});
