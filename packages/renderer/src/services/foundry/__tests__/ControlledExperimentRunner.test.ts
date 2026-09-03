import { describe, it, expect } from 'vitest';
import { ControlledExperimentRunner } from '../ControlledExperimentRunner';
import { ExperimentDefinition } from '@indii/shared';

describe('ControlledExperimentRunner', () => {
  const baselineTsv = `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale\n2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t14500\t55.10\tUS`;

  it('should verify invariant preservation under header casing mutation', () => {
    const experiment: ExperimentDefinition = {
      id: 'exp-casing',
      name: 'Header Casing Invariant',
      baselineEvidenceId: 'base-1',
      mutations: [
        {
          type: 'alter_column_casing',
          target: 'header',
          description: 'Uppercase all column headers',
        },
      ],
      expectedInvariant: 'isrc_semantic_preserved',
    };

    const result = ControlledExperimentRunner.runExperiment(experiment, baselineTsv);

    expect(result.success).toBe(true);
    expect(result.invariantPreserved).toBe(true);
    expect(result.differenceSummary).toContain('Uppercased header row');
  });

  it('should detect invariant failure when required column is removed', () => {
    const experiment: ExperimentDefinition = {
      id: 'exp-col-remove',
      name: 'Column Count Invariant',
      baselineEvidenceId: 'base-1',
      mutations: [
        {
          type: 'remove_optional_column',
          target: 'columns',
          description: 'Drop trailing column',
        },
      ],
      expectedInvariant: 'column_count_preserved',
    };

    const result = ControlledExperimentRunner.runExperiment(experiment, baselineTsv);

    expect(result.success).toBe(true);
    expect(result.invariantPreserved).toBe(false);
    expect(result.differenceSummary.some((d) => d.includes('Column count changed'))).toBe(true);
  });
});
