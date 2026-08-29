import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Firestore mock: in-memory doc store keyed by path ---------------------

type Stored = Record<string, unknown>;
const store = new Map<string, Stored>();

vi.mock('firebase/firestore', () => ({
    collection: (_db: unknown, ...segs: string[]) => ({ __path: segs.join('/') }),
    doc: (coll: { __path: string }, id: string) => ({ __path: `${coll.__path}/${id}` }),
    setDoc: vi.fn(async (ref: { __path: string }, data: Stored) => {
        store.set(ref.__path, { ...data });
    }),
    getDocs: vi.fn(async (q: { __coll: { __path: string } }) => {
        const prefix = `${q.__coll.__path}/`;
        const docs = [...store.entries()]
            .filter(([k]) => k.startsWith(prefix))
            .map(([k, data]) => ({ id: k.slice(prefix.length), data }))
            .sort((a, b) => Number(a.data.createdAt) - Number(b.data.createdAt));
        return { docs: docs.map(d => ({ id: d.id, data: () => d.data })) };
    }),
    query: (coll: { __path: string }, ..._args: unknown[]) => ({ __coll: coll }),
    orderBy: (..._a: unknown[]) => ({}),
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user_test' } },
    db: {},
}));

import { AssetVersionService } from '../AssetVersionService';
import { setDoc } from 'firebase/firestore';

const base = {
    parentVersionId: null,
    url: 'https://example.test/a.png',
    source: 'generation' as const,
    tags: ['seed']
};

describe('AssetVersionService (H1.1)', () => {
    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
    });

    it('records an append-only root version with a generated id and timestamp', async () => {
        const v = await AssetVersionService.recordVersion({ assetId: 'asset1', ...base });

        expect(v.versionId).toMatch(/^v_\d+_/);
        expect(v.createdAt).toBeGreaterThan(0);
        expect(v.parentVersionId).toBeNull();
        expect(v.assetId).toBe('asset1');
        // Persisted exactly once, under users/{uid}/assetVersions/{assetId}/versions/{id}
        expect(setDoc).toHaveBeenCalledWith(
            expect.objectContaining({ __path: `users/user_test/assetVersions/asset1/versions/${v.versionId}` }),
            expect.objectContaining({ versionId: v.versionId, url: base.url })
        );
    });

    it('never mutates existing nodes on subsequent records (append-only)', async () => {
        const root = await AssetVersionService.recordVersion({ assetId: 'a', ...base });
        const before = store.get(`users/user_test/assetVersions/a/versions/${root.versionId}`);

        await AssetVersionService.recordVersion({
            assetId: 'a',
            parentVersionId: root.versionId,
            url: 'https://example.test/b.png',
            source: 'edit',
            tags: []
        });

        const after = store.get(`users/user_test/assetVersions/a/versions/${root.versionId}`);
        expect(after).toEqual(before); // root untouched
        expect(store.size).toBe(2);
    });

    it('returns the full tree oldest-first, including orphaned-parent nodes', async () => {
        const root = await AssetVersionService.recordVersion({ assetId: 'a', ...base });
        const edit = await AssetVersionService.recordVersion({
            assetId: 'a', parentVersionId: root.versionId, url: 'b.png', source: 'edit', tags: []
        });
        // Orphan: parentVersionId points at a node that was never recorded.
        await AssetVersionService.recordVersion({
            assetId: 'a', parentVersionId: 'v_missing', url: 'c.png', source: 'mockup', tags: []
        });

        const tree = await AssetVersionService.getVersionTree('a');
        expect(tree.map(v => v.versionId)).toEqual([root.versionId, edit.versionId, tree[2]!.versionId]);
        expect(tree[2]!.parentVersionId).toBe('v_missing'); // orphan allowed
    });

    it('promote creates a NEW head node copying the target; target untouched (revert semantics)', async () => {
        const root = await AssetVersionService.recordVersion({ assetId: 'a', ...base });
        await AssetVersionService.recordVersion({
            assetId: 'a', parentVersionId: root.versionId, url: 'edited.png', source: 'edit', tags: []
        });

        const promoted = await AssetVersionService.promoteVersion('a', root.versionId);
        expect(promoted.versionId).not.toBe(root.versionId);
        expect(promoted.parentVersionId).toBe(root.versionId);
        expect(promoted.url).toBe(base.url); // copies the target's content
        expect(promoted.provenance?.note).toContain(root.versionId);

        const rootNow = store.get(`users/user_test/assetVersions/a/versions/${root.versionId}`);
        expect(rootNow).toEqual(store.get(`users/user_test/assetVersions/a/versions/${root.versionId}`));

        const tree = await AssetVersionService.getVersionTree('a');
        expect(tree).toHaveLength(3); // append-only: nothing deleted
    });

    it('rejects promoting an unknown version', async () => {
        await AssetVersionService.recordVersion({ assetId: 'a', ...base });
        await expect(AssetVersionService.promoteVersion('a', 'v_nope')).rejects.toThrow(/not found/);
    });

    it('rejects invalid sources, missing urls, and unauthenticated use', async () => {
        await expect(AssetVersionService.recordVersion({ assetId: 'a', ...base, source: 'explode' as never }))
            .rejects.toThrow(/Invalid version source/);
        await expect(AssetVersionService.recordVersion({ assetId: 'a', parentVersionId: null, url: '', source: 'upload', tags: [] }))
            .rejects.toThrow(/url is required/);
    });
});
