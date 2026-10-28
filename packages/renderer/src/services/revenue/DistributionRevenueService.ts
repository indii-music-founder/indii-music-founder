/**
 * Revenue Service
 * Aggregates earnings from connected distributors and internal analytics
 */
import {
    DistributorId,
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
import { aggregateNativeEarnings, summarizeNativeRevenue } from './aggregateNativeEarnings';

/**
 * ISSUE-1280: aggregation results carry which distributors failed to report, so a
 * partial fetch can never be mistaken for a complete one. An empty
 * `failedDistributors` means no connected distributor fetch failed; currencies remain separate.
 */
export interface AggregatedEarningsResult {
    earnings: AggregatedEarnings[];
    /** Display names of distributors whose fetch failed; their revenue is missing. */
    failedDistributors: string[];
}

export interface TotalNetRevenueResult {
    /** Null when multiple currencies cannot truthfully be combined. */
    total: number | null;
    currencyCode: string | null;
    totalsByCurrency: Record<string, number>;
    /** Fetch coverage only: true does not make mixed currencies convertible. */
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

        const earningsByRelease = aggregateNativeEarnings(flatEarnings, period);

        return { earnings: earningsByRelease, failedDistributors };
    }

    /**
     * Get Total Net Revenue for a period across all releases.
     *
     * ISSUE-1280: `complete` is false when any distributor's fetch failed, meaning
     * the reported amounts omit that distributor. Check coverage before displaying
     * a definitive revenue number. Mixed currencies produce a null
     * scalar total and explicit native totals; no implicit USD conversion is performed.
     */
    async getTotalNetRevenue(period: DateRange): Promise<TotalNetRevenueResult> {
        const { earnings, failedDistributors } = await this.getAggregatedEarnings(period);
        return {
            ...summarizeNativeRevenue(earnings),
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
