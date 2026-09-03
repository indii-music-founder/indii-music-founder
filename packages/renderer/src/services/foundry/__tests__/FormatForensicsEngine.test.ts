import { describe, it, expect } from 'vitest';
import { FormatForensicsEngine } from '../FormatForensicsEngine';

describe('FormatForensicsEngine', () => {
  it('should detect DistroKid TSV format, delimiter, and column semantics', () => {
    const tsvContent = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale\n2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t14500\t55.10\tUS`;

    const report = FormatForensicsEngine.analyze('distrokid_test', tsvContent);

    expect(report.container).toBe('flat_delimited');
    expect(report.delimiter).toBe('tab');
    expect(report.detectedFormatFamily).toBe('distrokid_statement');
    expect(report.totalRowsObserved).toBe(2);
    expect(report.columnCount).toBe(10);

    const isrcCol = report.columns.find((c) => c.rawHeader === 'ISRC');
    expect(isrcCol).toBeDefined();
    expect(isrcCol?.inferredSemantic).toBe('isrc');

    const earningsCol = report.columns.find((c) => c.rawHeader === 'Earnings (USD)');
    expect(earningsCol).toBeDefined();
    expect(earningsCol?.inferredSemantic).toBe('currency_amount');
  });

  it('should detect TuneCore CSV format, delimiter, and column semantics', () => {
    const csvContent = `Sales Period,Posted Date,Store Name,Country Of Sale,Artist,Release Title,Song Title,ISRC,UPC,Quantity,Total Earned\n2026-03,2026-04-18,Spotify,US,KIRA NOVA,Velvet Voltage,Velvet Voltage,US-IND-26-00001,8847243739548,8200,31.16`;

    const report = FormatForensicsEngine.analyze('tunecore_test', csvContent);

    expect(report.container).toBe('flat_delimited');
    expect(report.delimiter).toBe('comma');
    expect(report.detectedFormatFamily).toBe('tunecore_statement');
    expect(report.totalRowsObserved).toBe(2);
    expect(report.columnCount).toBe(11);

    const storeCol = report.columns.find((c) => c.rawHeader === 'Store Name');
    expect(storeCol).toBeDefined();
    expect(storeCol?.inferredSemantic).toBe('dsp_name');
  });

  it('should recognize structured XML declarations', () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?><ern:NewReleaseMessage xmlns:ern="http://ddex.net/xml/ern/43"></ern:NewReleaseMessage>`;
    const report = FormatForensicsEngine.analyze('xml_test', xmlContent);

    expect(report.container).toBe('structured_xml');
    expect(report.identifiedSignatures).toContain('XML-DECLARATION');
  });
});
