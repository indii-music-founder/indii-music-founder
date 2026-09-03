import { describe, it, expect } from 'vitest';
import { HypothesisLedger } from '../HypothesisLedger';
import { FormatForensicsEngine } from '../FormatForensicsEngine';

describe('HypothesisLedger', () => {
  it('should generate proven and tentative hypotheses from forensics report', () => {
    const tsvContent = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale\n2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t14500\t55.10\tUS`;
    const report = FormatForensicsEngine.analyze('distrokid_test', tsvContent);

    const ledger = HypothesisLedger.fromForensics(report, 'DistroKid TSV');
    const state = ledger.getState();

    expect(state.formatId).toBe('distrokid_statement');
    expect(state.formatName).toBe('DistroKid TSV');
    expect(state.hypotheses.length).toBeGreaterThan(3);
    expect(state.provenRulesCount).toBeGreaterThan(0);

    const delimRule = state.hypotheses.find((h) => h.category === 'delimiter_and_encoding');
    expect(delimRule).toBeDefined();
    expect(delimRule?.status).toBe('proven');
    expect(delimRule?.ruleStatement).toContain('tab');
  });

  it('should adjust hypothesis confidence when supporting or contradictory evidence is recorded', () => {
    const ledger = new HypothesisLedger('custom_format', 'Custom Format');
    const rule = ledger.addHypothesis({
      category: 'header_mapping',
      ruleStatement: 'Header "TrackId" maps to ISRC',
      supportingEvidenceIds: ['ev-1'],
      contradictoryEvidenceIds: [],
      confidence: 0.6,
      status: 'tentative',
      applicableVersions: ['1.0'],
      knownExceptions: [],
      dependentAdapterSymbols: ['mapTrackId'],
    });

    // Supporting evidence increases confidence
    ledger.recordEvidence(rule.id, 'ev-2', true);
    let updated = ledger.getState().hypotheses.find((h) => h.id === rule.id);
    expect(updated?.confidence).toBeGreaterThan(0.6);

    // Contradictory evidence decreases confidence
    ledger.recordEvidence(rule.id, 'ev-bad', false);
    updated = ledger.getState().hypotheses.find((h) => h.id === rule.id);
    expect(updated?.confidence).toBeLessThan(0.7);
  });

  it('should state unknown when evidence is insufficient instead of guessing', () => {
    const rawContent = `UnknownColA,UnknownColB\n123,456`;
    const report = FormatForensicsEngine.analyze('opaque_test', rawContent);
    const ledger = HypothesisLedger.fromForensics(report, 'Opaque Format');
    const state = ledger.getState();

    const revenueRule = state.hypotheses.find((h) => h.category === 'revenue_math');
    expect(revenueRule).toBeDefined();
    expect(revenueRule?.status).toBe('unknown');
    expect(revenueRule?.ruleStatement).toContain('unknown');
  });
});
