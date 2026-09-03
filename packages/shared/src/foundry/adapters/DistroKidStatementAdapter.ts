import {
  NormalizedStatementReport,
  NormalizedStatementTransaction,
  QuarantinedRow,
  ParseOptions,
} from '../types.js';
import { DecimalMoney } from '../DecimalMoney.js';

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

    let grossAcc = DecimalMoney.zero();
    let netAcc = DecimalMoney.zero();
    const feeAcc = DecimalMoney.zero();
    let totalQuantity = 0;
    let totalStreams = 0;
    let totalDownloads = 0;
    let periodStart: string | undefined;
    let periodEnd: string | undefined;

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]!;
      const parts = line.split('\t');

      if (parts.length < headers.length * 0.7) {
        quarantinedRows.push({
          lineIndex: lineIndex + 1,
          rawContent: line,
          reason: 'Incomplete row: column count significantly less than header',
          errorCode: 'ERR_INCOMPLETE_ROW',
          severity: 'warning',
        });
        continue;
      }

      const saleMonth = getCol(parts, 'Sale Month');
      const store = getCol(parts, 'Store');
      const artist = getCol(parts, 'Artist');
      const title = getCol(parts, 'Title');
      const isrc = getCol(parts, 'ISRC');
      const upc = getCol(parts, 'UPC');
      const quantityStr = getCol(parts, 'Quantity');
      const earningsStr = getCol(parts, 'Earnings (USD)');
      const country = getCol(parts, 'Country of Sale');

      const quantity = parseInt(quantityStr, 10) || 1;
      const earnings = parseFloat(earningsStr);

      if (isNaN(earnings) || !isrc || isrc === 'MALFORMED_ISRC') {
        quarantinedRows.push({
          lineIndex: lineIndex + 1,
          rawContent: line,
          reason: isNaN(earnings) ? `Invalid numeric value for Earnings (USD): "${earningsStr}"` : 'Missing or malformed ISRC',
          errorCode: isNaN(earnings) ? 'ERR_INVALID_EARNINGS' : 'ERR_INVALID_ISRC',
          severity: 'warning',
        });
        continue;
      }

      const isDownload = store.toLowerCase().includes('itunes') || store.toLowerCase().includes('download');
      const txnType = isDownload ? 'download' : 'stream';

      if (txnType === 'download') totalDownloads += quantity;
      else totalStreams += quantity;

      const earningsMoney = DecimalMoney.fromFloat(earnings);
      grossAcc = grossAcc.add(earningsMoney);
      netAcc = netAcc.add(earningsMoney);
      totalQuantity += quantity;

      if (!periodStart && saleMonth) periodStart = saleMonth;
      if (saleMonth) periodEnd = saleMonth;

      const rawFields: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rawFields[h] = parts[idx] ? parts[idx]!.trim() : '';
      });

      transactions.push({
        sourceLineIndex: lineIndex + 1,
        sourceHash: `dk-${lineIndex + 1}-${isrc}`,
        transactionId: `TX-DK-${lineIndex + 1}`,
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
        territory: country || 'US',
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
      totalGrossRevenue: grossAcc.toFloat(),
      totalDistributorFees: feeAcc.toFloat(),
      totalNetRevenue: netAcc.toFloat(),
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
        deterministicHash: `det-dk-${transactions.length}-${netAcc.toCents()}`,
      },
    };
  }
}
