import {
  NormalizedStatementReport,
  NormalizedStatementTransaction,
  QuarantinedRow,
  ParseOptions,
  HypothesisLedgerState
} from './types.js';
import { DistroKidStatementAdapter } from './adapters/DistroKidStatementAdapter.js';
import { TuneCoreStatementAdapter } from './adapters/TuneCoreStatementAdapter.js';
import { DecimalMoney } from './DecimalMoney.js';
import { parseMoneyAmount } from './parseMoney.js';

export interface DeterministicAdapter {
  readonly formatId: string;
  readonly formatName: string;
  readonly version: string;
  canParse(content: string): boolean;
  parse(rawContent: string, options?: ParseOptions): NormalizedStatementReport;
}

export class AdapterConstructor {
  private static registeredAdapters: DeterministicAdapter[] = [
    new DistroKidStatementAdapter(),
    new TuneCoreStatementAdapter(),
  ];

  /**
   * Register a new or generated adapter
   */
  static registerAdapter(adapter: DeterministicAdapter): void {
    const existingIdx = this.registeredAdapters.findIndex((a) => a.formatId === adapter.formatId);
    if (existingIdx >= 0) {
      this.registeredAdapters[existingIdx] = adapter;
    } else {
      this.registeredAdapters.push(adapter);
    }
  }

  /**
   * Find suitable adapter by content inspection or formatId
   */
  static resolveAdapter(content: string, preferredFormatId?: string): DeterministicAdapter | null {
    if (preferredFormatId) {
      const found = this.registeredAdapters.find((a) => a.formatId === preferredFormatId);
      if (found) return found;
    }

    for (const adapter of this.registeredAdapters) {
      if (adapter.canParse(content)) {
        return adapter;
      }
    }

    return null;
  }

  /**
   * Parse content with resolved adapter
   */
  static parse(content: string, preferredFormatId?: string, options: ParseOptions = {}): NormalizedStatementReport {
    const adapter = this.resolveAdapter(content, preferredFormatId);
    if (!adapter) {
      throw new Error('No registered adapter matches the provided content format.');
    }
    return adapter.parse(content, options);
  }

