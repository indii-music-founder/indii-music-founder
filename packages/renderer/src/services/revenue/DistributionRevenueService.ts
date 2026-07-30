/**
 * Revenue Service
 * Aggregates earnings from connected distributors and internal analytics
 */
import {
    DistributorId,
    DistributorEarnings,
    AggregatedEarnings,
    DateRange,
    DistributorAdapter,
    DistributorCredentials
} from '@/services/distribution/types/distributor';

// Import Adapters
import { DistroKidAdapter } from '@/services/distribution/adapters/DistroKidAdapter';
import { TuneCoreAdapter } from '@/services/distribution/adapters/TuneCoreAdapter';
import { CDBabyAdapter } from '@/services/distribution/adapters/CDBabyAdapter';
import { logger } from '@/utils/logger';

/**
 * ISSUE-1280: aggregation results carry which distributors failed to report, so a
 * partial fetch can never be mistaken for a complete one. An empty
 * `failedDistributors` means the figures are whole.
 */
export interface AggregatedEarningsResult {
    earnings: AggregatedEarnings[];
    /** Display names of distributors whose fetch failed; their revenue is missing. */
    failedDistributors: string[];
}

export interface TotalNetRevenueResult {
    total: number;
    /** False when at least one distributor failed — `total` is then an understatement. */
    complete: boolean;
    failedDistributors: string[];
}

export class DistributionRevenueService {
    private adapters: Map<DistributorId, DistributorAdapter>;

    constructor() {
        this.adapters = new Map();
        // Initialize adapters
        this.registerAdapter(new DistroKidAdapter());
        this.registerAdapter(new TuneCoreAdapter());
        this.registerAdapter(new CDBabyAdapter());
    }

    private registerAdapter(adapter: DistributorAdapter) {
        this.adapters.set(adapter.id, adapter);
    }

    /**
     * Fetch and aggregate earnings from all connected distributors for a given period.
     *
     * ISSUE-1280: a failing distributor used to be swallowed into `[]`, so a transient
     * outage at one distributor silently produced a LOWER total that was
     * indistinguishable from "that distributor genuinely earned nothing". The result
     * now carries `failedDistributors`, and callers displaying money are expected to
     * disclose partial data rather than presenting an understated figure as complete.
     */
    async getAggregatedEarnings(period: DateRange): Promise<AggregatedEarningsResult> {
        const connectedAdapters = Array.from(this.adapters.values());
        const failedDistributors: string[] = [];

        const allEarningsPromises = connectedAdapters.map(async (adapter) => {
            try {
                if (await adapter.isConnected()) {
                    return await adapter.getAllEarnings(period);
                }
                return [];
            } catch (e: unknown) {
                logger.error(`Failed to fetch earnings from ${adapter.name}`, e);
                failedDistributors.push(adapter.name);
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
            acc[earning.releaseId]!.push(earning);
            return acc;
        }, {} as Record<string, DistributorEarnings[]>);

        // Aggregate per Release
        const earningsByRelease = Object.entries(groupedByRelease).map(([releaseId, earnings]) => {
            const initial: AggregatedEarnings = {
                releaseId,
                period,
                totalStreams: 0,
                totalDownloads: 0,
                totalGrossRevenue: 0,
                totalFees: 0,
                totalNetRevenue: 0,
                currencyCode: 'USD',
                byDistributor: earnings,
                byPlatform: [],
                byTerritory: []
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

        return { earnings: earningsByRelease, failedDistributors };
    }

    /**
     * Get Total Net Revenue for a period across all releases.
     *
     * ISSUE-1280: `complete` is false when any distributor's fetch failed, meaning
     * `total` is an UNDERSTATEMENT rather than a real figure. Never render this as a
     * definitive revenue number without checking it.
     */
    async getTotalNetRevenue(period: DateRange): Promise<TotalNetRevenueResult> {
        const { earnings, failedDistributors } = await this.getAggregatedEarnings(period);
        return {
            total: earnings.reduce((sum, item) => sum + item.totalNetRevenue, 0),
            complete: failedDistributors.length === 0,
            failedDistributors,
        };
    }

    /**
     * Connect an adapter - requires valid credentials
     */
    async connectDistributor(id: DistributorId, creds: DistributorCredentials): Promise<void> {
        const adapter = this.adapters.get(id);
        if (adapter) {
            await adapter.connect(creds);
        } else {
            throw new Error(`Distributor adapter not found: ${id}`);
        }
    }
}

export const distributionRevenueService = new DistributionRevenueService();
