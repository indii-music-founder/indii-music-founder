import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── admin.firestore double: path-keyed store (delete-tolerant) ──────────────
type Doc = { exists: boolean; data: Record<string, unknown> };
const store = new Map<string, Doc>();
const deletes: string[] = [];

const docRef = (path: string) => ({
    id: path.split('/').pop() ?? path,
    get: async () => {
        const hit = store.get(path);
        return { exists: hit !== undefined && hit.exists, data: () => hit?.data ?? {} };
    },
    set: async (data: Record<string, unknown>) => { store.set(path, { exists: true, data }); },
    delete: async () => { deletes.push(path); store.delete(path); },
    update: async (data: Record<string, unknown>) => {
        const current = store.get(path);
        if (current) store.set(path, { exists: true, data: { ...current.data, ...data } });
    },
    collection: (sub: string) => colRef(`${path}/${sub}`),
});
const colRef = (path: string, state: { ownerId?: string; limit?: number; cursor?: string } = {}) => {
    const query = {
        doc: (id: string) => docRef(`${path}/${id}`),
        collection: (sub: string) => colRef(`${path}/${sub}`),
        where: (_field: string, _op: string, ownerId: string) => colRef(path, { ...state, ownerId }),
        orderBy: () => colRef(path, state),
        limit: (limit: number) => colRef(path, { ...state, limit }),
        startAfter: (cursor: string) => colRef(path, { ...state, cursor }),
        get: async () => {
            const matched = [...store.entries()]
                .filter(([key, value]) => key.startsWith(`${path}/`) && value.exists)
                .map(([key, value]) => ({ id: key.slice(path.length + 1), data: () => value.data }))
                .filter(document => !state.ownerId || document.data()['ownerId'] === state.ownerId)
                .sort((left, right) => left.id.localeCompare(right.id))
                .filter(document => !state.cursor || document.id > state.cursor);
            return {
                docs: matched.slice(0, state.limit ?? matched.length),
                empty: matched.length === 0,
                forEach: (fn: (item: (typeof matched)[number]) => void) => matched.forEach(fn),
            };
        },
    };
    return query;
};

vi.mock('firebase-admin', () => ({
    firestore: Object.assign(
        () => ({
            collection: (p: string) => colRef(p),
            doc: (p: string) => docRef(p),
            runTransaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
                get: (ref: ReturnType<typeof docRef>) => ref.get(),
                update: (ref: ReturnType<typeof docRef>, data: Record<string, unknown>) => ref.update(data),
                set: (ref: ReturnType<typeof docRef>, data: Record<string, unknown>) => ref.set(data),
                delete: (ref: ReturnType<typeof docRef>) => ref.delete(),
            }),
            batch: () => {
                const writes: Array<() => Promise<void>> = [];
                return {
                    set: (ref: ReturnType<typeof docRef>, data: Record<string, unknown>) => { writes.push(() => ref.set(data)); },
                    delete: (ref: ReturnType<typeof docRef>) => { writes.push(() => ref.delete()); },
                    commit: async () => { await Promise.all(writes.map(write => write())); },
                };
            },
        }),
        { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' }, Timestamp: { now: () => ({ toDate: () => new Date() }) } },
    ),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onRequest: (_options: unknown, handler: unknown) => handler,
    onCall: (_options: unknown, handler: unknown) => handler,
    HttpsError: class HttpsError extends Error { constructor(readonly code: string, message: string) { super(message); } },
}));

import { buildSemanticNode, catalogSemanticApi, projectSemanticNode, setCatalogVisibility, toPublicCatalogProjection } from './semanticProjection.js';

function makeRes() {
    const res = {
        statusCode: 0,
        body: undefined as unknown,
        headers: {} as Record<string, string>,
        setHeader: (name: string, value: string) => { res.headers[name] = value; },
        status(code: number) {
            res.statusCode = code;
            return { json: (body: unknown) => { res.body = body; } };
        },
    };
    return res;
}

const CLEAN_INPUT = {
    entityId: 'track-1',
    ownerId: 'user-1',
    kind: 'track' as const,
    displayName: 'Midnight Motorway',
    isrc: 'USABC7123456',
    moodTags: ['nightdrive'],
    instrumentalAvailable: true,
    stemsAvailable: false,
    recordingShareBasisUnits: [600_000, 400_000],
    publishingShareBasisUnits: [500_000, 500_000],
    recordingHolders: ['ana', 'zed'],
    publishingHolders: ['ana', 'wren'],
    signedCollaboratorIds: new Set(['ana', 'zed', 'wren']),
    syncContactEndpoint: 'sync@artist.example',
    territoryRestrictions: ['US'],
    relations: [{ subject: 'track-1', predicate: 'part_of_release' as const, object: 'rel-1' }],
    visibility: 'public' as const,
    ledgerReceiptId: 'led_v1_' + 'c'.repeat(40),
};

