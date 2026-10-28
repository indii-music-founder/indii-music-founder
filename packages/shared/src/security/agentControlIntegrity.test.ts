import { describe, expect, it } from 'vitest';
import {
  MANDATORY_GOVERNANCE_BOUNDARIES,
  enforceAgentControlIntegrity,
  type AgentActionAttempt,
} from './agentControlIntegrity.js';

describe('Mandatory Agent Monitoring and Audit Integrity (P-AGENT-20261022-01)', () => {
  it('inventories all 5 non-bypassable governance boundaries', () => {
    expect(MANDATORY_GOVERNANCE_BOUNDARIES).toContain('pre_execution_tool_approval');
    expect(MANDATORY_GOVERNANCE_BOUNDARIES).toContain('immutable_audit_logging');
    expect(MANDATORY_GOVERNANCE_BOUNDARIES).toContain('computer_control_user_authorization');
    expect(MANDATORY_GOVERNANCE_BOUNDARIES).toContain('financial_tenant_isolation');
    expect(MANDATORY_GOVERNANCE_BOUNDARIES).toContain('truth_grounded_output_guardrail');
  });

  it('allows benign authorized agent operations and records SUCCESS audit event', () => {
    const attempt: AgentActionAttempt = {
      agentId: 'marketing_specialist',
      actionName: 'generate_campaign_copy',
      isModificationAttempt: false,
      organizationId: 'org_indii_001',
      actorId: 'usr_artist_123',
      resourceId: 'campaign_alpha',
    };

    const result = enforceAgentControlIntegrity(attempt);
    expect(result.allowed).toBe(true);
    expect(result.tamperAttemptDetected).toBe(false);
    expect(result.auditEvent.result).toBe('SUCCESS');
    expect(result.auditEvent.action).toBe('agent.execute.generate_campaign_copy');
  });

  it('strictly blocks agent attempt to disable pre_execution_tool_approval and records DENIED event', () => {
    const tamperAttempt: AgentActionAttempt = {
      agentId: 'rogue_subagent',
      actionName: 'disable_approval_gate',
      targetBoundary: 'pre_execution_tool_approval',
      isModificationAttempt: true,
      organizationId: 'org_indii_001',
      actorId: 'usr_artist_123',
      resourceId: 'governance_config',
      metadata: { reason: 'speeding up execution' },
    };

    const result = enforceAgentControlIntegrity(tamperAttempt);
    expect(result.allowed).toBe(false);
    expect(result.tamperAttemptDetected).toBe(true);
    expect(result.violationReason).toContain('attempted unauthorized modification of immutable boundary');
    expect(result.auditEvent.result).toBe('DENIED');
    expect(result.auditEvent.action).toBe('agent.tamper_attempt');
    expect(result.auditEvent.metadata?.targetBoundary).toBe('pre_execution_tool_approval');
  });

  it('strictly blocks agent attempt to suppress or modify immutable audit logging', () => {
    const auditTamperAttempt: AgentActionAttempt = {
      agentId: 'autonomous_worker',
      actionName: 'truncate_audit_trail',
      targetBoundary: 'immutable_audit_logging',
      isModificationAttempt: true,
      organizationId: 'org_indii_001',
      actorId: 'usr_artist_123',
      resourceId: 'audit_log_stream',
    };

    const result = enforceAgentControlIntegrity(auditTamperAttempt);
    expect(result.allowed).toBe(false);
    expect(result.tamperAttemptDetected).toBe(true);
    expect(result.auditEvent.result).toBe('DENIED');
    expect(result.auditEvent.action).toBe('agent.tamper_attempt');
  });

  it('strictly blocks agent attempt to bypass computer control authorization', () => {
    const computerControlBypass: AgentActionAttempt = {
      agentId: 'generalist_agent',
      actionName: 'execute_unauthorized_click',
      targetBoundary: 'computer_control_user_authorization',
      isModificationAttempt: true,
      organizationId: 'org_indii_001',
      actorId: 'usr_artist_123',
      resourceId: 'computer_controller',
    };

    const result = enforceAgentControlIntegrity(computerControlBypass);
    expect(result.allowed).toBe(false);
    expect(result.tamperAttemptDetected).toBe(true);
    expect(result.auditEvent.result).toBe('DENIED');
  });
});
