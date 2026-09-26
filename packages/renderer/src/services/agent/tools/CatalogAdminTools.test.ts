// @vitest-environment node — the tools use Web Crypto (crypto.subtle), which
// the jsdom environment does not provide; the Node runtime does.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCurrentUser, stores } = vi.hoisted(() => ({
    mockCurrentUser: { value: { uid: 'user-1' } as { uid: string } | null },
    stores: {
        getDoc: new Map<string, { exists: boolean; data: Record<string, unknown> }>(),
        taskDocs: new Map<string, Record<string, unknown>>(),
        getDocsDocs: [] as Array<{ id: string; data: () => Record<string, unknown> }>,
    },
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    get auth() {
        return { currentUser: mockCurrentUser.value };
    },
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ __path: segments.join('/') })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({ __path: segments.join('/') })),
    getDoc: vi.fn(async (reference: { __path: string }) => {
        const hit = stores.getDoc.get(reference.__path);
        return {
            // Real SDK shape: DocumentSnapshot.exists() is a method.
            exists: () => Boolean(hit),
            data: () => hit?.data ?? {},
        };
    }),
    getDocs: vi.fn(async () => {
        const docs = stores.getDocsDocs;
        return {
            docs,
            empty: docs.length === 0,
            forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => docs.forEach(cb),
        };
    }),
    query: vi.fn((_base: unknown, ..._constraints: unknown[]) => ({ __query: true })),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    limit: vi.fn((n: number) => ({ __limit: n })),
    setDoc: vi.fn(async (_reference: { __path: string }, data: Record<string, unknown>) => {
        stores.taskDocs.set(_reference.__path, data);
    }),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

import { CatalogAdminTools } from './CatalogAdminTools';

// Deterministic sha256 helper mirrors the tool's Web Crypto path.
async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const exactRelease = {
    exists: true,
    data: {
        metadata: {
            trackTitle: 'Midnight Motorway',
            isrc: 'USABC7123456',
            explicit: false,
            releaseDate: '2026-11-06',
            territories: ['US'],
            language: 'en',
            recordingYear: 2026,
            artistRoles: ['MAIN_ARTIST'],
            pro: 'BMI',
            publisher: 'Self',
            splits: [
                { legalName: 'Ana Artist', percentage: 50 },
                { legalName: 'Zed Producer', percentage: 50 },
            ],
        },
    },
};

describe('catalog_query_gaps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCurrentUser.value = { uid: 'user-1' };
        stores.getDoc.clear();
        stores.taskDocs.clear();
        stores.getDocsDocs = [
            { id: 'task-b', data: () => ({ type: 'SPLIT_IPI_MISSING', severity: 'critical', status: 'open', entityType: 'master', entityRefs: {}, findings: [{}], createdAt: { toMillis: () => 300 } }) },
            { id: 'task-a', data: () => ({ type: 'IDENTIFIER_ISRC_WITHOUT_ISWC', severity: 'warning', status: 'action_ready', entityType: 'master', entityRefs: {}, findings: [{}], proposedAction: { kind: 'staged_registration_payload' }, createdAt: { toMillis: () => 900 } }) },
        ];
    });

    it('returns newest-first tasks with severity/status counts', async () => {
        const result = await CatalogAdminTools.catalog_query_gaps({});
        expect(result.success).toBe(true);
        const data = result.data as { tasks: { id: string }[]; counts: { byStatus: Record<string, number> } };
        expect(data.tasks.map((task) => task.id)).toEqual(['task-a', 'task-b']);
        expect(data.counts.byStatus).toMatchObject({ open: 1, action_ready: 1 });
    });

    it('fails closed when unauthenticated', async () => {
        mockCurrentUser.value = null;
        const result = await CatalogAdminTools.catalog_query_gaps({});
        expect(result.success).toBe(false);
    });
});

describe('catalog_stage_registration_payload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCurrentUser.value = { uid: 'user-1' };
        stores.getDoc.clear();
        stores.taskDocs.clear();
    });

    it('stages a CWR payload from a real stored release with requiresApproval true', async () => {
        stores.getDoc.set('proprietaryIngestionReleases/rel-1', exactRelease);
        const result = await CatalogAdminTools.catalog_stage_registration_payload({ registry: 'CWR', releaseId: 'rel-1' });

        expect(result.success).toBe(true);
        const data = result.data as { taskId: string; requiresApproval: boolean };
        expect(data.taskId).toBe(`REGISTRATION_PAYLOAD_STAGED_${(await sha256Hex(`CWR|releaseId=rel-1`)).slice(0, 24)}`);
        expect(data.requiresApproval).toBe(true);

        const written = [...stores.taskDocs.values()][0]!;
        expect(written['status']).toBe('action_ready');
        expect(written['type']).toBe('REGISTRATION_PAYLOAD_STAGED');
        const action = written['proposedAction'] as Record<string, unknown>;
        expect(action['requiresApproval']).toBe(true);
        expect((action['payload'] as Record<string, unknown>)['workTitle']).toBe('Midnight Motorway');
    });

    it('refuses to stage when the release does not exist', async () => {
        const result = await CatalogAdminTools.catalog_stage_registration_payload({ registry: 'ISWC', releaseId: 'ghost' });
        expect(result.success).toBe(false);
        expect((result as { metadata?: { errorCode?: string } }).metadata?.errorCode).toBe('RELEASE_NOT_FOUND');
    });

    it('refuses to stage when stored splits are malformed', async () => {
        stores.getDoc.set('proprietaryIngestionReleases/rel-2', {
            exists: true,
            data: { metadata: { trackTitle: 'Broken', splits: [{ legalName: 'A', percentage: Number.NaN }] } },
        });
        const result = await CatalogAdminTools.catalog_stage_registration_payload({ registry: 'CWR', releaseId: 'rel-2' });
        expect(result.success).toBe(false);
        expect((result as { metadata?: { errorCode?: string } }).metadata?.errorCode).toBe('SPLITS_UNRESOLVED');
        expect(stores.taskDocs.size).toBe(0);
    });
});