describe('buildSemanticNode (deterministic preclearance)', () => {
    it('computes both preclearance flags from signed exact splits', () => {
        const result = buildSemanticNode(CLEAN_INPUT);
        expect(result.master100PercentPrecleared).toBe(true);
        expect(result.publishing100PercentPrecleared).toBe(true);
        expect(result.relations.some((relation) => relation.predicate === 'master_owned_by')).toBe(true);
    });

    it('computes false when a signature is missing — never asserts preclearance', () => {
        const result = buildSemanticNode({ ...CLEAN_INPUT, signedCollaboratorIds: new Set(['ana']) });
        expect(result.master100PercentPrecleared).toBe(false);
    });
});

describe('projectSemanticNode (visibility-gated mirroring)', () => {
    beforeEach(() => {
        store.clear();
        deletes.length = 0;
    });

    it('writes the owner graph and the public mirror for opted-in nodes', async () => {
        const node = buildSemanticNode(CLEAN_INPUT);
        const result = await projectSemanticNode('user-1', node);
        expect(result.mirrored).toBe(true);
        expect(store.has('users/user-1/catalog_graph/track-1')).toBe(true);
        expect(store.has('public_catalog/track-1')).toBe(true);
    });

    it('keeps private nodes out of the public projection entirely', async () => {
        const node = buildSemanticNode({ ...CLEAN_INPUT, visibility: 'private' });
        const result = await projectSemanticNode('user-1', node);
        expect(result.mirrored).toBe(false);
        expect(store.has('users/user-1/catalog_graph/track-1')).toBe(true);
        expect([...store.keys()].some((key) => key.startsWith('public_catalog/'))).toBe(false);
    });
});

describe('catalogSemanticApi (public JSON-LD endpoint)', () => {
    beforeEach(() => {
        store.clear();
        deletes.length = 0;
    });

    it('serves the public projection as JSON-LD with cache headers', async () => {
        const node = buildSemanticNode(CLEAN_INPUT);
        await projectSemanticNode('user-1', node);

        const res = makeRes();
        await (catalogSemanticApi as unknown as (req: unknown, res: unknown) => Promise<void>)(
            { method: 'GET', query: { entityId: 'track-1' } },
            res,
        );
        expect(res.statusCode).toBe(200);
        expect(res.headers['Content-Type']).toBe('application/ld+json');
        const body = res.body as { '@context': string; '@id': string; additionalProperty: Array<{ name: string; value: unknown }> };
        expect(body['@context']).toBe('https://schema.org');
        expect(body.additionalProperty.find((property) => property.name === 'master_100_percent_precleared')?.value).toBe(true);
    });

    it('never leaks a private node — 404 by construction', async () => {
        const node = buildSemanticNode({ ...CLEAN_INPUT, visibility: 'private' });
        await projectSemanticNode('user-1', node);

        const res = makeRes();
        await (catalogSemanticApi as unknown as (req: unknown, res: unknown) => Promise<void>)(
            { method: 'GET', query: { entityId: 'track-1' } },
            res,
        );
        expect(res.statusCode).toBe(404);
    });

    it('rejects non-GET requests and missing entity ids', async () => {
        let res = makeRes();
        await (catalogSemanticApi as unknown as (req: unknown, res: unknown) => Promise<void>)({ method: 'POST', query: {} }, res);
        expect(res.statusCode).toBe(405);

        res = makeRes();
        await (catalogSemanticApi as unknown as (req: unknown, res: unknown) => Promise<void>)({ method: 'GET', query: {} }, res);
        expect(res.statusCode).toBe(400);
    });

    it('rejects mixed entity and feed selectors and invalid feed cursors', async () => {
        const mixed = makeRes();
        await (catalogSemanticApi as unknown as (req: unknown, res: unknown) => Promise<void>)(
            { method: 'GET', query: { entityId: 'track-1', artistId: 'artist-1' } }, mixed,
        );
        expect(mixed.statusCode).toBe(400);
        const cursor = makeRes();
        await (catalogSemanticApi as unknown as (req: unknown, res: unknown) => Promise<void>)(
            { method: 'GET', query: { artistId: 'artist-1', cursor: '/' } }, cursor,
        );
        expect(cursor.statusCode).toBe(400);
    });

    it('serves only an owner-scoped bounded public feed with a continuation cursor', async () => {
        for (const [entityId, ownerId] of [['track-1', 'artist-1'], ['track-2', 'artist-1'], ['private-1', 'artist-1'], ['other-1', 'artist-2']]) {
            const node = buildSemanticNode({ ...CLEAN_INPUT, entityId, ownerId, visibility: entityId === 'private-1' ? 'private' : 'public' });
            await projectSemanticNode(ownerId, node);
        }

        const first = makeRes();
        await (catalogSemanticApi as unknown as (req: unknown, res: unknown) => Promise<void>)(
            { method: 'GET', query: { artistId: 'artist-1', limit: '1' } },
            first,
        );
        expect(first.statusCode).toBe(200);
        expect((first.body as { '@graph': unknown[] })['@graph']).toHaveLength(1);
        expect((first.body as { hasMore: boolean }).hasMore).toBe(true);
        const cursor = (first.body as { nextCursor: string }).nextCursor;
        expect(cursor).toBe('track-1');

        const second = makeRes();
        await (catalogSemanticApi as unknown as (req: unknown, res: unknown) => Promise<void>)(
            { method: 'GET', query: { artistId: 'artist-1', limit: '1', cursor } },
            second,
        );
        expect((second.body as { '@graph': unknown[] })['@graph']).toHaveLength(1);
        expect((second.body as { '@graph': Array<{ '@id': string }> })['@graph'][0]?.['@id']).toContain('track-2');
        expect((second.body as { hasMore: boolean }).hasMore).toBe(false);
    });

    it('caps feed pages and rejects an invalid public projection rather than inventing fields', async () => {
        const invalid = { ...buildSemanticNode(CLEAN_INPUT), visibility: 'public' } as Record<string, unknown>;
        invalid['displayName'] = '';
        store.set('public_catalog/bad', { exists: true, data: invalid });
        const res = makeRes();
        await expect((catalogSemanticApi as unknown as (req: unknown, res: unknown) => Promise<void>)(
            { method: 'GET', query: { artistId: 'user-1', limit: '1000' } },
            res,
        )).rejects.toThrow();
    });
});

