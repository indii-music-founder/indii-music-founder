import { describe, expect, it } from 'vitest';
import type { NormalizedStatementReport } from '@indii/shared/dist/foundry/types.js';
import { sanitizeEarningsReport } from '../ingestEarningsReport';
import { mapNormalizedStatementToEarningsReport } from '../normalizedStatementMapper';
import { DistroKidStatementAdapter, TuneCoreStatementAdapter } from '../adapters';

function makeStatement(overrides: Partial<NormalizedStatementReport> = {}): NormalizedStatementReport {
  return {
    formatId: 'distrokid_statement',
    adapterVersion: '2026.1',
    reportId: 'parser-id-is-not-stable',
    reportingEntity: 'DistroKid',
    currency: 'USD',
    totalGrossRevenue: 12.5,
    totalDistributorFees: 0,
    totalNetRevenue: 12.5,
    totalQuantity: 10,
    totalStreams: 10,
    totalDownloads: 0,
    periodStart: 'Jan',
    periodEnd: 'Jan',
    transactions: [{
      sourceLineIndex: 2,
      sourceHash: 'row-2',
      transactionId: 'TX-DK-2',
      isrc: 'USABC2200001',
      trackTitle: 'Song',
      artistName: 'Artist',
      dspName: 'Spotify',
      transactionType: 'stream',
      quantity: 10,
      grossRevenue: 12.5,
      distributorFee: 0,
      netRevenue: 12.5,
      currency: 'USD',
      territory: '',
      salePeriodStart: 'Jan',
      rawSourceFields: { 'Reporting Date': '2022-01-15' },
    }],
    quarantinedRows: [],
    provenance: {
      evidenceSha256: 'sha256',
      parsedAt: '2022-02-01T00:00:00.000Z',
      deterministicHash: 'hash',
    },
    ...overrides,
  };
}

describe('mapNormalizedStatementToEarningsReport', () => {
  it('accepts a real DistroKid TSV parse through ledger validation', () => {
    const source = [
      'Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale',
      '2022-01-15\tJan\tSpotify\tArtist\tSong\tUSABC2200001\t123456789012\t10\t12.50\tUS',
    ].join('\n');
    const parsed = DistroKidStatementAdapter.parse(source);
    const mapped = mapNormalizedStatementToEarningsReport(parsed, source);

    expect(sanitizeEarningsReport(mapped).transactions).toHaveLength(1);
    expect(mapped.reportingPeriod).toEqual({ startDate: '2022-01-01', endDate: '2022-01-31' });
  });

  it('accepts a real TuneCore CSV parse through ledger validation', () => {
    const source = [
      'Sales Period,Posted Date,Store Name,ISRC,UPC,Artist,Song Title,Release Title,Country,Quantity,Total Earned',
      '2022-01,2022-02-15,Spotify,USABC2200001,123456789012,Artist,Song,Release,US,10,12.50',
    ].join('\n');
    const parsed = TuneCoreStatementAdapter.parse(source);
    const mapped = mapNormalizedStatementToEarningsReport(parsed, source);

    expect(sanitizeEarningsReport(mapped).transactions).toHaveLength(1);
    expect(mapped.reportingPeriod).toEqual({ startDate: '2022-01-01', endDate: '2022-01-31' });
  });

  it('maps distributor fields into the validated ledger contract and uses stable import identity', () => {
    const source = 'same uploaded report';
    const mapped = mapNormalizedStatementToEarningsReport(makeStatement(), source);

    expect(mapped).toEqual(expect.objectContaining({
      reportId: mapNormalizedStatementToEarningsReport(makeStatement(), source).reportId,
      senderId: 'PADPIDA2013021901W',
      recipientId: 'PA-DPIDA-INDII',
      reportingPeriod: { startDate: '2022-01-01', endDate: '2022-01-31' },
    }));
    expect(mapped.transactions[0]).toEqual(expect.objectContaining({
      usageType: 'OnDemandStream',
      territoryCode: 'ZZ',
      currencyCode: 'USD',
    }));
    expect(() => sanitizeEarningsReport(mapped)).not.toThrow();
    expect(mapNormalizedStatementToEarningsReport(makeStatement(), source).reportId)
      .not.toBe(mapNormalizedStatementToEarningsReport(makeStatement(), 'different file').reportId);
  });

  it('maps downloads and honors a configured recipient party ID', () => {
    const statement = makeStatement({
      reportingEntity: 'TuneCore',
      periodStart: '2022-01',
      periodEnd: '2022-01',
      transactions: [{
        ...makeStatement().transactions[0]!,
        transactionType: 'download',
        territory: 'US',
        salePeriodStart: '2022-01',
      }],
    });

    const mapped = mapNormalizedStatementToEarningsReport(statement, 'report', 'configured-party');
    expect(mapped.senderId).toBe('PADPIDA2009090203U');
    expect(mapped.recipientId).toBe('configured-party');
    expect(mapped.transactions[0]?.usageType).toBe('Download');
    expect(sanitizeEarningsReport(mapped).reportingPeriod.endDate).toBe('2022-01-31');
  });

  it('rejects a month-only period when no source date can supply its year', () => {
    const statement = makeStatement({
      transactions: [{ ...makeStatement().transactions[0]!, rawSourceFields: {} }],
    });
    expect(() => mapNormalizedStatementToEarningsReport(statement, 'report')).toThrow(/calendar year and month/);
  });
});
