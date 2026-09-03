import { describe, it, expect } from 'vitest';
import { EvidenceIntakeService } from '../EvidenceIntakeService';
import { FormatForensicsEngine } from '../FormatForensicsEngine';
import { HypothesisLedger } from '../HypothesisLedger';
import { AdapterConstructor } from '../AdapterConstructor';
import { LayeredValidator } from '../LayeredValidator';
import { ArtistBusinessGraphNormalizer } from '../ArtistBusinessGraphNormalizer';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

describe('FoundryVerticalSlice (Integration)', () => {
  const genuineDistroKidSample = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale
2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t14500\t55.10\tUS
2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t4200\t16.38\tGB
2026-04-15\t2026-03\tApple Music\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t3100\t23.25\tUS
2026-04-15\t2026-03\tApple Music\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t1200\t9.00\tDE
2026-04-15\t2026-03\tAmazon Music\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t1800\t7.20\tUS
2026-04-15\t2026-03\tYouTube Music\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t9500\t19.00\tUS
2026-04-15\t2026-03\tiTunes\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t45\t31.50\tUS`;

  const velvetVoltageCatalog = new Map<string, ExtendedGoldenMetadata>([
    [
      'US-IND-26-00001',
      {
        trackTitle: 'Velvet Voltage',
        artistName: 'KIRA NOVA',
        isrc: 'US-IND-26-00001',
        explicit: false,
        genre: 'Dark Electro-Pop / Synthwave',
        labelName: 'indii Records',
        splits: [
          { legalName: 'Kira Novakowski', role: 'songwriter', percentage: 70, email: 'kira@kiranova.io' },
          { legalName: 'DJ PHANTOM', role: 'producer', percentage: 30, email: 'phantom@kiranova.io' },
        ],
        pro: 'BMI',
        publisher: 'indii Publishing',
      } as ExtendedGoldenMetadata,
    ],
  ]);

  it('should execute complete vertical slice from evidence to business graph', async () => {
    // Stage 1: Evidence Intake
    const evidence = await EvidenceIntakeService.ingestEvidence(
      'distrokid_2026_03.tsv',
      genuineDistroKidSample,
      {
        claimedFormat: 'DistroKid TSV Sales Export',
        mayUseForGeneratedTests: true,
      }
    );
    expect(evidence.sha256).toBeDefined();
    expect(evidence.constraints.classification).toBe('sensitive_financial');

    // Stage 2: Format Forensics
    const forensics = FormatForensicsEngine.analyze(evidence.id, genuineDistroKidSample);
    expect(forensics.container).toBe('flat_delimited');
    expect(forensics.delimiter).toBe('tab');
    expect(forensics.detectedFormatFamily).toBe('distrokid_statement');
    expect(forensics.forensicsConfidence).toBeGreaterThan(0.85);

    // Stage 3: Hypothesis Ledger
    const ledger = HypothesisLedger.fromForensics(forensics, 'DistroKid Sales Statement');
    const ledgerState = ledger.getState();
    expect(ledgerState.provenRulesCount).toBeGreaterThan(2);

    // Stage 4: Deterministic Adapter Construction & Execution
    const adapter = AdapterConstructor.resolveAdapter(genuineDistroKidSample);
    expect(adapter).not.toBeNull();
    expect(adapter?.formatId).toBe('distrokid_statement');

    const parsedReport = adapter!.parse(genuineDistroKidSample);
    expect(parsedReport.transactions.length).toBe(7);
    expect(parsedReport.totalGrossRevenue).toBe(161.43);
    expect(parsedReport.totalStreams).toBe(34300);
    expect(parsedReport.totalDownloads).toBe(45);
    expect(parsedReport.quarantinedRows.length).toBe(0);

    // Stage 5: Layered Validation (7 layers)
    const validation = await LayeredValidator.validate(genuineDistroKidSample, parsedReport, evidence.sha256);
    expect(validation.allPassed).toBe(true);
    expect(validation.byte.passed).toBe(true);
    expect(validation.structural.passed).toBe(true);
    expect(validation.schema.passed).toBe(true);
    expect(validation.semantic.passed).toBe(true);
    expect(validation.roundTrip.passed).toBe(true);
    expect(validation.humanReview.requiresArtistConfirmation).toBe(false);

    // Stage 6: Artist Business Graph Normalization
    const graph = ArtistBusinessGraphNormalizer.normalizeToGraph(parsedReport, velvetVoltageCatalog);
    expect(graph.releases.length).toBe(1);
    expect(graph.unmatchedIsrcs.length).toBe(0);

    // 70% to Kira Novakowski: 70% of 161.43 = $113.00
    // 30% to DJ PHANTOM: 30% of 161.43 = $48.43
    expect(graph.contributorSummary['Kira Novakowski']?.totalPayout).toBeCloseTo(113.00, 1);
    expect(graph.contributorSummary['DJ PHANTOM']?.totalPayout).toBeCloseTo(48.43, 1);
    expect(graph.lineageLinksCount).toBe(7);
  });
});
