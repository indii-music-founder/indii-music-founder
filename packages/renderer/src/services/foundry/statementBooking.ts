import type { LayeredValidationReport, NormalizedStatementReport } from '@indii/shared';

/** Invalid or partially quarantined statements cannot be approved as a complete statement. */
export function canBookStatement(
  report: NormalizedStatementReport | null,
  validation: LayeredValidationReport | null,
): boolean {
  return !!report && !!validation
    && report.transactions.length > 0
    && report.quarantinedRows.length === 0
    && validation.allPassed
    && validation.differential.passed
    && validation.humanReview.passed
    && !validation.humanReview.requiresArtistConfirmation;
}
