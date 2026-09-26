import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── firebase-admin/firestore double: path-keyed store + query chains ────────
type Doc = { exists: boolean; data: Record<string, unknown> };
const store = new Map<string, Doc>();
const written: Array<{ path: string; data: Record<string, unknown> }> = [];
let queryDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];

const docRef = (path: string) => ({
    id: path.split('/').pop() ?? path,
    get: async () => {
        const hit = store.get(path);
        return { exists: hit !== undefined && hit.exists, data: () => hit?.data ?? {} };
    },
    set: async (data: Record<string, unknown>) => {
        store.set(path, { exists: true, data });
        written.push({ path, data });
    },
    collection: (sub: string) => colRef(`${path}/${sub}`),
    update: vi.fn(),
});
const colRef = (path: string) => {
    const filters: Array<{ field: string; op: string; value: unknown }> = [];
    const chain = {
        doc: (id: string) => docRef(`${path}/${id}`),
        collection: (sub: string) => colRef(`${path}/${sub}`),
        where: (field: string, op: string, value: unknown) => {
            filters.push({ field, op, value });
            return chain;
        },
        limit: (_n: number) => chain,
        get: async () => {
            // Emulate the production query semantics the helpers rely on:
            // equality + `in` constraints applied by the backend.
            const resolve = (data: Record<string, unknown>, field: string): unknown =>
                field.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), data);
            const docs = queryDocs.filter((entry) =>
                filters.every(({ field, op, value }) => {
                    const actual = resolve(entry.data(), field);
                    if (op === '==') return actual === value;
                    if (op === 'in') return Array.isArray(value) && value.includes(actual);
                    return true;
                }),
            );
            return { docs, empty: docs.length === 0, forEach: () => {} };
        },
    };
    return chain;
};

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => ({ collection: (p: string) => colRef(p), doc: (p: string) => docRef(p), runTransaction: vi.fn() }),
    FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
    Timestamp: { now: () => ({ toDate: () => new Date('2026-09-26T12:00:00Z') }), fromDate: (d: Date) => d },
}));

import {
    buildLedgerReceipt,
    countOpenBlockingTasks,
    evaluateAdminLock,
    findLinkedReleaseId,
    ledgerReceiptIdFor,
} from './masterIngestionRunbook.js';
import { AdminLedgerReceiptSchema } from '@indii/shared';

const HALF = 500_000;

describe('countOpenBlockingTasks (master binding, client-side filters)', () => {
    beforeEach(() => {
        store.clear();
        queryDocs = [];
    });

    it('counts only blocking tasks bound to this masterHash', async () => {
        queryDocs = [
            { id: 'a', data: () => ({ severity: 'blocking', status: 'open', entityRefs: { masterHash: 'hash-1' } }) },
            { id: 'b', data: () => ({ severity: 'blocking', status: 'open', entityRefs: { masterHash: 'hash-2' } }) },
            { id: 'c', data: () => ({ severity: 'critical', status: 'open', entityRefs: { masterHash: 'hash-1' } }) },
            { id: 'd', data: () => ({ severity: 'blocking', status: 'executed', entityRefs: { masterHash: 'hash-1' } }) },
        ];
        expect(await countOpenBlockingTasks('user-1', 'hash-1')).toBe(1);
    });
});

describe('findLinkedReleaseId (master → track → isrc → release)', () => {
    beforeEach(() => {
        store.clear();
    });

    it('walks the track→isrc→release chain', async () => {
        store.set('users/user-1/tracks/fp-1', { exists: true, data: { isrc: 'USABC7123456' } });
        store.set('proprietaryIngestionReleases/rel-9', { exists: true, data: { userId: 'user-1', metadata: { isrc: 'USABC7123456' } } });
        // The release query returns filtered docs via queryDocs injection:
        queryDocs = [{ id: 'rel-9', data: () => ({ userId: 'user-1', metadata: { isrc: 'USABC7123456' } }) }];
        expect(await findLinkedReleaseId('user-1', 'fp-1')).toBe('rel-9');
    });

    it('returns undefined without a track or without an ISRC', async () => {
        expect(await findLinkedReleaseId('user-1', undefined)).toBeUndefined();
        store.set('users/user-1/tracks/fp-2', { exists: true, data: {} });
        expect(await findLinkedReleaseId('user-1', 'fp-2')).toBeUndefined();
    });
});

