import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { processEarningsReport } from './ingestEarningsReport';
import { DistroKidStatementAdapter, TuneCoreStatementAdapter } from './adapters';
import { mapNormalizedStatementToEarningsReport } from './normalizedStatementMapper';
import type { NormalizedStatementReport } from '@indii/shared/dist/foundry/types.js';

const MAX_REPORT_BYTES = 6 * 1024 * 1024;

/**
 * Cloud Function that accepts a raw royalty report (CSV/TSV/JSON) uploaded from a DSP,
 * parses it using the appropriate adapter, and forwards the normalized report to the
 * existing earnings ingestion pipeline.
 *
 * The authenticated client should send an object with the following shape:
 * ```ts
 * {
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

  const { fileName, contentBase64 } = request.data ?? {};
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 255 || typeof contentBase64 !== 'string') {
    throw new HttpsError('invalid-argument', 'A fileName and contentBase64 value are required.');
  }

  if (contentBase64.length > Math.ceil(MAX_REPORT_BYTES / 3) * 4
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(contentBase64)
    || contentBase64.length % 4 !== 0) {
    throw new HttpsError('invalid-argument', 'The report file is not valid base64 data.');
  }

  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_REPORT_BYTES) {
    throw new HttpsError('invalid-argument', 'The report file must be between 1 byte and 6 MB.');
  }
  if (buffer.toString('base64') !== contentBase64) {
    throw new HttpsError('invalid-argument', 'The report file is not valid base64 data.');
  }
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

  let mappedReport: ReturnType<typeof mapNormalizedStatementToEarningsReport>;
  try {
    mappedReport = mapNormalizedStatementToEarningsReport(normalized, rawContent);
  } catch (e: any) {
    throw new HttpsError('failed-precondition', `Report is missing required ingestion data: ${e?.message ?? String(e)}`);
  }

  // Ownership comes only from Firebase Auth; never accept a caller-selected UID.
  const result = await processEarningsReport(request.auth.uid, mappedReport);
  return result;
});