describe('catalog_dispatch_split_invitations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCurrentUser.value = { uid: 'user-1' };
        stores.getDoc.clear();
        stores.taskDocs.clear();
    });

    it('stages one idempotent invitation per collaborator with a stable sheet hash', async () => {
        stores.getDoc.set('proprietaryIngestionReleases/rel-1', exactRelease);
        const first = await CatalogAdminTools.catalog_dispatch_split_invitations({ releaseId: 'rel-1' });
        expect(first.success).toBe(true);
        const data = first.data as { invitations: { collaborator: string; created: boolean }[]; sheetHash: string };
        expect(data.invitations).toHaveLength(2);
        expect(data.invitations.every((invite) => invite.created)).toBe(true);

        const sheetText = ['INDII SPLIT SHEET v1', 'release: rel-1', 'collaborator: Ana Artist | 50.0000%', 'collaborator: Zed Producer | 50.0000%'].join('\n');
        expect(data.sheetHash).toBe(await sha256Hex(sheetText));

        // Same sheet → same task ids (idempotent re-run writes, does not duplicate).
        const writtenIds = [...stores.taskDocs.keys()];
        expect(writtenIds).toHaveLength(2);
        for (const id of writtenIds) {
            // setDoc mock keys are full document paths.
            expect(id.endsWith('SPLIT_SIGNATURE_OUTSTANDING_') || id.includes('/SPLIT_SIGNATURE_OUTSTANDING_')).toBe(true);
            const doc = stores.taskDocs.get(id)!;
            expect((doc['proposedAction'] as Record<string, unknown>)['requiresApproval']).toBe(true);
        }

        const second = await CatalogAdminTools.catalog_dispatch_split_invitations({ releaseId: 'rel-1' });
        const secondData = second.data as { invitations: { taskId: string }[] };
        const expectedPaths = secondData.invitations
            .map((invite) => `users/user-1/administrative_tasks/${invite.taskId}`)
            .sort();
        expect(writtenIds.slice().sort()).toEqual(expectedPaths);
    });

    it('refuses to dispatch when splits do not resolve to exactly 100.00%', async () => {
        stores.getDoc.set('proprietaryIngestionReleases/rel-3', {
            exists: true,
            data: { metadata: { splits: [{ legalName: 'A', percentage: 99.5 }] } },
        });
        const result = await CatalogAdminTools.catalog_dispatch_split_invitations({ releaseId: 'rel-3' });
        expect(result.success).toBe(false);
        expect((result as { metadata?: { errorCode?: string } }).metadata?.errorCode).toBe('SPLIT_SUM_INVALID');
        expect(stores.taskDocs.size).toBe(0);
    });

    it('never resurrects an executed invitation', async () => {
        stores.getDoc.set('proprietaryIngestionReleases/rel-1', exactRelease);

        const sheetLines = ['INDII SPLIT SHEET v1', 'release: rel-1', 'collaborator: Ana Artist | 50.0000%', 'collaborator: Zed Producer | 50.0000%'];
        const sheetHash = await sha256Hex(sheetLines.join('\n'));
        const anaTaskId = `SPLIT_SIGNATURE_OUTSTANDING_${(await sha256Hex(`rel-1|Ana Artist|${sheetHash}`)).slice(0, 24)}`;
        stores.getDoc.set(`users/user-1/administrative_tasks/${anaTaskId}`, { exists: true, data: { status: 'executed' } });
        const result = await CatalogAdminTools.catalog_dispatch_split_invitations({ releaseId: 'rel-1' });
        const data = result.data as { invitations: { collaborator: string; created: boolean }[] };
        const ana = data.invitations.find((invite) => invite.collaborator === 'Ana Artist');
        const zed = data.invitations.find((invite) => invite.collaborator === 'Zed Producer');
        expect(ana?.created).toBe(false);
        expect(zed?.created).toBe(true);
    });
});
