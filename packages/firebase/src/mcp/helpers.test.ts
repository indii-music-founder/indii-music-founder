import { describe, expect, it } from 'vitest';

import { failedOperationResult, operationResult, optionalIdempotencyKey, requireString, toolResponse, verifyReleaseOwnership, type OwnershipFirestore } from './helpers.js';

function fakeFirestore(docs: Record<string, Record<string, unknown>>): OwnershipFirestore {
    const ref = (path: string) => ({
        get: async () => ({ exists: path in docs, data: () => docs[path] }),
        collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
    });
    return { collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }) };
}

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

describe('verifyReleaseOwnership', () => {
    const FORBIDDEN = 'Forbidden: release not found or not owned by caller';

    it('accepts a release in the caller subcollection', async () => {
        const db = fakeFirestore({ 'users/u1/releases/r1': {} });
        await expect(verifyReleaseOwnership(db, 'u1', 'r1')).resolves.toBeUndefined();
    });

    it('accepts a top-level release owned via userId or ownerUid', async () => {
        await expect(verifyReleaseOwnership(fakeFirestore({ 'releases/r1': { userId: 'u1' } }), 'u1', 'r1')).resolves.toBeUndefined();
        await expect(verifyReleaseOwnership(fakeFirestore({ 'releases/r2': { ownerUid: 'u1' } }), 'u1', 'r2')).resolves.toBeUndefined();
    });

    it('rejects a top-level release owned by another user with the same message as not-found', async () => {
        await expect(verifyReleaseOwnership(fakeFirestore({ 'releases/r1': { userId: 'other' } }), 'u1', 'r1')).rejects.toThrow(FORBIDDEN);
        await expect(verifyReleaseOwnership(fakeFirestore({}), 'u1', 'missing')).rejects.toThrow(FORBIDDEN);
    });

    it('rejects malformed release ids before any lookup', async () => {
        const db = fakeFirestore({});
        await expect(verifyReleaseOwnership(db, 'u1', 'a/b')).rejects.toThrow(TypeError);
        await expect(verifyReleaseOwnership(db, 'u1', '  ')).rejects.toThrow(TypeError);
        await expect(verifyReleaseOwnership(db, 'u1', 'x'.repeat(201))).rejects.toThrow(TypeError);
    });
});
