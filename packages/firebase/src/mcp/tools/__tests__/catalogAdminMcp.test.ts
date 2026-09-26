import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Minimal admin.firestore double: path-keyed store with query chaining ──
type Doc = { exists: boolean; data: Record<string, unknown> };
const store = new Map<string, Doc>();
const setCalls: Array<{ path: string; data: Record<string, unknown> }> = [];

const docRef = (path: string) => ({
    id: path.split('/').pop() ?? path,
    get: async () => {
        const hit = store.get(path);
        return { exists: hit !== undefined && hit.exists, data: () => hit?.data ?? {} };
    },
    set: async (data: Record<string, unknown>) => {
        store.set(path, { exists: true, data });
        setCalls.push({ path, data });
    },
    collection: (sub: string) => colRef(`${path}/${sub}`),
});
const colRef = (path: string) => {
    const chain = {
        doc: (id: string) => docRef(`${path}/${id}`),
        collection: (sub: string) => colRef(`${path}/${sub}`),
        where: (_field: string, _op: string, _value: unknown) => chain,
        limit: (_n: number) => chain,
        get: async () => ({
            docs: [...store.entries()]
                .filter(([key]) => key.startsWith(path))
                .map(([key, value]) => ({ id: key, data: () => value.data })),
            empty: true,
            forEach: () => {},
        }),
    };
    return chain;
};

vi.mock('firebase-admin', () => ({
    firestore: Object.assign(
        () => ({ collection: (path: string) => colRef(path), doc: (path: string) => docRef(path) }),
        { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' }, Timestamp: { now: () => ({ toDate: () => new Date() }) } },
    ),
}));

import { auditCatalogGaps } from '../auditCatalogGaps.js';
import { stageRegistrationPayload } from '../stageRegistrationPayload.js';
import { McpContext } from '../../types.js';

const context: McpContext = { user: { uid: 'user-1', admin: false } } as never;

const VALID_METADATA: Record<string, unknown> = {
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
    compositionSplits: [
        { legalName: 'Ana Artist', percentage: 50 },
        { legalName: 'Wren Writer', percentage: 50 },
    ],
};

describe('audit_catalog_gaps (MCP mirror)', () => {
    beforeEach(() => {
        store.clear();
        setCalls.length = 0;
    });

    it('returns the owner-scoped task page with counts and never mutates', async () => {
        store.set('users/user-1/administrative_tasks/task-1', {
            exists: true,
            data: { type: 'SPLIT_IPI_MISSING', severity: 'critical', status: 'open', entityType: 'master', createdAt: '2026-09-26T10:00:00Z' },
        });

        const response = await auditCatalogGaps.handler({ status: 'open' }, context);
        const payload = JSON.parse((response.content as Array<{ text: string }>)[0]!.text);
        expect(payload.status).toBe('succeeded');
        expect(payload.data.tasks).toHaveLength(1);
        expect(payload.data.counts.bySeverity).toMatchObject({ critical: 1 });
        expect(setCalls).toHaveLength(0);
    });

    it('reports failure honestly on backend errors', async () => {
        vi.spyOn(store, 'entries').mockImplementation(() => { throw new Error('backend down'); });
        const response = await auditCatalogGaps.handler({}, context);
        const payload = JSON.parse((response.content as Array<{ text: string }>)[0]!.text);
        expect(payload.status).toBe('failed');
        expect(payload.error.code).toBe('QUERY_FAILED');
    });
});

describe('stage_registration_payload (MCP mirror)', () => {
    beforeEach(() => {
        store.clear();
        setCalls.length = 0;
    });

    it('stages a payload for an owned, audit-clean release with approval required', async () => {
        store.set('proprietaryIngestionReleases/rel-1', { exists: true, data: { metadata: VALID_METADATA } });

        const response = await stageRegistrationPayload.handler({ registry: 'CWR', releaseId: 'rel-1' }, context);
        const payload = JSON.parse((response.content as Array<{ text: string }>)[0]!.text);
        expect(payload.status).toBe('requires_approval');
        expect(payload.approval.required).toBe(true);
        expect(payload.data.taskId).toContain('REGISTRATION_PAYLOAD_STAGED_');

        expect(setCalls).toHaveLength(1);
        const task = setCalls[0]!.data;
        expect(task['status']).toBe('action_ready');
        expect((task['proposedAction'] as Record<string, unknown>)['requiresApproval']).toBe(true);
    });

    it('refuses to stage when blocking audit findings exist', async () => {
        store.set('proprietaryIngestionReleases/rel-2', {
            exists: true,
            data: { metadata: { trackTitle: 'Broken', splits: [{ legalName: 'A', percentage: 99.5 }] } },
        });
        const response = await stageRegistrationPayload.handler({ registry: 'ISWC', releaseId: 'rel-2' }, context);
        const payload = JSON.parse((response.content as Array<{ text: string }>)[0]!.text);
        expect(payload.status).toBe('failed');
        expect(payload.error.code).toBe('BLOCKING_AUDIT_FINDINGS');
        expect(setCalls).toHaveLength(0);
    });

    it('refuses unknown registries before touching storage', async () => {
        const response = await stageRegistrationPayload.handler({ registry: 'SPOTIFY', releaseId: 'rel-1' }, context);
        const payload = JSON.parse((response.content as Array<{ text: string }>)[0]!.text);
        expect(payload.status).toBe('failed');
        expect(setCalls).toHaveLength(0);
    });
});
