import {
  NormalizedStatementReport,
  NormalizedStatementTransaction,
  QuarantinedRow,
  ParseOptions,
} from '../types.js';
import { DecimalMoney } from '../DecimalMoney.js';
import { parseMoneyAmount } from '../parseMoney.js';
import { hashText, parseDelimitedRows, rowIdentity } from './statementRows.js';

export class DistroKidStatementAdapter {
  // Static helpers for external callers
  static canParse(content: string): boolean {
    return new DistroKidStatementAdapter().canParse(content);
  }

  static parse(rawContent: string, _options: ParseOptions = {}): NormalizedStatementReport {
    return new DistroKidStatementAdapter().parse(rawContent, _options);
  }
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
    const { rows, errors } = parseDelimitedRows(rawContent, '\t');
    if (rows.length < 2) throw new Error('DistroKid statement has no data rows');
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
        quarantinedRows.push({
          lineIndex,
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

      const parsedQuantity = !headerMap.has('quantity') ? 1 : /^[+-]?\d+$/.test(quantityStr) ? Number(quantityStr) : NaN;
      const quantity = Number.isSafeInteger(parsedQuantity) ? parsedQuantity : null;
      const earnings = parseMoneyAmount(earningsStr);

      if (earnings === null || quantity === null || !isrc || isrc === 'MALFORMED_ISRC') {
        quarantinedRows.push({
          lineIndex,
          rawContent: line,
          reason: earnings === null ? `Invalid numeric value for Earnings (USD): "${earningsStr}"` : quantity === null ? 'Invalid quantity' : 'Missing or malformed ISRC',
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

      if (saleMonth && (!periodStart || saleMonth < periodStart)) periodStart = saleMonth;
      if (saleMonth && (!periodEnd || saleMonth > periodEnd)) periodEnd = saleMonth;

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
        trackTitle: title,
        artistName: artist,
        dspName: store,
        transactionType: txnType,
        quantity,
        grossRevenue: grossMoney.toFloat(),
        distributorFee,
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
      reportId: `RPT-DK-${hashText(rawContent).slice(0, 40)}`,
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
        evidenceSha256: hashText(rawContent),
        parsedAt: new Date().toISOString(),
        deterministicHash: hashText(JSON.stringify(transactions.map(transaction => transaction.sourceHash).sort())),
      },
    };
  }
}
