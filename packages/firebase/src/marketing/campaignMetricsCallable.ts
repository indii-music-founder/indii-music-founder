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
    /** Fans who actually reached our redirect — our own observation, not Meta's. */
    link_clicks: number;
    /** Fans who chose a streaming service and left. */
    dsp_redirects: number;
    presaves: number;
}

/**
 * Whether revenue is measurable for this artist at all.
 *
 * ROAS requires observed revenue, and for most independent artists there is
 * none to observe: streams cannot be attributed to a click, and royalties
 * arrive months later with no campaign attached. Only a connected store
 * (Shopify/Stripe) produces attributable revenue.
 *
 * The dashboard uses this to decide between showing ROAS and showing
 * cost-per-outcome. Showing a confident 0.00x ROAS to an artist whose ads are
 * working would be worse than showing nothing.
 */
export type RevenueVisibility = 'measurable' | 'no_revenue_source';

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

/**
 * Fan outcomes, read from the raw event table rather than the ad rollup.
 *
 * These are events we observed ourselves through the smart link, so they are
 * not confined to `platform IN ('facebook_ads','shopify')` the way the rollup
 * is — an organic share and a paid click both land here.
 */
const OUTCOMES_QUERY = `
    SELECT
        toString(toDate(event_time))                 AS date,
        countIf(event_type = 'link_click')           AS link_clicks,
        countIf(event_type = 'dsp_redirect')         AS dsp_redirects,
        countIf(event_type = 'presave')              AS presaves
    FROM indii_analytics.omnichannel_events
    WHERE artist_id = {artistId:String}
      AND toDate(event_time) >= today() - {rangeDays:UInt32}
    GROUP BY date
    ORDER BY date ASC
`;

/** Does this artist have any attributable revenue at all in the window? */
const REVENUE_SOURCE_QUERY = `
    SELECT count() AS sale_count
    FROM indii_analytics.omnichannel_events
    WHERE artist_id = {artistId:String}
      AND event_type = 'sale'
      AND toDate(event_time) >= today() - {rangeDays:UInt32}
`;

interface RawMetricsRow {
    date: string;
    total_spend: string | number;
    total_revenue: string | number;
    total_clicks: string | number;
    total_conversions: string | number;
}

interface RawOutcomeRow {
    date: string;
    link_clicks: string | number;
    dsp_redirects: string | number;
    presaves: string | number;
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
            const params = {
                artistId: { type: 'String' as const, value: artistId },
                rangeDays: { type: 'UInt32' as const, value: rangeDays },
            };

            const [spendRows, outcomeRows, revenueRows] = await Promise.all([
                queryWarehouse<RawMetricsRow>(METRICS_QUERY, params),
                queryWarehouse<RawOutcomeRow>(OUTCOMES_QUERY, params),
                queryWarehouse<{ sale_count: string | number }>(REVENUE_SOURCE_QUERY, params),
            ]);

            // Union of both date sets: a day can have organic link clicks with
            // no ad spend, or ad spend that produced nothing. Dropping either
            // would quietly flatter the numbers.
            const outcomesByDate = new Map(outcomeRows.map(row => [row.date, row]));
            const dates = [...new Set([
                ...spendRows.map(row => row.date),
                ...outcomeRows.map(row => row.date),
            ])].sort();

            const spendByDate = new Map(spendRows.map(row => [row.date, row]));

            const metrics: CampaignMetricsRow[] = dates.map(date => {
                const spend = spendByDate.get(date);
                const outcome = outcomesByDate.get(date);
                return {
                    date,
                    total_spend: toNumber(spend?.total_spend ?? 0),
                    total_revenue: toNumber(spend?.total_revenue ?? 0),
                    total_clicks: toNumber(spend?.total_clicks ?? 0),
                    total_conversions: toNumber(spend?.total_conversions ?? 0),
                    link_clicks: toNumber(outcome?.link_clicks ?? 0),
                    dsp_redirects: toNumber(outcome?.dsp_redirects ?? 0),
                    presaves: toNumber(outcome?.presaves ?? 0),
                };
            });

            const revenueVisibility: RevenueVisibility =
                toNumber(revenueRows[0]?.sale_count ?? 0) > 0 ? 'measurable' : 'no_revenue_source';

            return { ok: true, metrics, revenueVisibility };
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
