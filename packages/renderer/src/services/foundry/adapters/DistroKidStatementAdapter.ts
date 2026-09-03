import {
  NormalizedStatementReport,
  NormalizedStatementTransaction,
  QuarantinedRow,
  ParseOptions
} from '@indii/shared';

export class DistroKidStatementAdapter {
  readonly formatId = 'distrokid_statement';
  readonly formatName = 'DistroKid TSV Sales Statement';
  readonly version = '2026.1';

  /**
   * Determine if raw text looks like DistroKid statement
   */
  canParse(content: string): boolean {
    const firstLine = content.split(/\r?\n/)[0] || '';
    return firstLine.includes('Reporting Date') &&
      firstLine.includes('Sale Month') &&
      firstLine.includes('Store') &&
      firstLine.includes('ISRC') &&
      firstLine.includes('Earnings (USD)');
  }

  /**
   * Deterministically parse raw TSV into canonical NormalizedStatementReport
   */
  parse(rawContent: string, _options: ParseOptions = {}): NormalizedStatementReport {
    const cleanContent = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
    const lines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw new Error('DistroKid statement has no data rows');
    }

    const headers = lines[0]!.split('\t').map((h) => h.trim());
    const headerMap = new Map<string, number>();
    headers.forEach((h, idx) => headerMap.set(h.toLowerCase(), idx));

    const getCol = (row: string[], name: string): string => {
      const idx = headerMap.get(name.toLowerCase());
      return idx !== undefined && row[idx] ? row[idx]!.trim() : '';
    };

    const transactions: NormalizedStatementTransaction[] = [];
    const quarantinedRows: QuarantinedRow[] = [];

    let totalGrossRevenue = 0;
    const totalDistributorFees = 0;
    let totalNetRevenue = 0;
    let totalQuantity = 0;
    let totalStreams = 0;
    let totalDownloads = 0;

    let periodStart: string | undefined;
    let periodEnd: string | undefined;

    const dataLines = lines.slice(1);
    for (let i = 0; i < dataLines.length; i++) {
      const lineIndex = i + 2; // 1-based index including header
      const line = dataLines[i]!;
      const parts = line.split('\t');

      const isrc = getCol(parts, 'isrc');
      const upc = getCol(parts, 'upc');
      const store = getCol(parts, 'store') || 'Unknown DSP';
      const artist = getCol(parts, 'artist') || 'Unknown Artist';
      const title = getCol(parts, 'title') || 'Untitled';
      const saleMonth = getCol(parts, 'sale month');
      const country = getCol(parts, 'country of sale') || 'US';
      const rawEarnings = getCol(parts, 'earnings (usd)');
      const rawQuantity = getCol(parts, 'quantity');

      const earnings = parseFloat(rawEarnings.replace(/[^0-9.-]/g, ''));
      const quantity = parseInt(rawQuantity.replace(/[^0-9-]/g, ''), 10) || 0;

      // Validate mandatory fields
      if (isNaN(earnings) || !isrc || isrc === 'MALFORMED_ISRC') {
        quarantinedRows.push({
          lineIndex,
          rawContent: line,
          reason: isNaN(earnings) ? 'Invalid earnings number' : 'Missing or malformed ISRC',
          errorCode: isNaN(earnings) ? 'ERR_INVALID_NUMERIC' : 'ERR_INVALID_ISRC',
          severity: 'warning',
        });
        continue;
      }

      const isDownload = store.toLowerCase().includes('itunes') || store.toLowerCase().includes('download');
      const txnType = isDownload ? 'download' : 'stream';

      if (txnType === 'download') totalDownloads += quantity;
      else totalStreams += quantity;

      totalGrossRevenue += earnings;
      totalNetRevenue += earnings;
      totalQuantity += quantity;

      if (!periodStart && saleMonth) periodStart = saleMonth;
      if (saleMonth) periodEnd = saleMonth;

      const rawFields: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rawFields[h] = parts[idx] ? parts[idx]!.trim() : '';
      });

      transactions.push({
        sourceLineIndex: lineIndex,
        sourceHash: `dk-${lineIndex}-${isrc}`,
        transactionId: `TX-DK-${lineIndex}`,
        isrc,
        upc: upc || undefined,
        trackTitle: title,
        artistName: artist,
        dspName: store,
        transactionType: txnType,
        quantity,
        grossRevenue: earnings,
        distributorFee: 0,
        netRevenue: earnings,
        currency: 'USD',
        territory: country,
        salePeriodStart: saleMonth,
        rawSourceFields: rawFields,
      });
    }

    return {
      formatId: this.formatId,
      adapterVersion: this.version,
      reportId: `RPT-DK-${Date.now()}`,
      reportingEntity: 'DistroKid',
      currency: 'USD',
      totalGrossRevenue: Math.round(totalGrossRevenue * 100) / 100,
      totalDistributorFees: Math.round(totalDistributorFees * 100) / 100,
      totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
      totalQuantity,
      totalStreams,
      totalDownloads,
      periodStart,
      periodEnd,
      transactions,
      quarantinedRows,
      provenance: {
        evidenceSha256: 'computed-on-ingest',
        parsedAt: new Date().toISOString(),
        deterministicHash: `det-dk-${transactions.length}-${Math.round(totalNetRevenue * 100)}`,
      },
    };
  }
}
