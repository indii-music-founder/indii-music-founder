import {
  NormalizedStatementReport,
  NormalizedStatementTransaction,
  QuarantinedRow,
  ParseOptions
} from '@indii/shared';

export class TuneCoreStatementAdapter {
  readonly formatId = 'tunecore_statement';
  readonly formatName = 'TuneCore CSV Sales Statement';
  readonly version = '2026.1';

  canParse(content: string): boolean {
    const firstLine = content.split(/\r?\n/)[0] || '';
    return firstLine.includes('Sales Period') &&
      firstLine.includes('Posted Date') &&
      firstLine.includes('Store Name') &&
      firstLine.includes('Total Earned');
  }

  parse(rawContent: string, _options: ParseOptions = {}): NormalizedStatementReport {
    const cleanContent = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
    const lines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw new Error('TuneCore statement has no data rows');
    }

    const headers = lines[0]!.split(',').map((h) => h.trim());
    const headerMap = new Map<string, number>();
    headers.forEach((h, idx) => headerMap.set(h.toLowerCase(), idx));

    const getCol = (row: string[], name: string): string => {
      const idx = headerMap.get(name.toLowerCase());
      return idx !== undefined && row[idx] ? row[idx]!.trim() : '';
    };

    const transactions: NormalizedStatementTransaction[] = [];
    const quarantinedRows: QuarantinedRow[] = [];

    let totalGrossRevenue = 0;
    let totalNetRevenue = 0;
    let totalQuantity = 0;
    let totalStreams = 0;
    let totalDownloads = 0;

    let periodStart: string | undefined;
    let periodEnd: string | undefined;

    const dataLines = lines.slice(1);
    for (let i = 0; i < dataLines.length; i++) {
      const lineIndex = i + 2;
      const line = dataLines[i]!;
      const parts = line.split(',');

      const isrc = getCol(parts, 'isrc');
      const upc = getCol(parts, 'upc');
      const store = getCol(parts, 'store name') || 'Unknown Store';
      const artist = getCol(parts, 'artist') || 'Unknown Artist';
      const releaseTitle = getCol(parts, 'release title');
      const songTitle = getCol(parts, 'song title') || releaseTitle || 'Untitled';
      const salesPeriod = getCol(parts, 'sales period');
      const country = getCol(parts, 'country of sale') || 'US';
      const rawEarned = getCol(parts, 'total earned');
      const rawQuantity = getCol(parts, 'quantity');

      const earnings = parseFloat(rawEarned.replace(/[^0-9.-]/g, ''));
      const quantity = parseInt(rawQuantity.replace(/[^0-9-]/g, ''), 10) || 0;

      if (isNaN(earnings) || !isrc) {
        quarantinedRows.push({
          lineIndex,
          rawContent: line,
          reason: isNaN(earnings) ? 'Invalid earned amount' : 'Missing ISRC',
          errorCode: isNaN(earnings) ? 'ERR_INVALID_NUMERIC' : 'ERR_MISSING_ISRC',
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

      if (!periodStart && salesPeriod) periodStart = salesPeriod;
      if (salesPeriod) periodEnd = salesPeriod;

      const rawFields: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rawFields[h] = parts[idx] ? parts[idx]!.trim() : '';
      });

      transactions.push({
        sourceLineIndex: lineIndex,
        sourceHash: `tc-${lineIndex}-${isrc}`,
        transactionId: `TX-TC-${lineIndex}`,
        isrc,
        upc: upc || undefined,
        trackTitle: songTitle,
        artistName: artist,
        albumTitle: releaseTitle,
        dspName: store,
        transactionType: txnType,
        quantity,
        grossRevenue: earnings,
        distributorFee: 0,
        netRevenue: earnings,
        currency: 'USD',
        territory: country,
        salePeriodStart: salesPeriod,
        rawSourceFields: rawFields,
      });
    }

    return {
      formatId: this.formatId,
      adapterVersion: this.version,
      reportId: `RPT-TC-${Date.now()}`,
      reportingEntity: 'TuneCore',
      currency: 'USD',
      totalGrossRevenue: Math.round(totalGrossRevenue * 100) / 100,
      totalDistributorFees: 0,
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
        deterministicHash: `det-tc-${transactions.length}-${Math.round(totalNetRevenue * 100)}`,
      },
    };
  }
}
