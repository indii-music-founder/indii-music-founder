import { describe, it, expect } from 'vitest';
import { SecurityTrustCompiler, SecurityTrustInput } from './SecurityTrustCompiler';
import type { HarnessContext } from '../business-harness/HarnessCompiler';

describe('SecurityTrustCompiler', () => {
  const compiler = new SecurityTrustCompiler();
  const baseCtx: HarnessContext = { userId: 'user_123', projectId: 'proj_abc' };

  it('should block biometric action if opt-in is missing', () => {
    const input: SecurityTrustInput = {
      actionType: 'biometrics',
      actionDetails: {},
      biometricOptIn: false,
    };
    const result = compiler.compile(input, baseCtx);
    
    expect(result.output.actionApproved).toBe(false);
    expect(result.approvalGates.find(g => g.id === 'gate_biometrics_opt_in')).toBeDefined();
    expect(result.findings.find(f => f.id === 'finding_biometrics_missing_opt_in')).toBeDefined();
  });

  it('should allow biometric action if opt-in is provided', () => {
    const input: SecurityTrustInput = {
      actionType: 'biometrics',
      actionDetails: {},
      biometricOptIn: true,
    };
    const result = compiler.compile(input, baseCtx);
    
    expect(result.output.actionApproved).toBe(true);
    expect(result.approvalGates.find(g => g.id === 'gate_biometrics_opt_in')).toBeUndefined();
  });

  it('should block delivery if legal notice is not approved', () => {
    const input: SecurityTrustInput = {
      actionType: 'delivery',
      actionDetails: {},
      legalNoticeApproved: false,
    };
    const result = compiler.compile(input, baseCtx);
    
    expect(result.output.actionApproved).toBe(false);
    expect(result.approvalGates.find(g => g.id === 'gate_legal_notice')).toBeDefined();
  });

  it('should flag external API credential handling', () => {
    const input: SecurityTrustInput = {
      actionType: 'credentials',
      actionDetails: {},
      isExternalApi: true,
    };
    const result = compiler.compile(input, baseCtx);
    
    expect(result.approvalGates.find(g => g.id === 'gate_credential_handling')).toBeDefined();
    expect(result.agentBriefs.find(b => b.agentId === 'devops_agent')).toBeDefined();
  });

  it('should set spending risk gate for large amounts', () => {
    const input: SecurityTrustInput = {
      actionType: 'spending',
      actionDetails: {},
      spendingAmount: 5000,
    };
    const result = compiler.compile(input, baseCtx);
    
    expect(result.output.actionApproved).toBe(false);
    expect(result.approvalGates.find(g => g.id === 'gate_spending_limit')).toBeDefined();
  });

  it('should require publishing risk gate for delivery', () => {
    const input: SecurityTrustInput = {
      actionType: 'delivery',
      actionDetails: {},
      legalNoticeApproved: true,
    };
    const result = compiler.compile(input, baseCtx);
    
    expect(result.output.actionApproved).toBe(true);
    expect(result.approvalGates.find(g => g.id === 'gate_publishing_risk')).toBeDefined();
  });

  it('should warn and block on evidence packet tamper', () => {
    const input: SecurityTrustInput = {
      actionType: 'evidence',
      actionDetails: {},
      evidenceTampered: true,
    };
    const result = compiler.compile(input, baseCtx);
    
    expect(result.output.actionApproved).toBe(false);
    expect(result.findings.find(f => f.id === 'finding_evidence_tampered')).toBeDefined();
    expect(result.agentBriefs.find(b => b.agentId === 'legal_agent')).toBeDefined();
  });

  it('should properly emit normalized HarnessRun', () => {
    const input: SecurityTrustInput = {
      actionType: 'agent_permissions',
      actionDetails: {},
      legalNoticeApproved: true,
    };
    const result = compiler.compile(input, baseCtx);

    expect(result.schemaVersion).toBe(1);
    expect(result.domain).toBe('security_trust');
    expect(result.userId).toBe('user_123');
    expect(result.projectId).toBe('proj_abc');
    expect(result.output.auditLogId).toBeDefined();
  });
});
