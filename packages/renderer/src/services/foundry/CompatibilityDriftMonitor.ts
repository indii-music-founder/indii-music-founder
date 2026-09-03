import {
  CompatibilityDriftReport,
  FormatForensicsReport
} from '@indii/shared';
import { FormatForensicsEngine } from './FormatForensicsEngine';

export class CompatibilityDriftMonitor {
  /**
   * Compare incoming file against a baseline forensics report to detect upstream drift
   */
  static inspectDrift(
    baselineReport: FormatForensicsReport,
    incomingContent: string
  ): CompatibilityDriftReport {
    const incomingForensics = FormatForensicsEngine.analyze('drift_sample', incomingContent);

    const baselineHeaders = baselineReport.columns.map((c) => c.rawHeader);
    const incomingHeaders = incomingForensics.columns.map((c) => c.rawHeader);

    const newColumns = incomingHeaders.filter((h) => !baselineHeaders.includes(h));
    const missingColumns = baselineHeaders.filter((h) => !incomingHeaders.includes(h));

    // Check if column order shifted
    const commonHeaders = baselineHeaders.filter((h) => incomingHeaders.includes(h));
    const incomingCommon = incomingHeaders.filter((h) => baselineHeaders.includes(h));
    const columnOrderShifted = JSON.stringify(commonHeaders) !== JSON.stringify(incomingCommon);

    const hasNewColumns = newColumns.length > 0;
    const hasMissingColumns = missingColumns.length > 0;
    const hasSyntaxMutation = incomingForensics.delimiter !== baselineReport.delimiter;

    // Severity assessment
    let severity: 'none' | 'benign' | 'breaking' = 'none';
    let quarantineRequired = false;

    // Critical headers for statement processing: ISRC or Earnings
    const isrcLost = missingColumns.some((h) => h.toLowerCase().includes('isrc'));
    const earningsLost = missingColumns.some((h) => h.toLowerCase().includes('earning') || h.toLowerCase().includes('total'));

    if (isrcLost || earningsLost || hasSyntaxMutation) {
      severity = 'breaking';
      quarantineRequired = true;
    } else if (hasNewColumns || hasMissingColumns || columnOrderShifted) {
      severity = 'benign';
    }

    const isDriftDetected = severity !== 'none';

    let suggestedPatchNotes: string | undefined;
    if (hasNewColumns) {
      suggestedPatchNotes = `New upstream columns detected: ${newColumns.join(', ')}. Recommend updating adapter schema mapping.`;
    }
    if (isrcLost) {
      suggestedPatchNotes = 'CRITICAL: ISRC identifier column missing or renamed in incoming statement. File quarantined.';
    }

    return {
      formatId: baselineReport.detectedFormatFamily,
      baselineForensicsDate: baselineReport.timestamp,
      isDriftDetected,
      hasNewColumns,
      newColumns,
      hasMissingColumns,
      missingColumns,
      columnOrderShifted,
      hasSyntaxMutation,
      severity,
      quarantineRequired,
      suggestedPatchNotes,
      detectedAt: new Date().toISOString(),
    };
  }
}
