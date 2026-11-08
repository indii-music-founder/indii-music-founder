import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@/services/business-harness';
import { HarnessTools } from '../HarnessTools';
import { HarnessRegistry } from '@/services/business-harness/HarnessCompiler';
import * as HarnessStorage from '@/services/business-harness/HarnessStorage';

describe('HarnessTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list_harness_catalog returns catalog entries', async () => {
    const result = await HarnessTools.list_harness_catalog({});
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as unknown[]).length).toBeGreaterThanOrEqual(20);
  });

  it('compile_harness unwraps payload so merch_pod compiles skus without crashing', async () => {
    const result = await HarnessTools.compile_harness({
      domain: 'merch_pod',
      payload: {
        dropGoal: 'tour_table',
        skus: [
          {
            id: 'sku-1',
            name: 'Tour T-Shirt',
            category: 't_shirt',
            baseCost: 10,
            retailPrice: 30,
            provider: 'printify',
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('run');
    const run = (result.data as { run: { domain: string; output: { recommendations: unknown[] } } }).run;
    expect(run.domain).toBe('merch_pod');
    expect(run.output.recommendations.length).toBeGreaterThan(0);
  });

  it('compile_harness with save=true saves exactly once without duplicate storage writes', async () => {
    const saveSpy = vi.spyOn(HarnessStorage, 'saveHarnessRun').mockResolvedValue('mock-run-id-123');

    const result = await HarnessTools.compile_harness({
      domain: 'song_dna',
      payload: {
        title: 'Midnight Sun',
        bpm: 120,
        key: 'A Minor',
        genre: 'Electronic',
      },
      save: true,
    });

    expect(result.success).toBe(true);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(result.data).toHaveProperty('savedRunId', 'mock-run-id-123');

    saveSpy.mockRestore();
  });

  it('has compilers registered for publishing_rights, finance, collaboration_splits, licensing_sync, royalty_revenue, legal_compliance, creative_production, security_trust', () => {
    const registered = HarnessRegistry.getAllRegisteredDomains();

    const expectedDomains = [
      'song_dna',
      'distribution_ddex',
      'merch_pod',
      'creator_protection',
      'release',
      'publishing_rights',
      'collaboration_splits',
      'finance',
      'royalty_revenue',
      'gear_asset',
      'creative_production',
      'legal_compliance',
      'licensing_sync',
      'security_trust',
      'road_travel',
      'marketing_growth',
      'fan_crm',
      'opportunity',
      'activity_time_value',
    ];

    for (const domain of expectedDomains) {
      expect(registered).toContain(domain);
      expect(HarnessRegistry.get(domain as any)).toBeDefined();
    }
  });
});
