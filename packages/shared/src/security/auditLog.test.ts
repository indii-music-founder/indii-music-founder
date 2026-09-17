import { describe, it, expect } from 'vitest';
import { createAuditLogEvent, sanitizeAuditMetadata } from './auditLog.js';

describe('SOC 2 Structured Audit Logging Framework', () => {
  it('should create a valid structured audit log event', () => {
    const event = createAuditLogEvent({
      actor_id: 'usr_test_123',
      organization_id: 'org_test_456',
      action: 'audio.download',
      resource_type: 'audio_vault',
      resource_id: 'stem_master_01.wav',
      result: 'SUCCESS',
      authorization_method: 'firebase_jwt',
      source_service: 'cloud_functions',
      metadata: {
        trackTitle: 'Detroit Midnight',
        bitrate: 320,
      },
    });

    expect(event.actor_id).toBe('usr_test_123');
    expect(event.organization_id).toBe('org_test_456');
    expect(event.action).toBe('audio.download');
    expect(event.resource_type).toBe('audio_vault');
    expect(event.resource_id).toBe('stem_master_01.wav');
    expect(event.result).toBe('SUCCESS');
    expect(event.authorization_method).toBe('firebase_jwt');
    expect(event.source_service).toBe('cloud_functions');
    expect(event.timestamp).toBeDefined();
    expect(event.request_id).toBeDefined();
    expect(event.metadata).toEqual({
      trackTitle: 'Detroit Midnight',
      bitrate: 320,
    });
  });

  it('should automatically redact sensitive keys from metadata', () => {
    const sanitized = sanitizeAuditMetadata({
      userEmail: 'artist@indii.music',
      password: 'supersecretpassword',
      apiKey: 'api_123456789',
      accessToken: 'eaab_meta_oauth_token',
      nested: {
        clientSecret: 'shhh',
        safeProperty: 'public_value',
      },
    });

    expect(sanitized).toEqual({
      userEmail: 'artist@indii.music',
      password: '[REDACTED]',
      apiKey: '[REDACTED]',
      accessToken: '[REDACTED]',
      nested: {
        clientSecret: '[REDACTED]',
        safeProperty: 'public_value',
      },
    });
  });
});