describe('evaluateAdminLock (human-gate observation)', () => {
    const release = {
        metadata: {
            splits: [
                { legalName: 'Ana Artist', percentage: 50 },
                { legalName: 'Zed Producer', percentage: 50 },
            ],
            compositionSplits: [
                { legalName: 'Ana Artist', percentage: 60 },
                { legalName: 'Wren Writer', percentage: 40 },
            ],
        },
    };

    beforeEach(() => {
        queryDocs = [];
    });

    it('withholds the lock while signature tasks are outstanding', async () => {
        queryDocs = [
            { id: 'sig-1', data: () => ({ type: 'SPLIT_SIGNATURE_OUTSTANDING', status: 'action_ready', entityRefs: { releaseId: 'rel-1', collaboratorId: 'Ana Artist' } }) },
        ];
        const evaluation = await evaluateAdminLock('user-1', 'rel-1', release);
        expect(evaluation.lockable).toBe(false);
        expect(evaluation.reason).toContain('signature(s) outstanding');
    });

    it('locks when every signature executed and both streams resolve exactly', async () => {
        queryDocs = [
            { id: 'sig-1', data: () => ({ type: 'SPLIT_SIGNATURE_OUTSTANDING', status: 'executed', entityRefs: { releaseId: 'rel-1', collaboratorId: 'Ana Artist' }, proposedAction: { payload: { sheetHash: 'a'.repeat(40) } } }) },
            { id: 'sig-2', data: () => ({ type: 'SPLIT_SIGNATURE_OUTSTANDING', status: 'executed', entityRefs: { releaseId: 'rel-1', collaboratorId: 'Zed Producer' }, proposedAction: { payload: { sheetHash: 'a'.repeat(40) } } }) },
            { id: 'sig-3', data: () => ({ type: 'SPLIT_SIGNATURE_OUTSTANDING', status: 'executed', entityRefs: { releaseId: 'rel-1', collaboratorId: 'Wren Writer' }, proposedAction: { payload: { sheetHash: 'a'.repeat(40) } } }) },
        ];
        const evaluation = await evaluateAdminLock('user-1', 'rel-1', release);
        expect(evaluation.lockable).toBe(true);
        expect(evaluation.splits?.recording).toEqual([
            { collaboratorId: 'Ana Artist', shareBasisUnits: HALF },
            { collaboratorId: 'Zed Producer', shareBasisUnits: HALF },
        ]);
        expect(evaluation.splits?.publishing[0]).toEqual({ collaboratorId: 'Ana Artist', shareBasisUnits: 600_000 });
    });

    it('withholds the lock on float-only splits that merely look like 100', async () => {
        const floaty = { metadata: { splits: [{ legalName: 'A', percentage: 33.333333 }, { legalName: 'B', percentage: 33.333333 }, { legalName: 'C', percentage: 33.333334 }], compositionSplits: [{ legalName: 'A', percentage: 100 }] } };
        queryDocs = [];
        const evaluation = await evaluateAdminLock('user-1', 'rel-2', floaty);
        expect(evaluation.lockable).toBe(false);
        expect(evaluation.reason).toContain('100.00%');
    });
});

describe('buildLedgerReceipt (content-addressed, schema-validated)', () => {
    const base = {
        userId: 'user-1',
        masterHash: 'a'.repeat(64),
        generation: '17273000000000000',
        releaseId: 'rel-1',
        evaluation: {
            lockable: true as const,
            reason: 'ok',
            splits: {
                recording: [
                    { collaboratorId: 'Ana Artist', shareBasisUnits: 600_000 },
                    { collaboratorId: 'Zed Producer', shareBasisUnits: 400_000 },
                ],
                publishing: [
                    { collaboratorId: 'Ana Artist', shareBasisUnits: 600_000 },
                    { collaboratorId: 'Wren Writer', shareBasisUnits: 400_000 },
                ],
            },
            signatories: [
                { collaboratorId: 'Ana Artist', method: 'split-invitation@v1', receiptHash: 'b'.repeat(40) },
                { collaboratorId: 'Zed Producer', method: 'split-invitation@v1', receiptHash: 'b'.repeat(40) },
                { collaboratorId: 'Wren Writer', method: 'split-invitation@v1', receiptHash: 'c'.repeat(40) },
            ],
        },
        identifiers: { isrc: 'USABC7123456' },
        lockedAtIso: '2026-09-26T12:00:00.000Z',
    };

    it('produces a schema-valid receipt with a deterministic id', () => {
        const receipt = buildLedgerReceipt(base);
        expect(receipt['id']).toMatch(/^led_v1_[0-9a-f]{40}$/);
        expect(receipt['id']).toBe(buildLedgerReceipt(base)['id']);
        const parsed = AdminLedgerReceiptSchema.safeParse(receipt);
        expect(parsed.success).toBe(true);
    });

    it('changes the id when the locked content changes (tamper-evident)', () => {
        const modified = buildLedgerReceipt({ ...base, lockedAtIso: '2026-09-26T12:00:01.000Z' });
        expect(modified['id']).not.toBe(buildLedgerReceipt(base)['id']);
    });

    it('never emits undefined identifier values (Firestore rejects them)', () => {
        const receipt = buildLedgerReceipt({ ...base, identifiers: { isrc: 'USABC7123456', iswc: undefined, upc: undefined } });
        expect(receipt['identifiers']).toEqual({ isrc: 'USABC7123456' });
        expect(Object.keys(receipt['identifiers'] as object)).not.toContain('iswc');
    });

    it('differs per master (different hashes never collide)', () => {
        const other = buildLedgerReceipt({ ...base, masterHash: 'b'.repeat(64) });
        expect(other['id']).not.toBe(ledgerReceiptIdFor(base));
    });
});
