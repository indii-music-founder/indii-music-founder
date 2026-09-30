import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { processEarningsReport } from './ingestEarningsReport';
import { DistroKidStatementAdapter, TuneCoreStatementAdapter } from './adapters';
import type { NormalizedStatementReport, NormalizedStatementTransaction } from '@indii/shared/dist/foundry/types.js';

/**
 * Cloud Function that accepts a raw royalty report (CSV/TSV/JSON) uploaded from a DSP,
 * parses it using the appropriate adapter, and forwards the normalized report to the
 * existing earnings ingestion pipeline.
 *
 * The client should send an object with the following shape:
 * ```ts
 * {
 *   userId: string; // Firebase UID of the uploader
 *   fileName: string; // Original file name (used for format detection)
 *   contentBase64: string; // Base64‑encoded file bytes
 * }
 * ```
 */
export const parseAndIngestRoyaltyReport = onCall({
  enforceAppCheck: false,
  timeoutSeconds: 300,
  memory: '512MiB',
}, async (request) => {
  // Validate App Check token (if unknown)
  validateAppCheckV2(request);

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const { userId, fileName, contentBase64 } = request.data ?? {};
  if (typeof userId !== 'string' || typeof fileName !== 'string' || typeof contentBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing required fields: userId, fileName, contentBase64');
  }

  // Decode the base64 payload.
  const buffer = Buffer.from(contentBase64, 'base64');
  const rawContent = buffer.toString('utf8');

  // Simple format detection based on the first line.
  const firstLine = rawContent.split(/\r?\n/)[0];
  let adapter: typeof DistroKidStatementAdapter | typeof TuneCoreStatementAdapter;
  if (DistroKidStatementAdapter.canParse(firstLine)) {
    adapter = DistroKidStatementAdapter;
  } else if (TuneCoreStatementAdapter.canParse(firstLine)) {
    adapter = TuneCoreStatementAdapter;
  } else {
    throw new HttpsError('invalid-argument', 'Unable to determine report format from header line.');
  }

  // Parse into shared NormalizedStatementReport.
  let normalized: NormalizedStatementReport;
  try {
    normalized = adapter.parse(rawContent);
  } catch (e: any) {
    const errMsg = e?.message ?? String(e);
    throw new HttpsError('failed-precondition', `Failed to parse report: ${errMsg}`);
  }

  // Build the report shape expected by the ingestion pipeline.
  const mappedReport = {
    reportId: normalized.reportId,
    senderId: normalized.reportingEntity,
    recipientId: normalized.reportingEntity,
    reportingPeriod: normalized.periodStart && normalized.periodEnd ? { startDate: normalized.periodStart, endDate: normalized.periodEnd } : { startDate: '', endDate: '' },
    reportCreatedDateTime: normalized.provenance?.parsedAt ?? '',
    currencyCode: normalized.currency,
    summary: {
      totalUsageCount: normalized.totalQuantity,
      totalRevenue: normalized.totalGrossRevenue,
    },
    transactions: normalized.transactions.map((t: NormalizedStatementTransaction) => ({
      transactionId: t.transactionId,
      resourceId: { isrc: t.isrc },
      usageType: t.transactionType,
      usageCount: t.quantity,
      revenueAmount: t.grossRevenue,
      currencyCode: t.currency,
      territoryCode: t.territory,
      serviceName: t.dspName,
    })),
  };

  // Forward to the earnings ingestion logic.
  const result = await processEarningsReport(userId, mappedReport);
  return result;
});
