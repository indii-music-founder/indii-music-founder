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

function fakeFirestore(options: {
    ownerId?: string;
    exists?: boolean;
    records?: Record<string, Array<{ id: string; value: unknown }>>;
} = {}) {
    const writes: Array<{ path: string; id: string; value: unknown }> = [];
    const reads: string[] = [];
    const create = vi.fn(async (path: string, id: string, value: unknown) => {
        writes.push({ path, id, value });
    });
    const firestore = {
        collection: (path: string) => {
            const query = {
                after: undefined as string | undefined,
                pageSize: 0,
                limit(size: number) {
                    this.pageSize = size;
                    return this;
                },
                startAfter(id: string) {
                    this.after = id;
                    return this;
                },
                async get() {
                    reads.push(path);
                    const all = [...(options.records?.[path] ?? [])].sort((left, right) => left.id.localeCompare(right.id));
                    const remaining = query.after === undefined ? all : all.filter(record => record.id > query.after!);
                    const docs = remaining.slice(0, query.pageSize).map(record => ({
                        id: record.id,
                        data: () => record.value,
                    }));
                    return { docs, size: docs.length, empty: docs.length === 0 };
                },
            };
            return {
                orderBy: () => query,
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
            };
        },
    } as unknown as Firestore;

    return { firestore, writes, reads, create };
}

describe('CanonicalMusicCatalogStore', () => {
    it('reads a deterministic owner-scoped canonical snapshot without claiming completeness', async () => {
        const entityRecords = Array.from({ length: 12 }, (_, index) => {
            const id = `entity-${String(index).padStart(2, '0')}`;
            return { id, value: entity({ id }) };
        });
        const entitiesPath = 'users/alice-1/musicCatalogEntities';
        const { firestore, reads } = fakeFirestore({ records: { [entitiesPath]: entityRecords } });
        const store = createCanonicalMusicCatalogStore(firestore);

        const snapshot = await store.readCatalogIntelligenceInput('alice-1', { kind: 'user', id: 'alice-1' });

        expect(snapshot.snapshot).toMatchObject({ catalogId: 'canonical:user:alice-1', completeness: 'UNKNOWN' });
        expect(snapshot.entities.map(record => record.id)).toEqual(entityRecords.map(record => record.id));
        expect(snapshot.identifiers).toEqual([]);
        expect(snapshot.relationships).toEqual([]);
        expect(snapshot.entities[0]?.provenance?.state).toBe('DETECTED');
        expect(reads).toContain(entitiesPath);
    });

    it('does not read another user catalog or an organization catalog as a non-owner', async () => {
        const { firestore, reads } = fakeFirestore();
        const store = createCanonicalMusicCatalogStore(firestore);

        await expect(store.readCatalogIntelligenceInput('alice-1', { kind: 'user', id: 'bob-2' }))
            .rejects.toMatchObject({ code: 'permission-denied' });
        await expect(store.readCatalogIntelligenceInput('member-2', { kind: 'organization', id: 'org-1' }))
            .rejects.toMatchObject({ code: 'permission-denied' });
        expect(reads).toHaveLength(0);
    });

    it('rejects corrupt canonical records instead of normalizing them during a read', async () => {
        const path = 'users/alice-1/musicCatalogEntities';
        const { firestore } = fakeFirestore({
            records: { [path]: [{ id: 'recording-1', value: entity({ id: 'different-id' }) }] },
        });
        const store = createCanonicalMusicCatalogStore(firestore);

        await expect(store.readCatalogIntelligenceInput('alice-1', { kind: 'user', id: 'alice-1' }))
            .rejects.toMatchObject({ code: 'data-loss' });
    });

    it('marks a record-capped canonical snapshot partial rather than complete', async () => {
        const path = 'users/alice-1/musicCatalogEntities';
        const records = Array.from({ length: 5_001 }, (_, index) => {
            const id = `entity-${String(index).padStart(5, '0')}`;
            return { id, value: entity({ id }) };
        });
        const { firestore } = fakeFirestore({ records: { [path]: records } });
        const store = createCanonicalMusicCatalogStore(firestore);

        const snapshot = await store.readCatalogIntelligenceInput('alice-1', { kind: 'user', id: 'alice-1' });

        expect(snapshot.entities).toHaveLength(5_000);
        expect(snapshot.snapshot.completeness).toBe('PARTIAL');
    });

    it('stores validated domain records under the internal scoped path without upgrading provenance', async () => {
        const { firestore, writes } = fakeFirestore();
        const store = createCanonicalMusicCatalogStore(firestore);

        const stored = await store.appendEntity('alice-1', { kind: 'user', id: 'alice-1' }, entity());

        expect(writes).toEqual([{
            path: 'users/alice-1/musicCatalogEntities',
            id: 'recording-1',
            value: stored,
        }]);
        expect(stored.provenance?.state).toBe('DETECTED');
    });

    it('accepts namespaced canonical IDs while keeping external identifiers out of entity identity', async () => {
        const { firestore, writes } = fakeFirestore();
        const store = createCanonicalMusicCatalogStore(firestore);

        const stored = await store.appendEntity(
            'alice-1',
            { kind: 'user', id: 'alice-1' },
            entity({ id: 'recording:internal-1' }),
        );

        expect(stored.id).toBe('recording:internal-1');
        expect(writes[0]).toMatchObject({
            path: 'users/alice-1/musicCatalogEntities',
            id: 'recording:internal-1',
        });
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
            path: 'organizations/org-1/musicCatalogClaims',
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
            path: 'users/alice-1/musicCatalogIdentifiers',
            id: 'identifier-1',
            value: stored,
        });
        expect(stored.value).toBe('USABC2600001');
        expect(writes[0]?.id).not.toBe(stored.value);
    });

    it.each([
        'USABC2600001',
        'grid:GRID-123',
        'catalog_number:legacy-7',
        'platform_id:spotify-123',
        'proprietary:label-123',
    ])('rejects external identifiers as canonical document IDs: %s', async externalId => {
        const { firestore, create } = fakeFirestore();
        const store = createCanonicalMusicCatalogStore(firestore);

        await expect(store.appendEntity('alice-1', { kind: 'user', id: 'alice-1' }, entity({ id: externalId })))
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
