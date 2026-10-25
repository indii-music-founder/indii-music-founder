import {
  NormalizedStatementReport,
  NormalizedStatementTransaction,
  QuarantinedRow,
  ParseOptions,
} from '../types.js';
import { DecimalMoney } from '../DecimalMoney.js';
import { parseMoneyAmount } from '../parseMoney.js';
import { hashText, parseDelimitedRows, rowIdentity } from './statementRows.js';

export class TuneCoreStatementAdapter {
  // Static helpers for external callers
  static canParse(content: string): boolean {
    return new TuneCoreStatementAdapter().canParse(content);
  }

  static parse(rawContent: string, _options: ParseOptions = {}): NormalizedStatementReport {
    return new TuneCoreStatementAdapter().parse(rawContent, _options);
  }
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
    const { rows, errors } = parseDelimitedRows(rawContent, ',');
    if (rows.length < 2) throw new Error('TuneCore statement has no data rows');
    const headers = rows[0]!.values.map(h => h.trim());
    const headerMap = new Map<string, number>();
    headers.forEach((h, idx) => headerMap.set(h.toLowerCase(), idx));

    const getCol = (row: string[], name: string): string => {
      const idx = headerMap.get(name.toLowerCase());
      return idx !== undefined && row[idx] ? row[idx]!.trim() : '';
    };

    const transactions: NormalizedStatementTransaction[] = [];
    const quarantinedRows: QuarantinedRow[] = [...errors];
    const occurrences = new Map<string, number>();

    let grossAcc = DecimalMoney.zero();
    let netAcc = DecimalMoney.zero();
    let feeAcc = DecimalMoney.zero();
    let totalQuantity = 0;
    let totalStreams = 0;
    let totalDownloads = 0;

    let periodStart: string | undefined;
    let periodEnd: string | undefined;

    for (const row of rows.slice(1)) {
      const lineIndex = row.lineIndex;
      const line = row.rawContent;
      const parts = row.values;

      if (parts.length !== headers.length) {
        quarantinedRows.push({ lineIndex, rawContent: line, reason: 'Column count differs from header', errorCode: 'ERR_INCOMPLETE_ROW', severity: 'warning' });
        continue;
      }

      const isrc = getCol(parts, 'isrc');
      const upc = getCol(parts, 'upc');
      const store = getCol(parts, 'store name') || 'Unknown Store';
      const artist = getCol(parts, 'artist') || 'Unknown Artist';
      const songTitle = getCol(parts, 'song title') || 'Untitled';
      const releaseTitle = getCol(parts, 'release title');
      const salesPeriod = getCol(parts, 'sales period');
      // ISSUE-1443: no fabricated territory — empty when the column is missing.
      const country = getCol(parts, 'country') || '';
      const rawEarnings = getCol(parts, 'total earned');
      const rawQuantity = getCol(parts, 'quantity');

      const earnings = parseMoneyAmount(rawEarnings);
      // Quantities may include signed adjustments, but must be complete safe integers.
      const parsedQuantity = /^[+-]?\d+$/.test(rawQuantity) ? Number(rawQuantity) : NaN;
      const quantity = Number.isSafeInteger(parsedQuantity) ? parsedQuantity : null;

      if (earnings === null || quantity === null || !isrc || isrc === 'MALFORMED_ISRC') {
        quarantinedRows.push({
          lineIndex,
          rawContent: line,
          reason: earnings === null ? 'Invalid total earned number'
            : quantity === null ? 'Invalid quantity: expected a complete safe integer'
            : 'Missing or malformed ISRC',
          errorCode: earnings === null || quantity === null ? 'ERR_INVALID_NUMERIC' : 'ERR_INVALID_ISRC',
          severity: 'warning',
        });
        continue;
      }

      // ISSUE-1443: capture a real fee value when the statement carries one;
      // LayeredValidator's reconciliation is vacuous while fees are hardcoded to 0.
      const feeColumn = ['fee', 'distributor fee', 'commission'].find(name => headerMap.has(name));
      const rawFee = feeColumn ? getCol(parts, feeColumn) : undefined;
      const parsedFee = rawFee === undefined ? 0 : parseMoneyAmount(rawFee);
      if (parsedFee === null) {
        quarantinedRows.push({ lineIndex, rawContent: line, reason: 'Invalid distributor fee', errorCode: 'ERR_INVALID_FEE', severity: 'warning' });
        continue;
      }
      const distributorFee = parsedFee;
      const isDownload = store.toLowerCase().includes('itunes') || store.toLowerCase().includes('download');
      const txnType = isDownload ? 'download' : 'stream';

      if (txnType === 'download') totalDownloads += quantity;
      else totalStreams += quantity;

      const earningsMoney = DecimalMoney.fromFloat(earnings);
      const feeMoney = DecimalMoney.fromFloat(distributorFee);
      const grossMoney = earningsMoney.add(feeMoney);
      grossAcc = grossAcc.add(grossMoney);
      feeAcc = feeAcc.add(feeMoney);
      netAcc = netAcc.add(earningsMoney);
      totalQuantity += quantity;

      if (salesPeriod && (!periodStart || salesPeriod < periodStart)) periodStart = salesPeriod;
      if (salesPeriod && (!periodEnd || salesPeriod > periodEnd)) periodEnd = salesPeriod;

      const rawFields: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rawFields[h] = parts[idx] ? parts[idx]!.trim() : '';
      });

      const { sourceHash, transactionId } = rowIdentity(rawFields, occurrences);
      transactions.push({
        sourceLineIndex: lineIndex,
        sourceHash,
        transactionId,
        isrc,
        upc: upc || undefined,
        trackTitle: songTitle,
        artistName: artist,
        albumTitle: releaseTitle,
        dspName: store,
        transactionType: txnType,
        quantity,
        grossRevenue: grossMoney.toFloat(),
        distributorFee,
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
      reportId: `RPT-TC-${hashText(rawContent).slice(0, 40)}`,
      reportingEntity: 'TuneCore',
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
        evidenceSha256: hashText(rawContent),
        parsedAt: new Date().toISOString(),
        deterministicHash: hashText(JSON.stringify(transactions.map(transaction => transaction.sourceHash).sort())),
      },
    };
  }
}
