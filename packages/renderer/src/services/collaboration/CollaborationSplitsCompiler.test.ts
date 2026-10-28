import { describe, it, expect, vi } from 'vitest';
import { CollaborationSplitsCompiler, CollaborationSplitsInput } from './CollaborationSplitsCompiler';
import { HarnessContext } from '../business-harness/HarnessCompiler';
import * as typesafeJudgments from '@/config/typesafeJudgments';

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

  it('should not require a producer agreement for an executive producer (non-track producer)', () => {
    const input: CollaborationSplitsInput = {
      trackId: 'track-1',
      trackTitle: 'Hit Song',
      collaborators: [
        {
          id: 'collab-1',
          name: 'Alice',
          roles: ['executive producer'],
          contributionNotes: 'Funded studio sessions',
          proposedSplit: 100,
          approvalStatus: 'approved',
          hasAgreement: false
        }
      ]
    };

    const run = compiler.compile(input, ctx);

    // Missing regular collaborator agreement, but NOT the specific Producer Agreement
    expect(run.findings).toContainEqual(
      expect.objectContaining({
        title: 'Missing Collaborator Agreement'
      })
    );
    expect(run.findings).not.toContainEqual(
      expect.objectContaining({
        title: 'Missing Producer Agreement'
      })
    );
  });

  it('should respect semantic requiresProducerAgreement flag from Jev judgment', () => {
    const input: CollaborationSplitsInput = {
      trackId: 'track-1',
      trackTitle: 'Hit Song',
      collaborators: [
        {
          id: 'collab-1',
          name: 'Dave',
          roles: ['sound architect'], // Non-standard title
          contributionNotes: 'Handled drum sound design & tracking',
          proposedSplit: 100,
          approvalStatus: 'approved',
          hasAgreement: false,
          ...({ requiresProducerAgreement: true } as object)
        }
      ]
    };

    const run = compiler.compile(input, ctx);

    expect(run.findings).toContainEqual(
      expect.objectContaining({
        title: 'Missing Producer Agreement'
      })
    );
  });

  it('should asynchronously enrich collaborator roles via judgeCollaboratorRoleSemantics in compileAsync', async () => {
    const judgeSpy = vi.spyOn(typesafeJudgments, 'judgeCollaboratorRoleSemantics');
    judgeSpy.mockImplementation(async (role: string) => {
      if (role === 'Sonic Architect') {
        return {
          roleCategory: 'producer',
          isProducerRequiringAgreement: true,
          confidence: 0.95,
        };
      }
      if (role === 'Executive Producer') {
        return {
          roleCategory: 'other',
          isProducerRequiringAgreement: false,
          confidence: 0.99,
        };
      }
      return null;
    });

    const input: CollaborationSplitsInput = {
      trackId: 'track-async',
      trackTitle: 'Async Symphony',
      collaborators: [
        {
          id: 'collab-sonic',
          name: 'Sam',
          roles: ['Sonic Architect'],
          contributionNotes: 'Crafted the entire instrumental framework',
          proposedSplit: 60,
          approvalStatus: 'approved',
          hasAgreement: false,
        },
        {
          id: 'collab-exec',
          name: 'Elena',
          roles: ['Executive Producer'],
          contributionNotes: 'Project financing & studio booking',
          proposedSplit: 40,
          approvalStatus: 'approved',
          hasAgreement: false,
        },
      ],
    };

    const run = await compiler.compileAsync(input, ctx);

    expect(judgeSpy).toHaveBeenCalled();
    // Sam should trigger missing Producer Agreement gate
    expect(run.findings).toContainEqual(
      expect.objectContaining({
        title: 'Missing Producer Agreement',
        detail: expect.stringContaining('Sam'),
      })
    );
    // Elena (Executive Producer) should only trigger general collaborator agreement
    expect(run.findings).toContainEqual(
      expect.objectContaining({
        title: 'Missing Collaborator Agreement',
        detail: expect.stringContaining('Elena'),
      })
    );
    expect(run.findings).not.toContainEqual(
      expect.objectContaining({
        title: 'Missing Producer Agreement',
        detail: expect.stringContaining('Elena'),
      })
    );

    judgeSpy.mockRestore();
  });
});
