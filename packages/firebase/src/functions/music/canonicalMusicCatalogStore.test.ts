import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';

import { createCanonicalMusicCatalogStore } from './canonicalMusicCatalogStore';

const provenance = {
    state: 'DETECTED',
    sourceType: 'SYSTEM',
    observedAt: '2026-09-25T12:00:00.000Z',
    evidence: [],
};

function entity(overrides: Record<string, unknown> = {}) {
    return {
        schemaVersion: 'canonical-music-entity.v1',
        id: 'recording-1',
        entityType: 'sound_recording',
        title: 'A Song',
        recordingKind: 'UNKNOWN',
        createdAt: '2026-09-25T12:00:00.000Z',
        updatedAt: '2026-09-25T12:00:00.000Z',
        provenance,
        ...overrides,
    };
}

function fakeFirestore(options: { ownerId?: string; exists?: boolean } = {}) {
    const writes: Array<{ path: string; id: string; value: unknown }> = [];
    const create = vi.fn(async (path: string, id: string, value: unknown) => {
        writes.push({ path, id, value });
    });
    const firestore = {
        collection: (path: string) => ({
            doc: (id: string) => path === 'organizations'
                ? {
                    get: async () => ({
                        exists: options.exists ?? true,
                        data: () => ({ ownerId: options.ownerId ?? 'owner-1' }),
                    }),
                }
                : {
                    create: (value: unknown) => create(path, id, value),
                },
        }),
    } as unknown as Firestore;

    return { firestore, writes, create };
}

describe('CanonicalMusicCatalogStore', () => {
    it('stores validated domain records under the internal scoped path without upgrading provenance', async () => {
        const { firestore, writes } = fakeFirestore();
        const store = createCanonicalMusicCatalogStore(firestore);

        const stored = await store.appendEntity('alice-1', { kind: 'user', id: 'alice-1' }, entity());

        expect(writes).toEqual([{
            path: 'users/alice-1/musicCatalog/entities',
            id: 'recording-1',
            value: stored,
        }]);
        expect(stored.provenance?.state).toBe('DETECTED');
    });

    it('prevents a user from writing into another personal catalog before any Firestore write', async () => {
        const { firestore, writes } = fakeFirestore();
        const store = createCanonicalMusicCatalogStore(firestore);

        await expect(store.appendEntity('alice-1', { kind: 'user', id: 'bob-2' }, entity()))
            .rejects.toMatchObject({ code: 'permission-denied' });
        expect(writes).toHaveLength(0);
    });

    it('does not treat organization membership as canonical-write authority', async () => {
        const { firestore, writes } = fakeFirestore({ ownerId: 'owner-1' });
        const store = createCanonicalMusicCatalogStore(firestore);

        await expect(store.appendEntity('member-2', { kind: 'organization', id: 'org-1' }, entity()))
            .rejects.toMatchObject({ code: 'permission-denied' });
        expect(writes).toHaveLength(0);
    });

    it('permits the organization owner and preserves detected claim provenance as supplied', async () => {
        const { firestore, writes } = fakeFirestore({ ownerId: 'owner-1' });
        const store = createCanonicalMusicCatalogStore(firestore);
        const claim = {
            schemaVersion: 'rights-claim.v1',
            id: 'claim-1',
            targetEntityId: 'recording-1',
            type: 'MASTER',
            status: 'ASSERTED',
            territoryCodes: [],
            provenance,
            createdAt: '2026-09-25T12:00:00.000Z',
            updatedAt: '2026-09-25T12:00:00.000Z',
        };

        const stored = await store.appendClaim('owner-1', { kind: 'organization', id: 'org-1' }, claim);

        expect(writes[0]).toMatchObject({
            path: 'organizations/org-1/musicCatalog/claims',
            id: 'claim-1',
            value: stored,
        });
        expect(stored.provenance.state).toBe('DETECTED');
        expect(stored.status).toBe('ASSERTED');
    });

    it('stores external identifiers as values attached to internal entity IDs', async () => {
        const { firestore, writes } = fakeFirestore();
        const store = createCanonicalMusicCatalogStore(firestore);
        const identifier = {
            id: 'identifier-1',
            entityId: 'recording-1',
            type: 'ISRC',
            value: 'USABC2600001',
            provenance,
        };

        const stored = await store.appendIdentifier('alice-1', { kind: 'user', id: 'alice-1' }, identifier);

        expect(writes[0]).toMatchObject({
            path: 'users/alice-1/musicCatalog/identifiers',
            id: 'identifier-1',
            value: stored,
        });
        expect(stored.value).toBe('USABC2600001');
        expect(writes[0]?.id).not.toBe(stored.value);
    });

    it('rejects external identifiers as canonical document IDs', async () => {
        const { firestore, create } = fakeFirestore();
        const store = createCanonicalMusicCatalogStore(firestore);

        await expect(store.appendEntity('alice-1', { kind: 'user', id: 'alice-1' }, entity({ id: 'USABC2600001' })))
            .rejects.toMatchObject({ code: 'invalid-argument' });
        expect(create).not.toHaveBeenCalled();
    });

    it('uses create-only writes so existing canonical facts cannot be silently overwritten', async () => {
        const conflict = new Error('already exists');
        const firestore = {
            collection: () => ({ doc: () => ({ create: async () => { throw conflict; } }) }),
        } as unknown as Firestore;
        const store = createCanonicalMusicCatalogStore(firestore);

        await expect(store.appendEntity('alice-1', { kind: 'user', id: 'alice-1' }, entity()))
            .rejects.toBe(conflict);
    });

    it('validates relationship and event contracts before writing', async () => {
        const { firestore, writes } = fakeFirestore();
        const store = createCanonicalMusicCatalogStore(firestore);

        await expect(store.appendRelationship('alice-1', { kind: 'user', id: 'alice-1' }, {
            schemaVersion: 'music-relationship.v1',
            id: 'relationship-1',
            fromEntityId: 'USABC2600001',
            toEntityId: 'recording-1',
            type: 'PERFORMED_ON',
            provenance,
            createdAt: '2026-09-25T12:00:00.000Z',
            updatedAt: '2026-09-25T12:00:00.000Z',
        })).rejects.toMatchObject({ code: 'invalid-argument' });

        await expect(store.appendRelationship('alice-1', { kind: 'user', id: 'alice-1' }, {
            schemaVersion: 'music-relationship.v1',
            id: 'relationship-1',
            fromEntityId: 'same',
            toEntityId: 'same',
            type: 'WROTE',
            provenance,
            createdAt: '2026-09-25T12:00:00.000Z',
            updatedAt: '2026-09-25T12:00:00.000Z',
        })).rejects.toMatchObject({ code: 'invalid-argument' });

        await expect(store.appendEvent('alice-1', { kind: 'user', id: 'alice-1' }, {
            schemaVersion: 'music-domain-event.v1',
            eventId: 'event-1',
            eventType: 'release.live',
            subject: { entityId: 'recording-1', entityType: 'sound_recording' },
            occurredAt: '2026-09-25T12:00:00.000Z',
            recordedAt: '2026-09-25T12:00:00.000Z',
            provenance,
        })).rejects.toMatchObject({ code: 'invalid-argument' });

        expect(writes).toHaveLength(0);
    });
});
