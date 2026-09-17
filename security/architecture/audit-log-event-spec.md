# Structured Audit Log Event Specification

## 1. Audit Log Schema
Every audit event emitted across indii.music services conforms to the following TypeScript interface:

```typescript
export interface AuditLogEvent {
  /** Unique ID of the actor (Firebase UID, service account email, or system worker) */
  actor_id: string;

  /** Organization / Workspace / Artist Catalog ID */
  organization_id: string;

  /** Canonical dot-separated action name */
  action:
    | 'auth.login'
    | 'auth.logout'
    | 'auth.mfa_verify'
    | 'user.role_change'
    | 'audio.upload'
    | 'audio.download'
    | 'audio.delete'
    | 'relay.command_dispatch'
    | 'relay.command_execute'
    | 'oauth.connect'
    | 'oauth.revoke'
    | 'secret.access'
    | 'admin.break_glass';

  /** Type of resource acted upon */
  resource_type: 'audio_vault' | 'user' | 'organization' | 'relay_session' | 'oauth_credential' | 'iam_role';

  /** Identifier of the target resource */
  resource_id: string;

  /** UTC ISO-8601 timestamp with millisecond precision */
  timestamp: string;

  /** Outcome of the action */
  result: 'SUCCESS' | 'DENIED' | 'ERROR';

  /** Method used to authenticate the request */
  authorization_method: 'firebase_jwt' | 'relay_hmac' | 'google_iam' | 'service_account';

  /** Distributed trace ID / UUID for correlating request logs */
  request_id: string;

  /** Originating service */
  source_service: 'web_client' | 'cloud_functions' | 'remote_relay' | 'studio_executor';

  /** Non-sensitive metadata (strictly sanitized; zero secrets/audio data) */
  metadata?: Record<string, string | number | boolean>;
}
```

## 2. Audit Trail Immutability
Audit events are written directly to Google Cloud Logging with an export sink directed to an append-only Google Cloud Storage bucket with Object Retention Lock enabled for 365 days.
