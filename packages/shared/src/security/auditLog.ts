/**
 * indii.music SOC 2 Structured Audit Logging Framework
 * AICPA Trust Services Criteria: Security (CC7.2), Confidentiality (C1.1)
 *
 * Implements immutable, structured operational telemetry:
 * "Who did it? What did they do? When? To whose data? Was it allowed? What happened?"
 */

export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.logout',
  'auth.mfa_verify',
  'user.create',
  'user.delete',
  'user.role_change',
  'audio.upload',
  'audio.download',
  'audio.delete',
  'relay.command_dispatch',
  'relay.command_execute',
  'oauth.connect',
  'oauth.revoke',
  'secret.access',
  'admin.break_glass',
  'catalog.export',
  'split.modify',
] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number] | (string & {});

export const AUDIT_RESOURCE_TYPES = [
  'audio_vault',
  'user',
  'organization',
  'relay_session',
  'oauth_credential',
  'iam_role',
  'catalog_release',
  'contract_split',
  'system',
] as const;

export type AuditResourceType = typeof AUDIT_RESOURCE_TYPES[number] | (string & {});

export type AuditResult = 'SUCCESS' | 'DENIED' | 'ERROR';

export type AuditAuthMethod =
  | 'firebase_jwt'
  | 'relay_hmac'
  | 'google_iam'
  | 'service_account'
  | 'system_worker'
  | (string & {});

export interface AuditLogEvent {
  actor_id: string;
  organization_id: string;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string;
  timestamp: string; // ISO-8601 UTC
  result: AuditResult;
  authorization_method: AuditAuthMethod;
  request_id: string;
  source_service: string;
  metadata?: Record<string, unknown>;
}

const FORBIDDEN_METADATA_KEYS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /bearer/i,
  /authorization/i,
  /cookie/i,
  /credential/i,
];

export function sanitizeAuditMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const sanitized: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(metadata)) {
    const isForbidden = FORBIDDEN_METADATA_KEYS.some((regex) => regex.test(k));
    if (isForbidden) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeAuditMetadata(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

export function createAuditLogEvent(params: {
  actor_id: string;
  organization_id: string;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string;
  result: AuditResult;
  authorization_method: AuditAuthMethod;
  request_id?: string;
  source_service: string;
  metadata?: Record<string, unknown>;
}): AuditLogEvent {
  return {
    actor_id: params.actor_id,
    organization_id: params.organization_id,
    action: params.action,
    resource_type: params.resource_type,
    resource_id: params.resource_id,
    timestamp: new Date().toISOString(),
    result: params.result,
    authorization_method: params.authorization_method,
    request_id: params.request_id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
    source_service: params.source_service,
    metadata: sanitizeAuditMetadata(params.metadata),
  };
}
