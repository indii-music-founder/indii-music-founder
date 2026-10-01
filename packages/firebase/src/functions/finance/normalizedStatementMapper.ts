import { createHash } from 'node:crypto';
import type { NormalizedStatementReport } from '@indii/shared/dist/foundry/types.js';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
  october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const SENDER_PARTY_IDS: Record<string, string> = {
  DistroKid: 'PADPIDA2013021901W',
  TuneCore: 'PADPIDA2009090203U',
};

function dateForMonth(year: number, month: number, end = false): string {
  const day = end ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseStatementPeriod(value: string | undefined, reportingDate?: string): { startDate: string; endDate: string } {
  const text = value?.trim() ?? '';
  const isoMonth = /^(\d{4})-(\d{1,2})$/.exec(text);
  if (isoMonth) {
    const year = Number(isoMonth[1]);
    const month = Number(isoMonth[2]);
    if (month >= 1 && month <= 12) return { startDate: dateForMonth(year, month), endDate: dateForMonth(year, month, true) };
  }

  const fullDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (fullDate && Number.isFinite(Date.parse(`${text}T00:00:00Z`))) {
    return { startDate: text, endDate: text };
  }

  const namedMonth = /^(\p{L}+)(?:\s+|[-/,]+)?(\d{4})?$/u.exec(text);
  const month = namedMonth ? MONTHS[namedMonth[1]!.toLowerCase()] : undefined;
  if (month) {
    let year = namedMonth?.[2] ? Number(namedMonth[2]) : undefined;
    if (year === undefined && reportingDate && Number.isFinite(Date.parse(reportingDate))) {
      const anchor = new Date(reportingDate);
      year = anchor.getUTCFullYear();
      // A sale month after its report date belongs to the preceding year.
      if (month > anchor.getUTCMonth() + 1) year -= 1;
    }
    if (year !== undefined && year >= 2000 && year <= 2200) {
      return { startDate: dateForMonth(year, month), endDate: dateForMonth(year, month, true) };
    }
  }

  throw new Error(`could not determine a calendar year and month from "${text || '(empty)'}"`);
}

function transactionUsageType(type: NormalizedStatementReport['transactions'][number]['transactionType']): string {
  switch (type) {
    case 'stream':
    case 'subscription':
    case 'ad_supported':
    case 'cloud':
      return 'OnDemandStream';
    case 'download':
      return 'Download';
    case 'other':
      return 'Other';
  }
}

/** Map the shared parser's output to the existing, validated earnings ledger contract. */
export function mapNormalizedStatementToEarningsReport(
  report: NormalizedStatementReport,
  sourceContent: string,
  configuredRecipient = process.env.DDEX_SENDER_PARTY_ID?.trim()
) {
  if (!report.transactions.length) throw new Error('the report contains no usable transaction rows');

  const senderId = SENDER_PARTY_IDS[report.reportingEntity];
  if (!senderId) throw new Error(`unsupported reporting entity "${report.reportingEntity}"`);

  const periods = report.transactions.map(transaction => {
    const sourceDate = transaction.rawSourceFields['Reporting Date'];
    return parseStatementPeriod(transaction.salePeriodStart ?? report.periodStart, sourceDate);
  });
  const startDate = periods.map(period => period.startDate).sort()[0]!;
  const endDate = periods.map(period => period.endDate).sort().at(-1)!;

  return {
    reportId: `statement_${createHash('sha256').update(sourceContent).digest('hex').slice(0, 40)}`,
    senderId,
    // These distributor flat files do not carry an addressed DDEX recipient.
    // Use the configured platform party ID when available and the established
    // internal DSR identity otherwise; ingestion still checks configured IDs.
    recipientId: configuredRecipient || 'PA-DPIDA-INDII',
    reportingPeriod: { startDate, endDate },
    reportCreatedDateTime: report.provenance.parsedAt,
    currencyCode: report.currency,
    summary: {
      totalUsageCount: report.totalQuantity,
      totalRevenue: report.totalGrossRevenue,
    },
    transactions: report.transactions.map(transaction => ({
      transactionId: transaction.transactionId,
      resourceId: { isrc: transaction.isrc },
      usageType: transactionUsageType(transaction.transactionType),
      usageCount: transaction.quantity,
      revenueAmount: transaction.grossRevenue,
      currencyCode: transaction.currency,
      // ZZ records that the statement omitted territory instead of inventing one.
      territoryCode: transaction.territory.trim() || 'ZZ',
      serviceName: transaction.dspName,
    })),
  };
}
