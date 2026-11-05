import { describe, expect, it } from 'vitest';
import { classifySpecialistFailure, specialistFailureDiagnostics } from './specialistAvailability';
import { VertexRoutingError } from './vertexRouting';

describe('specialist unavailable contract', () => {
  it('logs only bounded status and allowlisted provider codes', () => {
    expect(specialistFailureDiagnostics({ status: 403, code: 'PERMISSION_DENIED', message: 'Bearer secret', request: { prompt: 'private' } }))
      .toEqual({ providerStatus: 403, providerCode: 'PERMISSION_DENIED' });
    expect(specialistFailureDiagnostics({ status: 'secret', code: 'Bearer secret', statusCode: Infinity })).toEqual({});
    expect(specialistFailureDiagnostics(null)).toEqual({});
  });
  it.each([
    [new VertexRoutingError('UNSUPPORTED_LOCATION', 'bad route'), 'routing_misconfiguration', false],
    [new Error('404 NOT_FOUND'), 'specialist_unavailable', true],
    [new Error('503 provider unavailable'), 'provider_outage', true],
    [new Error('request timed out'), 'provider_outage', true],
    [{ status: 403, message: 'secret provider content' }, 'provider_rejected', false],
    [{ code: 'INVALID_ARGUMENT' }, 'provider_rejected', false],
    [{ status: 429 }, 'provider_outage', true],
    [new Error('unexpected SDK failure'), 'provider_unknown', false],
  ] as const)('classifies failures without exposing provider details', (cause, category, retryable) => {
    const unavailable = classifySpecialistFailure(cause);

    expect(unavailable.category).toBe(category);
    expect(unavailable.retryable).toBe(retryable);
    expect(unavailable.toPublicPayload()).toEqual({
      error: {
        code: 'SPECIALIST_UNAVAILABLE',
        message: 'This specialist is temporarily unavailable. Your request was not processed by another model.',
        retryable,
        category,
        nextActions: retryable ? ['retry_later', 'select_qualified_specialist'] : ['select_qualified_specialist'],
      },
    });
    expect(JSON.stringify(unavailable.toPublicPayload())).not.toContain('404');
    expect(JSON.stringify(unavailable.toPublicPayload())).not.toContain('endpoint');
  });
});
