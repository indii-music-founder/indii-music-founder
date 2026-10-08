import { describe, test, expect } from 'vitest';
import { DistroKidStatementAdapter } from '../DistroKidStatementAdapter';
import { TuneCoreStatementAdapter } from '../TuneCoreStatementAdapter';

describe('Adapter static helpers', () => {
  test('DistroKid canParse true on minimal TSV', () => {
    const sample = `Reporting Date\tSale Month\tStore\tISRC\tEarnings (USD)\n2022-01-01\tJan\tSpotify\tUS-ABC-12345\t10.00`;
    expect(DistroKidStatementAdapter.canParse(sample)).toBe(true);
  });

  test('TuneCore canParse true on minimal CSV', () => {
    const sample = `Sales Period,Posted Date,Store Name,Total Earned\n2022-01,2022-01-15,Spotify,10.00`;
    expect(TuneCoreStatementAdapter.canParse(sample)).toBe(true);
  });

  test('DistroKid parse returns report', () => {
    const sample = `Reporting Date\tSale Month\tStore\tISRC\tEarnings (USD)\n2022-01-01\tJan\tSpotify\tUS-ABC-12345\t10.00`;
    const report = DistroKidStatementAdapter.parse(sample);
    expect(report).toHaveProperty('transactions');
    expect(report.transactions.length).toBeGreaterThan(0);
  });

  test('TuneCore parse returns report', () => {
    const sample = `Sales Period,Posted Date,Store Name,ISRC,Quantity,Total Earned\n2022-01,2022-01-15,Spotify,US-ABC-12345,100,10.00`;
    const report = TuneCoreStatementAdapter.parse(sample);
    expect(report).toHaveProperty('transactions');
    expect(report.transactions.length).toBeGreaterThan(0);
    expect(report.quarantinedRows).toHaveLength(0);
    expect(report.transactions[0]?.quantity).toBe(100);
  });
});
