import { describe, expect, it } from 'vitest';

import { failedOperationResult, operationResult, optionalIdempotencyKey, requireString, resolveOwnedRelease, toolResponse, verifyReleaseOwnership, type OwnershipFirestore } from './helpers.js';

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

describe('resolveOwnedRelease (ISSUE-1692)', () => {
    const FORBIDDEN = 'Forbidden: release not found or not owned by caller';

    it('accepts a Distribution/Publishing release in proprietaryIngestionReleases owned by the caller', async () => {
        const db = fakeFirestore({ 'proprietaryIngestionReleases/release-1': { userId: 'u1', metadata: { trackTitle: 'Song' } } });
        await expect(resolveOwnedRelease(db, 'u1', 'release-1')).resolves.toEqual({
            id: 'release-1',
            store: 'proprietaryIngestionReleases',
            data: { userId: 'u1', metadata: { trackTitle: 'Song' } },
        });
        await expect(verifyReleaseOwnership(db, 'u1', 'release-1')).resolves.toBeUndefined();
    });

    it('refuses another user\'s proprietaryIngestionReleases record with the not-found message', async () => {
        const db = fakeFirestore({ 'proprietaryIngestionReleases/release-1': { userId: 'other' } });
        await expect(resolveOwnedRelease(db, 'u1', 'release-1')).rejects.toThrow(FORBIDDEN);
    });

    it('refuses an org-shared record that names no owner, because the gateway cannot check org membership', async () => {
        const db = fakeFirestore({ 'proprietaryIngestionReleases/release-1': { orgId: 'org-1' } });
        await expect(resolveOwnedRelease(db, 'u1', 'release-1')).rejects.toThrow(FORBIDDEN);
    });

    it('prefers the caller subcollection, then top-level releases, and reports where it found the record', async () => {
        const db = fakeFirestore({
            'users/u1/releases/r1': { title: 'Subcollection' },
            'releases/r1': { userId: 'u1', title: 'Top level' },
            'releases/r2': { ownerUid: 'u1', title: 'Top level' },
            'proprietaryIngestionReleases/r2': { userId: 'u1', title: 'Proprietary' },
        });
        await expect(resolveOwnedRelease(db, 'u1', 'r1')).resolves.toMatchObject({ store: 'users/releases', data: { title: 'Subcollection' } });
        await expect(resolveOwnedRelease(db, 'u1', ' r2 ')).resolves.toMatchObject({ id: 'r2', store: 'releases', data: { title: 'Top level' } });
    });

    it('falls through a top-level record owned by someone else to the caller\'s own proprietary record', async () => {
        const db = fakeFirestore({
            'releases/r1': { userId: 'other' },
            'proprietaryIngestionReleases/r1': { userId: 'u1', title: 'Mine' },
        });
        await expect(resolveOwnedRelease(db, 'u1', 'r1')).resolves.toMatchObject({ store: 'proprietaryIngestionReleases', data: { title: 'Mine' } });
    });
});