describe('setCatalogVisibility (owner publication control)', () => {
    const masterHash = 'a'.repeat(64);
    const receiptId = `led_v1_${'b'.repeat(40)}`;
    const receipt = {
        id: receiptId,
        userId: 'user-1',
        schemaVersion: 'admin-ledger-receipt.v1',
        masterHash,
        storageGeneration: '17273000000000000',
        splits: {
            recording: [{ collaboratorId: 'ana', shareBasisUnits: 1_000_000 }],
            publishing: [{ collaboratorId: 'ana', shareBasisUnits: 1_000_000 }],
        },
        signatories: [{ collaboratorId: 'ana', method: 'split-invitation@v1', signedAt: '2026-09-26T12:00:00.000Z', receiptHash: 'c'.repeat(40) }],
        identifiers: { isrc: 'USABC7123456' },
        lockedAt: '2026-09-26T12:00:00.000Z',
    };

    beforeEach(() => {
        store.clear();
        deletes.length = 0;
    });

    function seedLockedProjection(precleared = true) {
        const node = {
            ...buildSemanticNode({
                ...CLEAN_INPUT,
                entityId: masterHash,
                ownerId: 'user-1',
                relations: [{ subject: masterHash, predicate: 'master_owned_by', object: receiptId }],
                signedCollaboratorIds: precleared ? new Set(['ana', 'zed', 'wren']) : new Set(['ana']),
                visibility: 'private',
            }),
        };
        store.set(`users/user-1/master_admin/${masterHash}`, { exists: true, data: { lifecycle: 'ADMIN_LOCKED', ledgerReceiptId: receiptId, catalogVisibility: 'private' } });
        store.set(`users/user-1/catalog_graph/${masterHash}`, { exists: true, data: node });
        store.set(`users/user-1/admin_ledger/${receiptId}`, { exists: true, data: receipt });
        return node;
    }

    it('atomically publishes only an owner-scoped projection backed by its locked receipt', async () => {
        seedLockedProjection();
        await expect((setCatalogVisibility as unknown as (request: unknown) => Promise<unknown>)({
            auth: { uid: 'user-1' }, data: { masterHash, visibility: 'public' },
        })).resolves.toEqual({ masterHash, visibility: 'public' });
        expect(store.get(`users/user-1/master_admin/${masterHash}`)?.data['catalogVisibility']).toBe('public');
        expect(store.get(`users/user-1/catalog_graph/${masterHash}`)?.data['visibility']).toBe('public');
        expect(store.get(`public_catalog/${masterHash}`)?.data['ownerId']).toBe('user-1');
    });

    it('requires authentication and refuses publication without verified preclearance', async () => {
        seedLockedProjection(false);
        await expect((setCatalogVisibility as unknown as (request: unknown) => Promise<unknown>)({
            data: { masterHash, visibility: 'public' },
        })).rejects.toMatchObject({ code: 'unauthenticated' });
        await expect((setCatalogVisibility as unknown as (request: unknown) => Promise<unknown>)({
            auth: { uid: 'user-1' }, data: { masterHash, visibility: 'public' },
        })).rejects.toMatchObject({ code: 'failed-precondition' });
        expect(store.has(`public_catalog/${masterHash}`)).toBe(false);
    });

    it('removes the public mirror when the owner returns an item to private', async () => {
        const node = seedLockedProjection();
        store.set(`public_catalog/${masterHash}`, { exists: true, data: toPublicCatalogProjection({ ...node, visibility: 'public' }) });
        await (setCatalogVisibility as unknown as (request: unknown) => Promise<unknown>)({
            auth: { uid: 'user-1' }, data: { masterHash, visibility: 'private' },
        });
        expect(store.get(`users/user-1/catalog_graph/${masterHash}`)?.data['visibility']).toBe('private');
        expect(store.has(`public_catalog/${masterHash}`)).toBe(false);
    });
});
