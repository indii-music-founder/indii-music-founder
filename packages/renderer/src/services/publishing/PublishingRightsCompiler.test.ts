import { describe, it, expect } from 'vitest';
import { PublishingRightsCompiler, PublishingRightsInput } from './PublishingRightsCompiler';
import { HarnessContext } from '../business-harness/HarnessCompiler';

describe('PublishingRightsCompiler', () => {
  const compiler = new PublishingRightsCompiler();
  const ctx: HarnessContext = { userId: 'user_1' };

  it('compiles a ready composition successfully', () => {
    const input: PublishingRightsInput = {
      songId: 'song_123',
      songTitle: 'Hit Track',
      iswc: 'T-123.456.789-Z',
      proRegistrationStatus: 'registered',
      mlcRegistrationStatus: 'registered',
      writers: [
        {
          id: 'w1',
          name: 'Writer One',
          sharePercentage: 50,
          publisherSharePercentage: 50,
          proAffiliation: 'ASCAP',
          ipiNumber: '111111111',
          approvedSplitSheet: true,
        },
        {
          id: 'w2',
          name: 'Writer Two',
          sharePercentage: 50,
          publisherSharePercentage: 50,
          proAffiliation: 'BMI',
          ipiNumber: '222222222',
          approvedSplitSheet: true,
        },
      ],
    };

    const run = compiler.compile(input, ctx);

    expect(run.domain).toBe('publishing_rights');
    expect(run.output.registrationReady).toBe(true);
    expect(run.output.blockers).toHaveLength(0);
    expect(run.output.iswcStatus).toBe('assigned');
    expect(run.output.needsMlc).toBe(false);
    expect(run.findings).toHaveLength(0);
    expect(run.scores[0]!.status).toBe('good');
  });

  it('detects missing split sheet approvals as a blocker', () => {
    const input: PublishingRightsInput = {
      songId: 'song_123',
      songTitle: 'Hit Track',
      iswc: 'T-123.456.789-Z',
      proRegistrationStatus: 'registered',
      mlcRegistrationStatus: 'registered',
      writers: [
        {
          id: 'w1',
          name: 'Writer One',
          sharePercentage: 50,
          publisherSharePercentage: 50,
          approvedSplitSheet: true,
        },
        {
          id: 'w2',
          name: 'Writer Two',
          sharePercentage: 50,
          publisherSharePercentage: 50,
          approvedSplitSheet: false, // Not approved!
        },
      ],
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.registrationReady).toBe(false);
    expect(run.output.blockers).toContain('Missing split sheet approval from Writer Two');
    expect(run.output.pendingApprovals).toContain('Writer Two');
    expect(run.approvalGates).toHaveLength(1);
    expect(run.approvalGates[0]!.id).toBe('split_approval_w2');
    expect(run.approvalGates[0]!.riskTier).toBe('blocked');
    
    const unapprovedFinding = run.findings.find(f => f.id === 'missing_split_approvals');
    expect(unapprovedFinding).toBeDefined();
    expect(unapprovedFinding!.severity).toBe('critical');

    expect(run.scores[0]!.status).toBe('blocked');
    expect(run.scores[0]!.value).toBe(1); // 1 out of 2 approved
  });

  it('distinguishes between missing ISWC and actual registration blockers', () => {
    const input: PublishingRightsInput = {
      songId: 'song_123',
      songTitle: 'Hit Track',
      // ISWC missing
      proRegistrationStatus: 'registered',
      mlcRegistrationStatus: 'registered',
      writers: [
        {
          id: 'w1',
          name: 'Writer One',
          sharePercentage: 100,
          publisherSharePercentage: 100,
          ipiNumber: '111111111',
          approvedSplitSheet: true,
        },
      ],
    };

    const run = compiler.compile(input, ctx);

    // Missing ISWC is not a delivery blocker! So registrationReady is true
    expect(run.output.registrationReady).toBe(true);
    expect(run.output.iswcStatus).toBe('missing');
    
    const iswcFinding = run.findings.find(f => f.id === 'missing_iswc');
    expect(iswcFinding).toBeDefined();
    expect(iswcFinding!.severity).toBe('medium');
    expect(iswcFinding!.detail).toContain('does not block delivery');
    
    expect(run.recommendations.find(r => r.id === 'register_iswc')).toBeDefined();
  });

  it('flags unregistered PRO and MLC as issues', () => {
    const input: PublishingRightsInput = {
      songId: 'song_123',
      songTitle: 'Hit Track',
      iswc: 'T-123.456.789-Z',
      proRegistrationStatus: 'unregistered',
      mlcRegistrationStatus: 'unregistered',
      writers: [
        {
          id: 'w1',
          name: 'Writer One',
          sharePercentage: 100,
          publisherSharePercentage: 100,
          approvedSplitSheet: true,
        },
      ],
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.registrationReady).toBe(false);
    expect(run.output.blockers).toContain('Not registered with a PRO.');
    expect(run.output.needsMlc).toBe(true);

    const proFinding = run.findings.find(f => f.id === 'pro_unregistered');
    expect(proFinding).toBeDefined();
    
    const mlcFinding = run.findings.find(f => f.id === 'mlc_unregistered');
    expect(mlcFinding).toBeDefined();
  });

  it('detects mathematically incorrect split totals', () => {
    const input: PublishingRightsInput = {
      songId: 'song_123',
      songTitle: 'Hit Track',
      iswc: 'T-123.456.789-Z',
      proRegistrationStatus: 'registered',
      mlcRegistrationStatus: 'registered',
      writers: [
        {
          id: 'w1',
          name: 'Writer One',
          sharePercentage: 60, // Total = 110!
          publisherSharePercentage: 50,
          approvedSplitSheet: true,
        },
        {
          id: 'w2',
          name: 'Writer Two',
          sharePercentage: 50,
          publisherSharePercentage: 50,
          approvedSplitSheet: true,
        },
      ],
    };

    const run = compiler.compile(input, ctx);

    expect(run.output.registrationReady).toBe(false);
    expect(run.output.blockers).toContain('Total writer share is 110%, must be exactly 100%.');
    
    const writerShareFinding = run.findings.find(f => f.id === 'invalid_writer_share');
    expect(writerShareFinding).toBeDefined();
  });
});
