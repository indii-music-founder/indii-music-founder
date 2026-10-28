import { describe, expect, it } from 'vitest';
import type { DistributorEarnings } from '@/services/distribution/types/distributor';
import { aggregateNativeEarnings, summarizeNativeRevenue } from './aggregateNativeEarnings';

// Pure arithmetic inputs only; no adapter, network, auth, or persisted customer doubles.
const period = { startDate: '2026-01-01', endDate: '2026-01-31' };
function row(currencyCode: string, netRevenue: number, releaseId = 'release'): DistributorEarnings {
    return { distributorId: 'distrokid', releaseId, period, currencyCode, streams: 2, downloads: 1,
        grossRevenue: netRevenue + 1, distributorFee: 1, netRevenue, lastUpdated: '2026-02-01' };
}

describe('native currency earnings', () => {
    it('keeps different currencies on the same release separate', () => {
        const result = aggregateNativeEarnings([row('USD', 10), row('EUR', 20), row('USD', 5)], period);
        expect(result.map(r => [r.currencyCode, r.totalNetRevenue])).toEqual([['USD', 15], ['EUR', 20]]);
        expect(result[0]?.totalFees).toBe(2);
        expect(result[0]?.totalGrossRevenue).toBe(17);
        expect(result[0]?.totalStreams).toBe(4);
        expect(result[0]?.byDistributor).toHaveLength(2);
    });
    it('withholds a scalar total across mixed currencies and releases', () => {
        expect(summarizeNativeRevenue(aggregateNativeEarnings([row('USD', 10), row('EUR', 20, 'other')], period)))
            .toEqual({ total: null, currencyCode: null, totalsByCurrency: { USD: 10, EUR: 20 } });
    });
    it('reports a single non-USD currency without relabeling it', () => {
        expect(summarizeNativeRevenue(aggregateNativeEarnings([row('EUR', 10), row('EUR', -3, 'other')], period)))
            .toEqual({ total: 7, currencyCode: 'EUR', totalsByCurrency: { EUR: 7 } });
    });
    it('does not invent a currency for an empty result', () => {
        expect(summarizeNativeRevenue([])).toEqual({ total: 0, currencyCode: null, totalsByCurrency: {} });
    });
    it.each(['__proto__', 'constructor', 'toString', 'a:b'])('handles opaque release ID %s safely', releaseId => {
        const input = row('USD', 2, releaseId);
        expect(aggregateNativeEarnings([input], period)[0]?.releaseId).toBe(releaseId);
        expect(input.netRevenue).toBe(2);
    });
    it.each(['', 'usd', 'US', 'USD ', undefined])('rejects absent or malformed currency %s', currency => {
        expect(() => aggregateNativeEarnings([row(currency as string, 2)], period)).toThrow(/currency/);
    });
    it.each([NaN, Infinity, -Infinity])('rejects nonfinite monetary input %s', amount => {
        expect(() => aggregateNativeEarnings([row('USD', amount)], period)).toThrow(/nonfinite/);
    });
    it('rejects overflow instead of emitting an infinite total', () => {
        expect(() => aggregateNativeEarnings([row('USD', Number.MAX_VALUE), row('USD', Number.MAX_VALUE)], period)).toThrow(/finite/);
        const groups = aggregateNativeEarnings([row('USD', Number.MAX_VALUE), row('USD', Number.MAX_VALUE, 'other')], period);
        expect(() => summarizeNativeRevenue(groups)).toThrow(/finite/);
    });
    it('rejects missing release identity', () => {
        expect(() => aggregateNativeEarnings([row('USD', 2, '')], period)).toThrow(/release ID/);
    });
});
