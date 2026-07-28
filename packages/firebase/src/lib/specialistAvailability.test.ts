import { describe, expect, it } from 'vitest';
import { classifySpecialistFailure } from './specialistAvailability';
import { VertexRoutingError } from './vertexRouting';

describe('specialist unavailable contract', () => {
  it.each([
    [new VertexRoutingError('UNSUPPORTED_LOCATION', 'bad route'), 'routing_misconfiguration', false],
    [new Error('404 NOT_FOUND'), 'specialist_unavailable', true],
    [new Error('503 provider unavailable'), 'provider_outage', true],
    [new Error('request timed out'), 'provider_outage', true],
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
        nextActions: ['retry_later', 'select_qualified_specialist'],
      },
    });
    expect(JSON.stringify(unavailable.toPublicPayload())).not.toContain('404');
    expect(JSON.stringify(unavailable.toPublicPayload())).not.toContain('endpoint');
  });
});
