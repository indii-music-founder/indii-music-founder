import { describe, it, expect } from 'vitest';
import { LicensingSyncCompiler, LicensingSyncInput } from './LicensingSyncCompiler';

describe('LicensingSyncCompiler', () => {
  const compiler = new LicensingSyncCompiler();
  const baseCtx = { userId: 'user_1' };

  it('un-cleared sample blocks sync pitch', () => {
    const input: LicensingSyncInput = {
      trackId: 'track_1',
      hasStems: true,
      hasInstrumental: true,
      hasLyrics: true,
      hasUnClearedSamples: true, // This blocks it
      metadataComplete: true,
      catalogSearchable: true,
    };

    const run = compiler.compile(input, baseCtx);
    
    expect(run.output.rightsClearanceStatus).toBe('blocked');
    expect(run.output.pitchPackageGenerated).toBe(false);
    expect(run.output.syncReadinessScore).toBe(0);
    expect(run.findings.some(f => f.title === 'Un-cleared Samples')).toBe(true);
    expect(run.approvalGates.some(g => g.id === 'gate_sample_clearance')).toBe(true);
  });

  it('missing stems reduces readiness score', () => {
    const input: LicensingSyncInput = {
      trackId: 'track_2',
      hasStems: false, // Missing
      hasInstrumental: true,
      hasLyrics: true,
      hasUnClearedSamples: false,
      metadataComplete: true,
      catalogSearchable: true,
    };

    const run = compiler.compile(input, baseCtx);

    const readinessScore = run.scores.find(s => s.label === 'Sync Readiness');
    expect(readinessScore?.value).toBe(80); // 100 - 20
    expect(run.output.syncReadinessScore).toBe(80);
    expect(run.findings.some(f => f.title === 'Missing Stems')).toBe(true);
  });

  it('perfect match triggers auto-pitch recommendation', () => {
    const input: LicensingSyncInput = {
      trackId: 'track_3',
      hasStems: true,
      hasInstrumental: true,
      hasLyrics: true,
      hasUnClearedSamples: false,
      metadataComplete: true,
      catalogSearchable: true,
      opportunityFitScore: 98, // Perfect match >= 95
    };

    const run = compiler.compile(input, baseCtx);

    expect(run.output.syncReadinessScore).toBe(100);
    expect(run.output.rightsClearanceStatus).toBe('cleared');
    expect(run.output.pitchPackageGenerated).toBe(true);
    expect(run.recommendations.some(r => r.title === 'Auto-Pitch Recommendation')).toBe(true);
    expect(run.agentBriefs.some(b => b.agentId === 'marketing_agent')).toBe(true);
  });

  it('missing multiple assets significantly reduces readiness', () => {
    const input: LicensingSyncInput = {
      trackId: 'track_4',
      hasStems: false,
      hasInstrumental: false,
      hasLyrics: false,
      hasUnClearedSamples: false,
      metadataComplete: false,
      catalogSearchable: false,
    };

    const run = compiler.compile(input, baseCtx);
    
    // 100 - 20 (stems) - 20 (instrumental) - 10 (lyrics) - 20 (metadata) = 30
    expect(run.output.syncReadinessScore).toBe(30);
    expect(run.output.pitchPackageGenerated).toBe(false);
    expect(run.scores.find(s => s.label === 'Sync Readiness')?.status).toBe('blocked');
    expect(run.findings.some(f => f.title === 'Not Catalog Searchable')).toBe(true);
  });
});
