import { describe, it, expect } from 'vitest';
import { LayeredValidator } from '../LayeredValidator';
import { DistroKidStatementAdapter } from '../adapters/DistroKidStatementAdapter';
import { EvidenceIntakeService } from '../EvidenceIntakeService';

describe('LayeredValidator', () => {
  const sampleTsv = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale
2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t14500\t55.10\tUS
2026-04-15\t2026-03\tApple Music\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t3100\t23.25\tUS`;

  it('should pass all 7 validation layers for well-formed statement and report', async () => {
    const adapter = new DistroKidStatementAdapter();
    const report = adapter.parse(sampleTsv);
    const expectedSha256 = await EvidenceIntakeService.computeSha256(sampleTsv);

    const validation = await LayeredValidator.validate(sampleTsv, report, expectedSha256);

    expect(validation.allPassed).toBe(true);
    expect(validation.byte.passed).toBe(true);
    expect(validation.byte.sha256Match).toBe(true);
    expect(validation.structural.passed).toBe(true);
    expect(validation.schema.passed).toBe(true);
    expect(validation.semantic.passed).toBe(true);
    expect(validation.semantic.mathBalanced).toBe(true);
    expect(validation.roundTrip.passed).toBe(true);
    expect(validation.humanReview.requiresArtistConfirmation).toBe(false);
  });

  it('should flag human confirmation if quarantined rows or fee anomalies exist', async () => {
    const anomalousTsv = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale
2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t14500\t55.10\tUS
2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tMALFORMED_ISRC\t8847243739548\t100\t0.50\tUS`;

    const adapter = new DistroKidStatementAdapter();
    const report = adapter.parse(anomalousTsv);

    const validation = await LayeredValidator.validate(anomalousTsv, report);

    expect(report.quarantinedRows.length).toBe(1);
    expect(validation.humanReview.requiresArtistConfirmation).toBe(true);
    expect(validation.humanReview.warnings.length).toBeGreaterThan(0);
  });
});
