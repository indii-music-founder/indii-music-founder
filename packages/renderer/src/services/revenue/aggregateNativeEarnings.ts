import type { AggregatedEarnings, DateRange, DistributorEarnings } from '@/services/distribution/types/distributor';

/** No exchange-rate assumption: each release/currency pair remains independent. */
export function aggregateNativeEarnings(rows: readonly DistributorEarnings[], period: DateRange): AggregatedEarnings[] {
    const groups = new Map<string, Map<string, AggregatedEarnings>>();
    for (const row of rows) {
        if (typeof row.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(row.currencyCode)) {
            throw new Error('Cannot aggregate earnings without an explicit three-letter currency.');
        }
        if (typeof row.releaseId !== 'string' || !row.releaseId.trim()) {
            throw new Error('Cannot aggregate earnings without a release ID.');
        }
        const fields = [row.streams, row.downloads, row.grossRevenue, row.distributorFee, row.netRevenue];
        if (!fields.every(Number.isFinite)) throw new Error('Cannot aggregate nonfinite earnings.');
        let currencies = groups.get(row.releaseId);
        if (!currencies) { currencies = new Map(); groups.set(row.releaseId, currencies); }
        let group = currencies.get(row.currencyCode);
        if (!group) {
            group = {
                releaseId: row.releaseId, period, currencyCode: row.currencyCode,
                totalStreams: 0, totalDownloads: 0, totalGrossRevenue: 0, totalFees: 0, totalNetRevenue: 0,
                byDistributor: [], byPlatform: [], byTerritory: [],
            };
            currencies.set(row.currencyCode, group);
        }
        group.totalStreams += row.streams;
        group.totalDownloads += row.downloads;
        group.totalGrossRevenue += row.grossRevenue;
        group.totalFees += row.distributorFee;
        group.totalNetRevenue += row.netRevenue;
        if (![group.totalStreams, group.totalDownloads, group.totalGrossRevenue, group.totalFees, group.totalNetRevenue].every(Number.isFinite)) {
            throw new Error('Aggregated earnings exceed the finite numeric range.');
        }
        group.byDistributor.push(row);
    }
    return [...groups.values()].flatMap(currencies => [...currencies.values()]);
}

/** A scalar total exists only when all reports use one known currency. */
export function summarizeNativeRevenue(earnings: readonly AggregatedEarnings[]) {
    const totals = new Map<string, number>();
    for (const earning of earnings) {
        const value = (totals.get(earning.currencyCode) ?? 0) + earning.totalNetRevenue;
        if (!Number.isFinite(value)) throw new Error('Revenue total exceeds the finite numeric range.');
        totals.set(earning.currencyCode, value);
    }
    return {
        total: totals.size > 1 ? null : totals.size === 1 ? [...totals.values()][0]! : 0,
        currencyCode: totals.size === 1 ? [...totals.keys()][0]! : null,
        totalsByCurrency: Object.fromEntries(totals),
    };
}
