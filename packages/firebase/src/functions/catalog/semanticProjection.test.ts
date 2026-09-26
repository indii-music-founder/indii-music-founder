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
    collection: (sub: string) => colRef(`${path}/${sub}`),
});
const colRef = (path: string) => ({
    doc: (id: string) => docRef(`${path}/${id}`),
    collection: (sub: string) => colRef(`${path}/${sub}`),
    where: () => colRef(path),
    limit: () => colRef(path),
    get: async () => ({ docs: [], empty: true, forEach: () => {} }),
});

vi.mock('firebase-admin', () => ({
    firestore: Object.assign(
        () => ({ collection: (p: string) => colRef(p), doc: (p: string) => docRef(p) }),
        { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' }, Timestamp: { now: () => ({ toDate: () => new Date() }) } },
    ),
}));

import { buildSemanticNode, catalogSemanticApi, projectSemanticNode } from './semanticProjection.js';

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
});
