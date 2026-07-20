import { describe, expect, it } from 'vitest';

import { failedOperationResult, operationResult, optionalIdempotencyKey, requireString, toolResponse } from './helpers.js';

describe('MCP result helpers', () => {
    it('creates deterministic operation ids for idempotent requests', () => {
        const input = { tool: 'test', actorUid: 'owner', status: 'succeeded' as const, resourceType: 'track', resourceId: 'track-1', idempotencyKey: 'request-123' };
        expect(operationResult(input).operationId).toBe(operationResult(input).operationId);
    });

    it('serializes the same result in text and structured content', () => {
        const result = failedOperationResult({ tool: 'test', actorUid: 'owner', resourceType: 'track', resourceId: 'track-1', code: 'NOPE', message: 'No.', retryable: false });
        const response = toolResponse(result);
        expect(JSON.parse(response.content[0]!.type === 'text' ? response.content[0].text : '{}')).toEqual(response.structuredContent);
        expect(response.isError).toBe(true);
    });

    it('validates bounded strings and safe idempotency keys', () => {
        expect(requireString({ releaseId: ' release-1 ' }, 'releaseId')).toBe('release-1');
        expect(optionalIdempotencyKey({ idempotencyKey: 'request-123' })).toBe('request-123');
        expect(() => optionalIdempotencyKey({ idempotencyKey: '../unsafe' })).toThrow('safe identifier');
    });
});
