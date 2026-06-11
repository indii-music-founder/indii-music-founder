import { describe, it, expect } from 'vitest';
import { CollaborationSplitsCompiler, CollaborationSplitsInput } from './CollaborationSplitsCompiler';
import { HarnessContext } from '../business-harness/HarnessCompiler';

describe('CollaborationSplitsCompiler', () => {
  const compiler = new CollaborationSplitsCompiler();
  const ctx: HarnessContext = {
    userId: 'user-123',
    projectId: 'proj-456'
  };

  it('should process perfect, ready-to-sign splits', () => {
    const input: CollaborationSplitsInput = {
      trackId: 'track-1',
      trackTitle: 'Hit Song',
      collaborators: [
        {
          id: 'collab-1',
          name: 'Alice',
          roles: ['writer', 'vocalist'],
          contributionNotes: 'Lyrics',
          proposedSplit: 50,
          approvalStatus: 'approved',
          hasAgreement: true
        },
        {
          id: 'collab-2',
          name: 'Bob',
          roles: ['producer'],
          contributionNotes: 'Beat',
          proposedSplit: 50,
          approvalStatus: 'approved',
          hasAgreement: true
        }
      ]
    };

    const run = compiler.compile(input, ctx);

    expect(run.domain).toBe('collaboration_splits');
    expect(run.output.totalSplit).toBe(100);
    expect(run.output.readyForSplitSheet).toBe(true);
    expect(run.output.isDisputed).toBe(false);
    expect(run.output.missingAgreements).toEqual([]);
    expect(run.findings.length).toBe(0);
    expect(run.approvalGates.length).toBe(0);
  });

  it('should block release and licensing when splits are disputed', () => {
    const input: CollaborationSplitsInput = {
      trackId: 'track-1',
      trackTitle: 'Hit Song',
      collaborators: [
        {
          id: 'collab-1',
          name: 'Alice',
          roles: ['writer'],
          contributionNotes: 'Lyrics',
          proposedSplit: 60,
          approvalStatus: 'approved',
          hasAgreement: true
        },
        {
          id: 'collab-2',
          name: 'Bob',
          roles: ['producer'],
          contributionNotes: 'Beat',
          proposedSplit: 40,
          approvalStatus: 'disputed',
          hasAgreement: true
        }
      ]
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.isDisputed).toBe(true);
    expect(run.output.readyForSplitSheet).toBe(false);
    expect(run.findings).toContainEqual(
      expect.objectContaining({
        domain: 'collaboration_splits',
        severity: 'critical',
        title: 'Split Disputed'
      })
    );
    expect(run.approvalGates).toContainEqual(
      expect.objectContaining({
        requiredFor: 'release, licensing_sync',
        riskTier: 'blocked'
      })
    );
  });

  it('should create legal and finance findings for missing producer agreements', () => {
    const input: CollaborationSplitsInput = {
      trackId: 'track-1',
      trackTitle: 'Hit Song',
      collaborators: [
        {
          id: 'collab-1',
          name: 'Alice',
          roles: ['writer'],
          contributionNotes: 'Lyrics',
          proposedSplit: 50,
          approvalStatus: 'approved',
          hasAgreement: true
        },
        {
          id: 'collab-2',
          name: 'Bob',
          roles: ['producer'],
          contributionNotes: 'Beat',
          proposedSplit: 50,
          approvalStatus: 'approved',
          hasAgreement: false
        }
      ]
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.missingAgreements).toContain('collab-2');
    
    // Check for Legal finding
    expect(run.findings).toContainEqual(
      expect.objectContaining({
        domain: 'legal_compliance',
        title: 'Missing Producer Agreement'
      })
    );
    
    // Check for Finance finding
    expect(run.findings).toContainEqual(
      expect.objectContaining({
        domain: 'finance',
        title: 'Potential Uncaptured Producer Points/Advances'
      })
    );

    // Check for Approval Gate for DDEX
    expect(run.approvalGates).toContainEqual(
      expect.objectContaining({
        requiredFor: 'distribution_ddex',
        riskTier: 'blocked'
      })
    );
  });

  it('should flag if splits do not equal 100%', () => {
    const input: CollaborationSplitsInput = {
      trackId: 'track-1',
      trackTitle: 'Hit Song',
      collaborators: [
        {
          id: 'collab-1',
          name: 'Alice',
          roles: ['writer'],
          contributionNotes: 'Lyrics',
          proposedSplit: 60,
          approvalStatus: 'approved',
          hasAgreement: true
        },
        {
          id: 'collab-2',
          name: 'Bob',
          roles: ['producer'],
          contributionNotes: 'Beat',
          proposedSplit: 50, // Total = 110
          approvalStatus: 'approved',
          hasAgreement: true
        }
      ]
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.totalSplit).toBe(110);
    expect(run.output.readyForSplitSheet).toBe(false);
    expect(run.findings).toContainEqual(
      expect.objectContaining({
        title: 'Invalid Split Total',
        severity: 'critical'
      })
    );
  });
});
