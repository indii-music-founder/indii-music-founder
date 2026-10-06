import { describe, it, expect } from 'vitest';
import { AdapterConstructor } from './AdapterConstructor.js';
import { HypothesisLedgerState } from './types.js';

describe('AdapterConstructor.synthesizeAdapterFromHypotheses (ISSUE-1481)', () => {
  it('throws error when hypotheses are insufficient to map earnings and track identifier', () => {
    const insufficientState: HypothesisLedgerState = {
      formatId: 'custom_distro',
      formatName: 'Custom Distro',
      version: '1.0',
      hypotheses: [
        {
          id: 'hyp-1',
          category: 'delimiter_and_encoding',
          ruleStatement: 'Format uses comma delimiter with utf-8 encoding.',
          supportingEvidenceIds: [],
          contradictoryEvidenceIds: [],
          confidence: 0.95,
          status: 'proven',
          applicableVersions: ['1.0'],
          knownExceptions: [],
          dependentAdapterSymbols: [],
        },
      ],
      aggregateConfidence: 0.95,
      provenRulesCount: 1,
      unknownRulesCount: 0,
      lastUpdated: new Date().toISOString(),
    };

    expect(() => AdapterConstructor.synthesizeAdapterFromHypotheses(insufficientState)).toThrow(
      'Insufficient hypotheses to synthesize deterministic statement adapter'
    );
  });

  it('synthesizes a deterministic adapter and parses content matching proven hypotheses', () => {
    const validState: HypothesisLedgerState = {
      formatId: 'my_distributor',
      formatName: 'My Distributor Statement',
      version: '1.0',
      hypotheses: [
        {
          id: 'hyp-1',
          category: 'delimiter_and_encoding',
          ruleStatement: 'Format uses comma delimiter with utf-8 encoding.',
          supportingEvidenceIds: [],
          contradictoryEvidenceIds: [],
          confidence: 0.95,
          status: 'proven',
          applicableVersions: ['1.0'],
          knownExceptions: [],
          dependentAdapterSymbols: [],
        },
        {
          id: 'hyp-2',
          category: 'header_mapping',
          ruleStatement: 'Column "Track" maps to semantic field "track_title".',
          supportingEvidenceIds: [],
          contradictoryEvidenceIds: [],
          confidence: 0.95,
          status: 'proven',
          applicableVersions: ['1.0'],
          knownExceptions: [],
          dependentAdapterSymbols: [],
        },
        {
          id: 'hyp-3',
          category: 'header_mapping',
          ruleStatement: 'Column "ISRC_Code" maps to semantic field "isrc".',
          supportingEvidenceIds: [],
          contradictoryEvidenceIds: [],
          confidence: 0.95,
          status: 'proven',
          applicableVersions: ['1.0'],
          knownExceptions: [],
          dependentAdapterSymbols: [],
        },
        {
          id: 'hyp-4',
          category: 'header_mapping',
          ruleStatement: 'Column "Net_Payout" maps to semantic field "currency_amount".',
          supportingEvidenceIds: [],
          contradictoryEvidenceIds: [],
          confidence: 0.95,
          status: 'proven',
          applicableVersions: ['1.0'],
          knownExceptions: [],
          dependentAdapterSymbols: [],
        },
        {
          id: 'hyp-5',
          category: 'header_mapping',
          ruleStatement: 'Column "Units" maps to semantic field "quantity_count".',
          supportingEvidenceIds: [],
          contradictoryEvidenceIds: [],
          confidence: 0.95,
          status: 'proven',
          applicableVersions: ['1.0'],
          knownExceptions: [],
          dependentAdapterSymbols: [],
        },
      ],
      aggregateConfidence: 0.95,
      provenRulesCount: 5,
      unknownRulesCount: 0,
      lastUpdated: new Date().toISOString(),
    };

    const adapter = AdapterConstructor.synthesizeAdapterFromHypotheses(validState);
    expect(adapter.formatId).toBe('my_distributor');

    const csvContent = `Track,ISRC_Code,Net_Payout,Units\nNeon Sunrise,US-IND-26-99999,42.50,100\n`;
    expect(adapter.canParse(csvContent)).toBe(true);

    const report = adapter.parse(csvContent);
    expect(report.totalGrossRevenue).toBe(42.5);
    expect(report.totalNetRevenue).toBe(42.5);
    expect(report.totalQuantity).toBe(100);
    expect(report.transactions).toHaveLength(1);
    expect(report.transactions[0]!.trackTitle).toBe('Neon Sunrise');
    expect(report.transactions[0]!.isrc).toBe('US-IND-26-99999');
    expect(report.transactions[0]!.netRevenue).toBe(42.5);
    expect(report.quarantinedRows).toHaveLength(0);
  });
});