  /**
   * Dynamically synthesize an adapter from proven hypotheses
   */
  static synthesizeAdapterFromHypotheses(ledgerState: HypothesisLedgerState): DeterministicAdapter {
    const formatId = ledgerState.formatId;
    const formatName = ledgerState.formatName;
    const version = ledgerState.version;

    // Extract proven rules
    const delimRule = ledgerState.hypotheses.find((h) => h.category === 'delimiter_and_encoding' && h.status === 'proven');
    const delimiter = delimRule?.ruleStatement.includes('tab')
      ? '\t'
      : delimRule?.ruleStatement.includes('semicolon')
      ? ';'
      : delimRule?.ruleStatement.includes('pipe')
      ? '|'
      : ',';

    const headerRules = ledgerState.hypotheses.filter((h) => h.category === 'header_mapping' && h.status === 'proven');
    const columnMap: Record<string, string> = {};
    for (const r of headerRules) {
      const match = r.ruleStatement.match(/Column "([^"]+)" maps to semantic field "([^"]+)"/);
      if (match && match[1] && match[2]) {
        columnMap[match[2]] = match[1];
      }
    }

    // Require essential semantic mappings: must have earnings and either title or ISRC
    const hasEarnings = Boolean(columnMap['currency_amount']);
    const hasIdentifier = Boolean(columnMap['track_title'] || columnMap['isrc']);

    if (!hasEarnings || !hasIdentifier) {
      throw new Error('Insufficient hypotheses to synthesize deterministic statement adapter');
    }

    return {
      formatId,
      formatName,
      version,
      canParse: (content: string) => {
        const firstLine = content.split(/\r?\n/)[0] || '';
        if (delimiter === '\t' && !firstLine.includes('\t')) return false;
        return headerRules.every((r) => {
          const match = r.ruleStatement.match(/Column "([^"]+)"/);
          return match && match[1] ? firstLine.includes(match[1]) : true;
        });
      },
      parse: (rawContent: string, options?: ParseOptions): NormalizedStatementReport => {
        const cleanContent = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
        const lines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

        if (lines.length < 2) {
          throw new Error(`${formatName} statement has no data rows`);
        }

        const headers = lines[0]!.split(delimiter).map((h) => h.trim());
        const headerMap = new Map<string, number>();
        headers.forEach((h, idx) => headerMap.set(h.toLowerCase(), idx));

        const getCol = (row: string[], rawColName?: string): string => {
          if (!rawColName) return '';
          const idx = headerMap.get(rawColName.toLowerCase());
          return idx !== undefined && row[idx] ? row[idx]!.trim() : '';
        };

        const transactions: NormalizedStatementTransaction[] = [];
        const quarantinedRows: QuarantinedRow[] = [];

        let grossAcc = DecimalMoney.zero();
        let netAcc = DecimalMoney.zero();
        let feeAcc = DecimalMoney.zero();
        let totalQuantity = 0;
        let totalStreams = 0;
        let totalDownloads = 0;

        let periodStart: string | undefined;
        let periodEnd: string | undefined;

        const dataLines = lines.slice(1);
        const maxRows = options?.maxRowsToSample ? Math.min(options.maxRowsToSample, dataLines.length) : dataLines.length;

        for (let i = 0; i < maxRows; i++) {
          const lineIndex = i + 1;
          const rawLine = dataLines[i]!;
          const parts = rawLine.split(delimiter);

          const rawEarnings = getCol(parts, columnMap['currency_amount']);
          const earnings = parseMoneyAmount(rawEarnings);

          if (earnings === null) {
            quarantinedRows.push({
              lineIndex: lineIndex + 1,
              rawContent: rawLine,
              reason: `Unparseable earnings amount: "${rawEarnings}"`,
              errorCode: 'INVALID_CURRENCY_AMOUNT',
              severity: 'warning',
            });
            continue;
          }

          const rawFee = columnMap['fee_amount'] ? getCol(parts, columnMap['fee_amount']) : '';
          const feeAmount = rawFee ? (parseMoneyAmount(rawFee) ?? 0) : 0;

          const rawQty = columnMap['quantity_count'] ? getCol(parts, columnMap['quantity_count']) : '';
          const quantity = rawQty ? Math.max(0, parseInt(rawQty, 10) || 1) : 1;

          const isrc = columnMap['isrc'] ? getCol(parts, columnMap['isrc']) : '';
          const upc = columnMap['upc'] ? getCol(parts, columnMap['upc']) : '';
          const trackTitle = columnMap['track_title'] ? getCol(parts, columnMap['track_title']) : (isrc || 'Unknown Track');
          const artistName = columnMap['artist_name'] ? getCol(parts, columnMap['artist_name']) : 'Unknown Artist';
          const albumTitle = columnMap['album_title'] ? getCol(parts, columnMap['album_title']) : undefined;
          const dspName = columnMap['dsp_name'] ? getCol(parts, columnMap['dsp_name']) : 'Unknown Store';
          const territory = columnMap['territory_code'] ? getCol(parts, columnMap['territory_code']) : (options?.territoryDefault || 'US');
          const dateVal = columnMap['iso_date'] ? getCol(parts, columnMap['iso_date']) : '';

          const isDownload = dspName.toLowerCase().includes('download') || dspName.toLowerCase().includes('itunes');
          const txnType = isDownload ? 'download' : 'stream';

          if (txnType === 'download') totalDownloads += quantity;
          else totalStreams += quantity;

          const earningsMoney = DecimalMoney.fromFloat(earnings);
          const feeMoney = DecimalMoney.fromFloat(feeAmount);
          grossAcc = grossAcc.add(earningsMoney);
          feeAcc = feeAcc.add(feeMoney);
          netAcc = netAcc.add(earningsMoney.subtract(feeMoney));
          totalQuantity += quantity;

          if (!periodStart && dateVal) periodStart = dateVal;
          if (dateVal) periodEnd = dateVal;

          const rawFields: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rawFields[h] = parts[idx] ? parts[idx]!.trim() : '';
          });

          transactions.push({
            sourceLineIndex: lineIndex + 1,
            sourceHash: `synth-${lineIndex + 1}-${isrc || trackTitle}`,
            transactionId: `TX-${formatId.toUpperCase()}-${lineIndex + 1}`,
            isrc: isrc || undefined,
            upc: upc || undefined,
            trackTitle,
            artistName,
            albumTitle,
            dspName,
            transactionType: txnType,
            quantity,
            grossRevenue: earnings,
            distributorFee: feeAmount,
            netRevenue: earnings - feeAmount,
            currency: options?.currencyDefault || 'USD',
            territory: territory || 'US',
            salePeriodStart: dateVal || undefined,
            rawSourceFields: rawFields,
          });
        }

        return {
          formatId,
          adapterVersion: version,
          reportId: `RPT-${formatId.toUpperCase()}-${Date.now()}`,
          reportingEntity: formatName,
          currency: options?.currencyDefault || 'USD',
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
            evidenceSha256: 'synthesized-from-hypotheses',
            parsedAt: new Date().toISOString(),
            deterministicHash: `det-${formatId}-${transactions.length}-${netAcc.toCents()}`,
          },
        };
      },
    };
  }
}
