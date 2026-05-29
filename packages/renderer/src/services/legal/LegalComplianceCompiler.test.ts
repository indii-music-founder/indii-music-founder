import { describe, it, expect } from 'vitest';
import { LegalComplianceCompiler } from './LegalComplianceCompiler';

describe('LegalComplianceCompiler', () => {
  const compiler = new LegalComplianceCompiler();
  const ctx = { userId: 'user_123', projectId: 'proj_abc' };

  it('should flag AI clauses in contracts', () => {
    const run = compiler.compile({
      items: [
        {
          id: 'item_1',
          type: 'contract',
          content: 'This contract grants rights to use artist material for AI generated works and model training.'
        }
      ]
    }, ctx);

    expect(run.findings.some(f => f.title === 'AI Clause Detected in Contract')).toBe(true);
    expect(run.recommendations.some(r => r.title === 'Attorney Review for AI Clause')).toBe(true);
    expect(run.approvalGates.some(g => g.label === 'Legal Approval for AI Clause')).toBe(true);
    expect(run.output.reviewStatus).toBe('needs_review'); // Actually it should be needs_review or blocked since severity is 3 (high). highestRiskLevel = 3 -> needs_review.
  });

  it('should block uncleared audio samples', () => {
    const run = compiler.compile({
      items: [
        {
          id: 'sample_1',
          type: 'audio_sample',
          content: 'Breakbeat sample from 1970s record',
          metadata: { cleared: false }
        }
      ]
    }, ctx);

    expect(run.findings.some(f => f.title === 'Uncleared Audio Sample')).toBe(true);
    expect(run.approvalGates.some(g => g.label === 'Sample Clearance Verification' && g.riskTier === 'blocked')).toBe(true);
    expect(run.output.reviewStatus).toBe('blocked');
  });

  it('should require provider-backed trademark clearance', () => {
    const run = compiler.compile({
      items: [
        {
          id: 'tm_1',
          type: 'trademark_name',
          content: 'Disney Beats'
        }
      ]
    }, ctx);

    expect(run.findings.some(f => f.title === 'Trademark Search Required')).toBe(true);
    expect(run.output.totalRiskScore).toBeGreaterThanOrEqual(2);
  });

  it('should block on biometric data privacy risks', () => {
    const run = compiler.compile({
      items: [
        {
          id: 'priv_1',
          type: 'data_privacy',
          content: 'App feature requires a face scan to generate 3D avatar'
        }
      ]
    }, ctx);

    expect(run.findings.some(f => f.title === 'Biometric Data Privacy Risk')).toBe(true);
    expect(run.approvalGates.some(g => g.label === 'Biometric Consent Check')).toBe(true);
    expect(run.output.reviewStatus).toBe('blocked');
  });

  it('should flag DDEX compliance issues', () => {
    const run = compiler.compile({
      items: [
        {
          id: 'ddex_1',
          type: 'release_metadata',
          content: 'Release metadata payload',
          metadata: { isrc: null, upc: '' }
        }
      ]
    }, ctx);

    expect(run.findings.some(f => f.title === 'DDEX Compliance Issue')).toBe(true);
    expect(run.agentBriefs.some(b => b.agentId === 'distribution_agent')).toBe(true);
    expect(run.output.reviewStatus).toBe('needs_review');
  });

  it('should pass cleanly with no issues', () => {
    const run = compiler.compile({
      items: [
        {
          id: 'good_1',
          type: 'contract',
          content: 'Standard non-disclosure agreement with no unusual terms.'
        },
        {
          id: 'good_2',
          type: 'audio_sample',
          content: 'Splice royalty free pack',
          metadata: { cleared: true }
        }
      ]
    }, ctx);

    expect(run.findings.length).toBe(0);
    expect(run.output.reviewStatus).toBe('pass');
    expect(run.output.totalRiskScore).toBe(0);
  });
});
