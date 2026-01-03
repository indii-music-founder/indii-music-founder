/**
 * Revenue Service
 * Aggregates earnings from connected distributors and internal analytics
 */
import {
    DistributorId,
    DistributorEarnings,
    AggregatedEarnings,
    DateRange,
    IDistributorAdapter
} from '@/services/distribution/types/distributor';

// Import Adapters
import { DistroKidAdapter } from '@/services/distribution/adapters/DistroKidAdapter';
import { TuneCoreAdapter } from '@/services/distribution/adapters/TuneCoreAdapter';
import { CDBabyAdapter } from '@/services/distribution/adapters/CDBabyAdapter';

export class RevenueService {
    private adapters: Map<DistributorId, IDistributorAdapter>;

    constructor() {
        this.adapters = new Map();
        // Initialize adapters
        this.registerAdapter(new DistroKidAdapter());
        this.registerAdapter(new TuneCoreAdapter());
        this.registerAdapter(new CDBabyAdapter());
    }

    private registerAdapter(adapter: IDistributorAdapter) {
        this.adapters.set(adapter.id, adapter);
    }

    /**
     * Fetch and aggregate earnings from all connected distributors for a given period
     */
    async getAggregatedEarnings(period: DateRange): Promise<AggregatedEarnings[]> {
        const connectedAdapters = Array.from(this.adapters.values());
        // In a real app, we'd filter by await adapter.isConnected()

        const allEarningsPromises = connectedAdapters.map(async (adapter) => {
            try {
                // Mock: assume connected for demo if needed, or check
                if (await adapter.isConnected()) {
                    return await adapter.getAllEarnings(period);
                }
                // Return empty if not connected to avoid breaking the flow
                return [];
            } catch (e) {
                console.error(`Failed to fetch earnings from ${adapter.name}`, e);
                return [];
            }
        });

        const results = await Promise.all(allEarningsPromises);
        const flatEarnings = results.flat();

        // Group by Release ID
        const groupedByRelease = flatEarnings.reduce((acc, earning) => {
            if (!acc[earning.releaseId]) {
                acc[earning.releaseId] = [];
            }
            acc[earning.releaseId].push(earning);
            return acc;
        }, {} as Record<string, DistributorEarnings[]>);

        // Aggregate per Release
        return Object.entries(groupedByRelease).map(([releaseId, earnings]) => {
            const initial: AggregatedEarnings = {
                releaseId,
                period,
                totalStreams: 0,
                totalDownloads: 0,
                totalGrossRevenue: 0,
                totalFees: 0,
                totalNetRevenue: 0,
                currencyCode: 'USD', // Simplified for demo
                byDistributor: earnings,
                byPlatform: [], // Would need breakdown logic
                byTerritory: [] // Would need breakdown logic
            };

            return earnings.reduce((acc, curr) => {
                acc.totalStreams += curr.streams;
                acc.totalDownloads += curr.downloads;
                acc.totalGrossRevenue += curr.grossRevenue;
                acc.totalFees += curr.distributorFee;
                acc.totalNetRevenue += curr.netRevenue;
                return acc;
            }, initial);
        });
    }

    /**
     * Get Total Net Revenue for a period across all releases
     */
    async getTotalNetRevenue(period: DateRange): Promise<number> {
        const aggregated = await this.getAggregatedEarnings(period);
        return aggregated.reduce((sum, item) => sum + item.totalNetRevenue, 0);
    }

    /**
     * Mock: Connect an adapter for testing/demo purposes
     */
    async connectDistributor(id: DistributorId): Promise<void> {
        const adapter = this.adapters.get(id);
        if (adapter) {
            await adapter.connect({ username: 'demo', password: 'demo' }); // Mock creds
        }
    }
}

export const revenueService = new RevenueService();
