import { describe, it, expect } from 'vitest';
import { CreativeProductionCompiler } from './CreativeProductionCompiler';
import type { HarnessContext } from '../business-harness/HarnessCompiler';

describe('CreativeProductionCompiler', () => {
  const compiler = new CreativeProductionCompiler();
  const ctx: HarnessContext = { userId: 'user-123' };

  it('should compile successfully when all assets are present and ready', () => {
    const input = {
      tracks: [{
        id: 'track-1',
        title: 'Hit Song',
        hasDemo: true,
        hasMix: true,
        hasMaster: true,
        hasStems: true,
        credits: [{ role: 'producer', name: 'John Doe' }]
      }],
      artwork: {
        hasArtwork: true,
        hasLegalIssue: false,
        hasBrandIssue: false
      }
    };

    const run = compiler.compile(input, ctx);
    expect(run.domain).toBe('creative_production');
    expect(run.schemaVersion).toBe(1);
    expect(run.output.deliveryReady).toBe(true);
    expect(run.output.syncReadyScore).toBe(100);
    expect(run.output.creditsComplete).toBe(true);
    expect(run.output.missingItems).toHaveLength(0);
    expect(run.findings).toHaveLength(0);
    expect(run.approvalGates).toHaveLength(0);
  });

  it('should block delivery if master is missing', () => {
    const input = {
      tracks: [{
        id: 'track-1',
        title: 'Hit Song',
        hasDemo: true,
        hasMix: true,
        hasMaster: false,
        hasStems: true,
        credits: [{ role: 'producer', name: 'John Doe' }]
      }],
      artwork: {
        hasArtwork: true,
        hasLegalIssue: false,
        hasBrandIssue: false
      }
    };

    const run = compiler.compile(input, ctx);
    expect(run.output.deliveryReady).toBe(false);
    expect(run.output.missingItems).toContain('Master missing for track: Hit Song');
    expect(run.findings.some(f => f.id === 'missing_master_track-1')).toBe(true);
  });

  it('should reduce sync score if stems are missing', () => {
    const input = {
      tracks: [{
        id: 'track-1',
        title: 'Hit Song',
        hasDemo: true,
        hasMix: true,
        hasMaster: true,
        hasStems: false,
        credits: [{ role: 'producer', name: 'John Doe' }]
      }],
      artwork: {
        hasArtwork: true,
        hasLegalIssue: false,
        hasBrandIssue: false
      }
    };

    const run = compiler.compile(input, ctx);
    expect(run.output.syncReadyScore).toBeLessThan(100);
    expect(run.findings.some(f => f.id === 'missing_stems_track-1')).toBe(true);
    expect(run.recommendations.some(r => r.id === 'upload_stems_track-1')).toBe(true);
  });

  it('should route to Legal and Merch if artwork has issues', () => {
    const input = {
      tracks: [{
        id: 'track-1',
        title: 'Hit Song',
        hasDemo: true,
        hasMix: true,
        hasMaster: true,
        hasStems: true,
        credits: [{ role: 'producer', name: 'John Doe' }]
      }],
      artwork: {
        hasArtwork: true,
        hasLegalIssue: true,
        hasBrandIssue: false
      }
    };

    const run = compiler.compile(input, ctx);
    expect(run.output.deliveryReady).toBe(false);
    expect(run.findings.some(f => f.id === 'artwork_issue')).toBe(true);
    expect(run.approvalGates.some(g => g.id === 'artwork_legal_approval')).toBe(true);
    expect(run.agentBriefs.some(b => b.agentId === 'legal')).toBe(true);
    expect(run.agentBriefs.some(b => b.agentId === 'merch')).toBe(true);
  });

  it('should flag missing credits', () => {
    const input = {
      tracks: [{
        id: 'track-1',
        title: 'Hit Song',
        hasDemo: true,
        hasMix: true,
        hasMaster: true,
        hasStems: true,
        credits: []
      }],
      artwork: {
        hasArtwork: true,
        hasLegalIssue: false,
        hasBrandIssue: false
      }
    };

    const run = compiler.compile(input, ctx);
    expect(run.output.creditsComplete).toBe(false);
    expect(run.findings.some(f => f.id === 'missing_credits_track-1')).toBe(true);
    expect(run.recommendations.some(r => r.id === 'complete_credits')).toBe(true);
  });
});
