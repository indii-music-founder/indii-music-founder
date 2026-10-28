import { describe, it, expect, vi } from 'vitest';
import { CompatibilityDriftMonitor } from '../CompatibilityDriftMonitor';
import { FormatForensicsEngine } from '../FormatForensicsEngine';
import * as typesafeJudgments from '@/config/typesafeJudgments';

describe('CompatibilityDriftMonitor', () => {
  const baselineTsv = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale\n2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t14500\t55.10\tUS`;
  const baselineReport = FormatForensicsEngine.analyze('distrokid_baseline', baselineTsv);

  it('should detect zero drift when identical format structure is provided', () => {
    const driftReport = CompatibilityDriftMonitor.inspectDrift(baselineReport, baselineTsv);

    expect(driftReport.isDriftDetected).toBe(false);
    expect(driftReport.severity).toBe('none');
    expect(driftReport.quarantineRequired).toBe(false);
  });

  it('should detect benign drift when novel upstream columns are introduced', () => {
    const mutatedTsv = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tTax Withholding (USD)\tPublisher Royalty ID\tQuantity\tEarnings (USD)\tCountry of Sale\n2026-05-15\t2026-04\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t1.25\tPUB-9941\t16000\t60.80\tUS`;

    const driftReport = CompatibilityDriftMonitor.inspectDrift(baselineReport, mutatedTsv);

    expect(driftReport.isDriftDetected).toBe(true);
    expect(driftReport.hasNewColumns).toBe(true);
    expect(driftReport.newColumns).toContain('Tax Withholding (USD)');
    expect(driftReport.newColumns).toContain('Publisher Royalty ID');
    expect(driftReport.suggestedPatchNotes).toBeDefined();
  });

  it('should flag breaking drift and enforce quarantine when critical ISRC column is absent', () => {
    const brokenTsv = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale\n2026-05-15\t2026-04\tSpotify\tKIRA NOVA\tVelvet Voltage\t8847243739548\t16000\t60.80\tUS`;

    const driftReport = CompatibilityDriftMonitor.inspectDrift(baselineReport, brokenTsv);

    expect(driftReport.isDriftDetected).toBe(true);
    expect(driftReport.severity).toBe('breaking');
    expect(driftReport.quarantineRequired).toBe(true);
    expect(driftReport.missingColumns).toContain('ISRC');
  });

  it('should use judgeStatementColumnLoss in inspectDriftWithJudgment when missing columns are present', async () => {
    const judgeSpy = vi.spyOn(typesafeJudgments, 'judgeStatementColumnLoss');
    judgeSpy.mockResolvedValueOnce({
      isCriticalLoss: true,
      lossConfidence: 0.95,
      lossCategory: 'CRITICAL_FINANCIAL',
      explanation: 'Net earnings column missing.',
    });

    const brokenTsv = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale\n2026-05-15\t2026-04\tSpotify\tKIRA NOVA\tVelvet Voltage\t8847243739548\t16000\t60.80\tUS`;
    const report = await CompatibilityDriftMonitor.inspectDriftWithJudgment(baselineReport, brokenTsv);

    expect(judgeSpy).toHaveBeenCalled();
    expect(report.semanticAnalysisSource).toBe('jev');
    expect(report.dataLossAssessed).toBe(true);
    expect(report.severity).toBe('breaking');
    expect(report.quarantineRequired).toBe(true);
    expect(report.suggestedPatchNotes).toContain('CRITICAL (Jev)');

    judgeSpy.mockRestore();
  });

  it('should gracefully handle non-critical missing columns assessed by Jev', async () => {
    const judgeSpy = vi.spyOn(typesafeJudgments, 'judgeStatementColumnLoss');
    judgeSpy.mockResolvedValueOnce({
      isCriticalLoss: false,
      lossConfidence: 0.88,
      lossCategory: 'NON_CRITICAL_METADATA',
      explanation: 'Only promotional territory comment missing.',
    });

    // Country of sale missing (non-critical according to judgment)
    const tsvWithoutCountry = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\n2026-05-15\t2026-04\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t16000\t60.80`;
    const report = await CompatibilityDriftMonitor.inspectDriftWithJudgment(baselineReport, tsvWithoutCountry);

    expect(judgeSpy).toHaveBeenCalled();
    expect(report.semanticAnalysisSource).toBe('jev');
    expect(report.severity).toBe('benign');
    expect(report.quarantineRequired).toBe(false);
    expect(report.suggestedPatchNotes).toContain('BENIGN (Jev)');

    judgeSpy.mockRestore();
  });
});
