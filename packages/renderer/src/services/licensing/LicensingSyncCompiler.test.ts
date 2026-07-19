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

  it('unknown clearance stays pending and keeps the approval gate active', () => {
    const input: LicensingSyncInput = {
      trackId: 'track_pending',
      hasStems: true,
      hasInstrumental: true,
      hasLyrics: true,
      hasUnClearedSamples: false,
      metadataComplete: true,
      catalogSearchable: true,
    };

    const run = compiler.compile(input, baseCtx);

    expect(run.output.rightsClearanceStatus).toBe('pending');
    expect(run.output.pitchPackageGenerated).toBe(false);
    expect(run.scores.find(s => s.label === 'Rights Clearance')?.status).toBe('watch');
    expect(run.approvalGates.some(g => g.id === 'gate_clearance_evidence')).toBe(true);
  });

  it('approved clearance documents are required before the compiler can mark a pitch cleared (ISSUE-827)', () => {
    const input: LicensingSyncInput = {
      trackId: 'track_3',
      hasStems: true,
      hasInstrumental: true,
      hasLyrics: true,
      hasUnClearedSamples: false,
      metadataComplete: true,
      catalogSearchable: true,
      approvedClearanceDocIds: ['clearance-doc-1'],
      verifiedClearanceEvidenceRefs: [
        {
          id: 'clearance-doc-1',
          type: 'document',
          label: 'Approved clearance letter',
          url: 'https://example.com/clearance-letter.pdf',
        },
      ],
      opportunityFitScore: 98, // Perfect match >= 95
    };

    const run = compiler.compile(input, baseCtx);

    expect(run.output.syncReadinessScore).toBe(100);
    expect(run.output.rightsClearanceStatus).toBe('cleared');
    expect(run.output.pitchPackageGenerated).toBe(true);
    expect(run.recommendations.some(r => r.title === 'Auto-Pitch Recommendation')).toBe(true);
    expect(run.agentBriefs.some(b => b.agentId === 'marketing')).toBe(true);
    expect(run.evidenceRefs).toHaveLength(1);
  });

  it('evidence refs alone cannot clear a track without approvedClearanceDocIds (ISSUE-827 honesty fix)', () => {
    const input: LicensingSyncInput = {
      trackId: 'track_evidence_only',
      hasStems: true,
      hasInstrumental: true,
      hasLyrics: true,
      hasUnClearedSamples: false,
      metadataComplete: true,
      catalogSearchable: true,
      // approvedClearanceDocIds is empty/missing
      verifiedClearanceEvidenceRefs: [
        {
          id: 'clearance-doc-1',
          type: 'document',
          label: 'Some evidence',
        },
      ],
    };

    const run = compiler.compile(input, baseCtx);

    expect(run.output.rightsClearanceStatus).toBe('pending');
    expect(run.output.pitchPackageGenerated).toBe(false);
    expect(run.approvalGates.some(g => g.id === 'gate_clearance_evidence')).toBe(true);
  });

  it('empty approvedClearanceDocIds array keeps clearance pending', () => {
    const input: LicensingSyncInput = {
      trackId: 'track_empty_docs',
      hasStems: true,
      hasInstrumental: true,
      hasLyrics: true,
      hasUnClearedSamples: false,
      metadataComplete: true,
      catalogSearchable: true,
      approvedClearanceDocIds: [], // Explicitly empty
    };

    const run = compiler.compile(input, baseCtx);

    expect(run.output.rightsClearanceStatus).toBe('pending');
    expect(run.output.pitchPackageGenerated).toBe(false);
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
