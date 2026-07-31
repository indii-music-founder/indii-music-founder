/**
 * marketingGetCampaignMetrics — the Swarm Command Center's read path.
 *
 * Serves the daily ad-performance series from the ClickHouse rollup. The
 * caller cannot name an artist: `artist_id` is pinned server-side to the
 * authenticated uid, so no request shape can read another artist's spend.
 *
 * @see warehouse/README.md
 */

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

import { validateAppCheckV2 } from '../middleware/appCheck';
import { ClickHouseError, WAREHOUSE_SECRETS, queryWarehouse } from './clickhouseClient';

/** Widest window the dashboard can request, in days. */
const MAX_RANGE_DAYS = 365;
const DEFAULT_RANGE_DAYS = 30;

export interface CampaignMetricsRow {
    date: string;
    total_spend: number;
    total_revenue: number;
    total_clicks: number;
    total_conversions: number;
}

/**
 * SummingMergeTree merges asynchronously, so unmerged parts would read as
 * duplicate rows. Re-aggregating with sum() at query time is required, not
 * belt-and-braces.
 *
 * Decimal columns come back as strings over HTTP to preserve precision; they
 * are converted once, at the edge, below.
 */
const METRICS_QUERY = `
    SELECT
        toString(date)          AS date,
        sum(total_spend)        AS total_spend,
        sum(total_revenue)      AS total_revenue,
        sum(total_clicks)       AS total_clicks,
        sum(total_conversions)  AS total_conversions
    FROM indii_analytics.daily_ad_performance_mv
    WHERE artist_id = {artistId:String}
      AND date >= today() - {rangeDays:UInt32}
    GROUP BY date
    ORDER BY date ASC
`;

interface RawMetricsRow {
    date: string;
    total_spend: string | number;
    total_revenue: string | number;
    total_clicks: string | number;
    total_conversions: string | number;
}

function toNumber(value: string | number): number {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function resolveRangeDays(raw: unknown): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_RANGE_DAYS;
    return Math.min(Math.max(Math.trunc(raw), 1), MAX_RANGE_DAYS);
}

export const marketingGetCampaignMetrics = onCall(
    {
        enforceAppCheck: false,
        secrets: WAREHOUSE_SECRETS,
        timeoutSeconds: 30,
        memory: '512MiB',
    },
    async (request: CallableRequest) => {
        validateAppCheckV2(request);

        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required.');
        }
        const artistId = request.auth.uid;
        const rangeDays = resolveRangeDays((request.data ?? {}).rangeDays);

        try {
            const rows = await queryWarehouse<RawMetricsRow>(METRICS_QUERY, {
                artistId: { type: 'String', value: artistId },
                rangeDays: { type: 'UInt32', value: rangeDays },
            });

            const metrics: CampaignMetricsRow[] = rows.map(row => ({
                date: row.date,
                total_spend: toNumber(row.total_spend),
                total_revenue: toNumber(row.total_revenue),
                total_clicks: toNumber(row.total_clicks),
                total_conversions: toNumber(row.total_conversions),
            }));

            return { ok: true, metrics };
        } catch (error) {
            if (error instanceof ClickHouseError && error.code === 'WAREHOUSE_NOT_CONFIGURED') {
                // Distinct from a query failure: the deployment has no warehouse
                // wired up yet, and the dashboard says so rather than showing $0.
                throw new HttpsError('failed-precondition', error.message);
            }
            logger.error('[marketingGetCampaignMetrics] Failed', {
                artistId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw new HttpsError('internal', 'Could not load campaign metrics.');
        }
    },
);
