import { describe, expect, test } from 'vitest';
import { DistroKidStatementAdapter } from '../DistroKidStatementAdapter';
import { TuneCoreStatementAdapter } from '../TuneCoreStatementAdapter';

const tcHeader = 'Sales Period,Posted Date,Store Name,ISRC,Quantity,Total Earned,Fee,Song Title';
const tcRowA = '2026-01,2026-02-01,Spotify,USABC123,2,1.25,0.25,"A, Song"';
const tcRowB = '2026-02,2026-03-01,Spotify,USXYZ789,3,2.00,0.50,"Another\nSong"';

function parseTc(rows: string[]) { return TuneCoreStatementAdapter.parse([tcHeader, ...rows].join('\r\n')); }

describe('provider statement identities and reconciliation', () => {
  test('same file produces stable report and row identities', () => {
    const first = parseTc([tcRowA, tcRowB]);
    const again = parseTc([tcRowA, tcRowB]);
    expect(first.reportId).toBe(again.reportId);
    expect(first.provenance.evidenceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.transactions.map(row => row.transactionId)).toEqual(again.transactions.map(row => row.transactionId));
    expect(first.transactions[0]?.trackTitle).toBe('A, Song');
    expect(first.transactions[1]?.trackTitle).toBe('Another\nSong');
    expect(first.transactions[1]?.sourceLineIndex).toBe(3);
    expect(first.totalNetRevenue).toBe(3.25);
    expect(first.totalDistributorFees).toBe(0.75);
    expect(first.totalGrossRevenue).toBe(4);
    expect(first.transactions[0]?.grossRevenue).toBe(1.5);
  });

  test('row reorder changes file identity but preserves event identities', () => {
    const first = parseTc([tcRowA, tcRowB]);
    const reordered = parseTc([tcRowB, tcRowA]);
    expect(first.reportId).not.toBe(reordered.reportId);
    expect(first.provenance.deterministicHash).toBe(reordered.provenance.deterministicHash);
    expect(first.transactions.map(row => row.transactionId).sort())
      .toEqual(reordered.transactions.map(row => row.transactionId).sort());
  });

  test('legitimate repeated rows get distinct stable occurrence IDs', () => {
    const rows = parseTc([tcRowA, tcRowA]).transactions;
    expect(rows).toHaveLength(2);
    expect(rows[0]?.transactionId).not.toBe(rows[1]?.transactionId);
    expect(parseTc([tcRowA, tcRowA]).transactions.map(row => row.transactionId))
      .toEqual(rows.map(row => row.transactionId));
  });

  test('invalid fee and malformed quote are quarantined', () => {
    const result = parseTc([tcRowA.replace('0.25', 'not a number'), tcRowB.replace('"Another\nSong"', '"Unclosed')]);
    expect(result.transactions).toHaveLength(0);
    expect(result.quarantinedRows.map(row => row.errorCode)).toEqual(expect.arrayContaining(['ERR_INVALID_FEE', 'ERR_MALFORMED_QUOTE']));
  });

  test('DistroKid quoted tabs, fallback fee column, and strict quantity', () => {
    const header = 'Reporting Date\tSale Month\tStore\tISRC\tQuantity\tEarnings (USD)\tDistributor Fee\tTitle';
    const valid = '2026-02-01\t2026-01\tSpotify\tUSABC123\t2\t1.25\t0.25\t"A\tTitle"';
    const invalid = valid.replace('\t2\t', '\t2x\t');
    const report = DistroKidStatementAdapter.parse([header, valid, invalid].join('\n'));
    expect(report.transactions).toHaveLength(1);
    expect(report.transactions[0]?.trackTitle).toBe('A\tTitle');
    expect(report.totalGrossRevenue).toBe(1.5);
    expect(report.totalDistributorFees).toBe(0.25);
    expect(report.quarantinedRows[0]?.errorCode).toBe('ERR_INVALID_NUMERIC');
  });
});
