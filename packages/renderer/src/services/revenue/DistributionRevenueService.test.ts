/**
 * DistributionRevenueService Tests
 *
 * Validates earnings aggregation across multiple distributor adapters,
 * revenue totalling, and adapter connection.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock all 3 distributor adapters using class-based mocks for proper `new` semantics
vi.mock('@/services/distribution/adapters/DistroKidAdapter', () => {
    return {
        DistroKidAdapter: class {
            id = 'distrokid' as const;
            name = 'DistroKid';
            isConnected = vi.fn().mockResolvedValue(false);
            getAllEarnings = vi.fn().mockResolvedValue([]);
            connect = vi.fn().mockResolvedValue(undefined);
        },
    };
});

vi.mock('@/services/distribution/adapters/TuneCoreAdapter', () => {
    return {
        TuneCoreAdapter: class {
            id = 'tunecore' as const;
            name = 'TuneCore';
            isConnected = vi.fn().mockResolvedValue(false);
            getAllEarnings = vi.fn().mockResolvedValue([]);
            connect = vi.fn().mockResolvedValue(undefined);
        },
    };
});

vi.mock('@/services/distribution/adapters/CDBabyAdapter', () => {
    return {
        CDBabyAdapter: class {
            id = 'cdbaby' as const;
            name = 'CD Baby';
            isConnected = vi.fn().mockResolvedValue(false);
            getAllEarnings = vi.fn().mockResolvedValue([]);
            connect = vi.fn().mockResolvedValue(undefined);
        },
    };
});

import { DistributionRevenueService } from './DistributionRevenueService';
import type { DateRange, DistributorEarnings, DistributorId, DistributorCredentials } from '@/services/distribution/types/distributor';

describe('DistributionRevenueService', () => {
    let service: DistributionRevenueService;

    const testPeriod: DateRange = {
        startDate: '2026-01-01',
        endDate: '2026-03-31',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new DistributionRevenueService();
    });

    describe('getAggregatedEarnings', () => {
        it('should return empty array when no adapters are connected', async () => {
            const earnings = await service.getAggregatedEarnings(testPeriod);

            expect(earnings).toEqual([]);
        });

        it('should aggregate earnings from a connected adapter', async () => {
            // Get DistroKid adapter and make it "connected" with earnings
            const adapters = (service as unknown as { adapters: Map<string, { isConnected: import('vitest').Mock, getAllEarnings: import('vitest').Mock, connect: import('vitest').Mock }> }).adapters;
            const dkAdapter = adapters.get('distrokid')!;

            dkAdapter.isConnected.mockResolvedValue(true);
            dkAdapter.getAllEarnings.mockResolvedValue([
                {
                    releaseId: 'release-1',
                    distributorId: 'distrokid',
                    streams: 50000,
                    downloads: 200,
                    grossRevenue: 150.0,
                    distributorFee: 0,
                    netRevenue: 150.0,
                },
                {
                    releaseId: 'release-2',
                    distributorId: 'distrokid',
                    streams: 25000,
                    downloads: 100,
                    grossRevenue: 75.0,
                    distributorFee: 0,
                    netRevenue: 75.0,
                },
            ] as DistributorEarnings[]);

            const earnings = await service.getAggregatedEarnings(testPeriod);

            expect(earnings).toHaveLength(2);

            const release1 = earnings.find(e => e.releaseId === 'release-1');
            expect(release1).toBeDefined();
            expect(release1!.totalStreams).toBe(50000);
            expect(release1!.totalNetRevenue).toBe(150.0);

            const release2 = earnings.find(e => e.releaseId === 'release-2');
            expect(release2).toBeDefined();
            expect(release2!.totalStreams).toBe(25000);
            expect(release2!.totalNetRevenue).toBe(75.0);
        });

        it('should aggregate earnings from multiple distributors for the same release', async () => {
            const adapters = (service as unknown as { adapters: Map<string, { isConnected: import('vitest').Mock, getAllEarnings: import('vitest').Mock, connect: import('vitest').Mock }> }).adapters;

            // DistroKid connected with release-1 earnings
            const dkAdapter = adapters.get('distrokid')!;
            dkAdapter.isConnected.mockResolvedValue(true);
            dkAdapter.getAllEarnings.mockResolvedValue([
                {
                    releaseId: 'release-1',
                    distributorId: 'distrokid',
                    streams: 30000,
                    downloads: 100,
                    grossRevenue: 90.0,
                    distributorFee: 0,
                    netRevenue: 90.0,
                },
            ] as DistributorEarnings[]);

            // TuneCore connected with same release-1 earnings
            const tcAdapter = adapters.get('tunecore')!;
            tcAdapter.isConnected.mockResolvedValue(true);
            tcAdapter.getAllEarnings.mockResolvedValue([
                {
                    releaseId: 'release-1',
                    distributorId: 'tunecore',
                    streams: 20000,
                    downloads: 50,
                    grossRevenue: 65.0,
                    distributorFee: 13.0,
                    netRevenue: 52.0,
                },
            ] as DistributorEarnings[]);

            const earnings = await service.getAggregatedEarnings(testPeriod);

            expect(earnings).toHaveLength(1); // Same release, merged
            const release = earnings[0]!;
            expect(release.releaseId).toBe('release-1');
            expect(release.totalStreams).toBe(50000); // 30k + 20k
            expect(release.totalDownloads).toBe(150); // 100 + 50
            expect(release.totalGrossRevenue).toBe(155.0); // 90 + 65
            expect(release.totalFees).toBe(13.0); // 0 + 13
            expect(release.totalNetRevenue).toBe(142.0); // 90 + 52
            expect(release.byDistributor).toHaveLength(2);
        });

        it('should handle adapter errors gracefully', async () => {
            const adapters = (service as unknown as { adapters: Map<string, { isConnected: import('vitest').Mock, getAllEarnings: import('vitest').Mock, connect: import('vitest').Mock }> }).adapters;
            const dkAdapter = adapters.get('distrokid')!;

            dkAdapter.isConnected.mockResolvedValue(true);
            dkAdapter.getAllEarnings.mockRejectedValue(new Error('API timeout'));

            // Should not throw, should return empty
            const earnings = await service.getAggregatedEarnings(testPeriod);
            expect(earnings).toEqual([]);
        });
    });

    describe('getTotalNetRevenue', () => {
        it('should return 0 when no adapters connected', async () => {
            const total = await service.getTotalNetRevenue(testPeriod);
            expect(total).toBe(0);
        });

        it('should sum net revenue across all releases', async () => {
            const adapters = (service as unknown as { adapters: Map<string, { isConnected: import('vitest').Mock, getAllEarnings: import('vitest').Mock, connect: import('vitest').Mock }> }).adapters;
            const dkAdapter = adapters.get('distrokid')!;
            dkAdapter.isConnected.mockResolvedValue(true);
            dkAdapter.getAllEarnings.mockResolvedValue([
                {
                    releaseId: 'r-1',
                    distributorId: 'distrokid',
                    streams: 10000,
                    downloads: 50,
                    grossRevenue: 30.0,
                    distributorFee: 0,
                    netRevenue: 30.0,
                },
                {
                    releaseId: 'r-2',
                    distributorId: 'distrokid',
                    streams: 5000,
                    downloads: 25,
                    grossRevenue: 15.0,
                    distributorFee: 0,
                    netRevenue: 15.0,
                },
            ] as DistributorEarnings[]);

            const total = await service.getTotalNetRevenue(testPeriod);
            expect(total).toBe(45.0);
        });
    });

    describe('connectDistributor', () => {
        it('should call connect on the correct adapter', async () => {
            const adapters = (service as unknown as { adapters: Map<string, { isConnected: import('vitest').Mock, getAllEarnings: import('vitest').Mock, connect: import('vitest').Mock }> }).adapters;
            const dkAdapter = adapters.get('distrokid')!;

            const creds = { apiKey: 'dk-test-key' };
            await service.connectDistributor('distrokid' as DistributorId, creds as unknown as DistributorCredentials);

            expect(dkAdapter.connect).toHaveBeenCalledWith(creds);
        });

        it('should throw for unknown distributor', async () => {
            await expect(
                service.connectDistributor('spotify' as DistributorId, {} as unknown as DistributorCredentials)
            ).rejects.toThrow('Distributor adapter not found');
        });
    });
});
