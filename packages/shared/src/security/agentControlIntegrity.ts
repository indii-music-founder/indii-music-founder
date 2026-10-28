import { z } from 'zod';
import { createAuditLogEvent, type AuditLogEvent } from './auditLog.js';

/**
 * Inventory of mandatory, non-bypassable governance boundaries for all AI agents.
 * No agent execution may disable, alter, or circumvent these boundaries.
 */
export const MANDATORY_GOVERNANCE_BOUNDARIES = [
  'pre_execution_tool_approval',
  'immutable_audit_logging',
  'computer_control_user_authorization',
  'financial_tenant_isolation',
  'truth_grounded_output_guardrail',
] as const;
export type MandatoryGovernanceBoundary = typeof MANDATORY_GOVERNANCE_BOUNDARIES[number];

export const AgentActionAttemptSchema = z.object({
  agentId: z.string().trim().min(1),
  actionName: z.string().trim().min(1),
  targetBoundary: z.enum(MANDATORY_GOVERNANCE_BOUNDARIES).optional(),
  isModificationAttempt: z.boolean().default(false),
  organizationId: z.string().trim().min(1),
  actorId: z.string().trim().min(1),
  resourceId: z.string().trim().min(1),
  metadata: z.record(z.unknown()).optional(),
}).strict();
export type AgentActionAttempt = z.infer<typeof AgentActionAttemptSchema>;

export interface BoundaryEnforcementResult {
  allowed: boolean;
  tamperAttemptDetected: boolean;
  auditEvent: AuditLogEvent;
  violationReason?: string;
}

/**
 * Enforces non-bypassable agent monitoring, authorization, and audit integrity.
 *
 * Directives:
 * 1. Bounded agents CANNOT disable, modify, or suppress mandatory controls.
 * 2. Any attempt by an agent to modify a mandatory governance boundary is strictly blocked.
 * 3. All denied attempts are recorded into immutable audit logs with result: 'DENIED'.
 * 4. Audit events cannot be suppressed by agents.
 */
export function enforceAgentControlIntegrity(
  attempt: AgentActionAttempt
): BoundaryEnforcementResult {
  // Tamper detection: Agent attempts to modify, override, or disable a mandatory control
  if (attempt.targetBoundary && attempt.isModificationAttempt) {
    const deniedEvent = createAuditLogEvent({
      actor_id: attempt.actorId,
      organization_id: attempt.organizationId,
      action: 'agent.tamper_attempt',
      resource_type: 'system',
      resource_id: attempt.resourceId,
      result: 'DENIED',
      authorization_method: 'system_worker',
      source_service: 'agent_governance_integrity',
      metadata: {
        agentId: attempt.agentId,
        actionName: attempt.actionName,
        targetBoundary: attempt.targetBoundary,
        violation: 'Attempted modification of immutable governance boundary',
        ...attempt.metadata,
      },
    });

    return {
      allowed: false,
      tamperAttemptDetected: true,
      auditEvent: deniedEvent,
      violationReason: `Security violation: Agent "${attempt.agentId}" attempted unauthorized modification of immutable boundary "${attempt.targetBoundary}".`,
    };
  }

  // Normal authorized agent operation
  const successEvent = createAuditLogEvent({
    actor_id: attempt.actorId,
    organization_id: attempt.organizationId,
    action: `agent.execute.${attempt.actionName}`,
    resource_type: 'system',
    resource_id: attempt.resourceId,
    result: 'SUCCESS',
    authorization_method: 'system_worker',
    source_service: 'agent_governance_integrity',
    metadata: {
      agentId: attempt.agentId,
      actionName: attempt.actionName,
      ...attempt.metadata,
    },
  });

  return {
    allowed: true,
    tamperAttemptDetected: false,
    auditEvent: successEvent,
  };
}
