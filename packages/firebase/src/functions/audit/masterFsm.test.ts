import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── firebase-admin/firestore double (ISSUE-1212 style: only the surface the
// FSM touches, deliberately not the full SDK shape) ──────────────────────────
type DocState = { exists: boolean; data: Record<string, unknown> | undefined };

let docState: DocState;
let updatedData: Record<string, unknown> | undefined; // captured from tx.update(ref, data)
let setData: Record<string, unknown> | undefined;     // captured from tx.set(ref, data) / doc.set(data)

const docRef = {
    get: vi.fn(async () => ({ exists: docState.exists, data: () => docState.data })),
    // Direct document mutation (setMasterOpenTasks) — data is the FIRST arg.
    set: vi.fn(async (data: Record<string, unknown>) => { setData = data; }),
    // DocumentReference.collection(sub) → CollectionReference (real SDK shape).
    collection: vi.fn(() => ({ doc: docFactory })),
};

// Transaction-scoped mutations — the reference is the FIRST arg, data second.
// Writes flip the simulated store so follow-up reads observe them.
const txUpdate = vi.fn(async (_ref: unknown, data: Record<string, unknown>) => {
    updatedData = data;
    docState = { exists: true, data: { ...(docState.data ?? {}), ...data } };
});
const txSet = vi.fn(async (_ref: unknown, data: Record<string, unknown>) => {
    setData = data;
    docState = { exists: true, data };
});

const docFactory = vi.fn(() => docRef);
const collectionFactory = vi.fn(() => ({ doc: docFactory }));

const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
        get: docRef.get,
        update: txUpdate,
        set: txSet,
    };
    return await fn(tx);
});

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => ({ collection: collectionFactory, runTransaction }),
    Timestamp: {
        now: () => ({ toDate: () => new Date('2026-09-26T12:00:00Z') }),
        fromDate: (date: Date) => date,
    },
    FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' },
}));

import {
    ensureMasterAdminState,
    MasterLifecycleTransitionError,
    readMasterAdminState,
    setMasterOpenTasks,
    transitionMasterLifecycle,
} from './masterFsm.js';

const ingestedState = {
    id: 'a'.repeat(40),
    userId: 'user-1',
    schemaVersion: 'master-admin-state.v1',
    masterHash: 'a'.repeat(40),
    storagePath: 'users/user-1/masters/x/original.wav',
    generation: '17273000000000000',
    lifecycle: 'INGESTED',
    enteredAt: '2026-09-26T10:00:00.000Z',
    history: [{ from: 'DRAFT', to: 'INGESTED', at: '2026-09-26T10:00:00.000Z', actor: 'runbook' }],
    openTaskIds: [],
    createdAt: '2026-09-26T10:00:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
};

describe('masterFsm (transactional lifecycle guard)', () => {
    beforeEach(() => {
        docState = { exists: true, data: structuredClone(ingestedState) };
        updatedData = undefined;
        setData = undefined;
        docRef.get.mockClear();
        docRef.set.mockClear();
        txUpdate.mockClear();
        txSet.mockClear();
    });

    it('applies a legal edge and appends bounded history', async () => {
        const result = await transitionMasterLifecycle('user-1', 'a'.repeat(40), 'METADATA_AUDITED', 'runbook', 'metadata audit clean');
        expect(result).toEqual({ from: 'INGESTED', to: 'METADATA_AUDITED', changed: true });
        expect(txUpdate).toHaveBeenCalledTimes(1);
        expect(updatedData?.['lifecycle']).toBe('METADATA_AUDITED');
        const history = updatedData?.['history'] as { from: string; to: string; reason?: string }[];
        expect(history).toHaveLength(2);
        expect(history[1]).toMatchObject({ from: 'INGESTED', to: 'METADATA_AUDITED', actor: 'runbook', reason: 'metadata audit clean' });
    });

    it('is an idempotent no-op when re-asserting the current status', async () => {
        const result = await transitionMasterLifecycle('user-1', 'a'.repeat(40), 'INGESTED', 'runbook');
        expect(result).toEqual({ from: 'INGESTED', to: 'INGESTED', changed: false });
        expect(txUpdate).not.toHaveBeenCalled();
    });

    it('throws on illegal edges — no gate may be skipped', async () => {
        await expect(
            transitionMasterLifecycle('user-1', 'a'.repeat(40), 'ADMIN_LOCKED', 'runbook'),
        ).rejects.toBeInstanceOf(MasterLifecycleTransitionError);
        await expect(
            transitionMasterLifecycle('user-1', 'a'.repeat(40), 'DISTRIBUTION_READY', 'runbook'),
        ).rejects.toThrow(/INGESTED → DISTRIBUTION_READY/);
        expect(txUpdate).not.toHaveBeenCalled();
    });

    it('throws when the state document does not exist', async () => {
        docState = { exists: false, data: undefined };
        await expect(
            transitionMasterLifecycle('user-1', 'a'.repeat(40), 'INGESTED', 'runbook'),
        ).rejects.toBeInstanceOf(MasterLifecycleTransitionError);
    });

    it('ensureMasterAdminState creates DRAFT only when absent', async () => {
        docState = { exists: false, data: undefined };
        const created = await ensureMasterAdminState('user-1', {
            masterHash: 'b'.repeat(40),
            storagePath: 'users/user-1/masters/b/original.wav',
            generation: '17273000000000001',
        });
        expect(created).toEqual({ created: true });
        expect(txSet).toHaveBeenCalledTimes(1);
        expect(setData?.['lifecycle']).toBe('DRAFT');
        expect(setData?.['id']).toBe('b'.repeat(40));
        expect(Array.isArray(setData?.['history'])).toBe(true);

        // Second call against the now-existing doc: ensure must be a no-op.
        txSet.mockClear();
        const existing = await ensureMasterAdminState('user-1', {
            masterHash: 'a'.repeat(40),
            storagePath: 'x',
            generation: '1',
        });
        expect(existing).toEqual({ created: false });
        expect(txSet).not.toHaveBeenCalled();
    });

    it('readMasterAdminState returns undefined for missing docs and mirrors fields for existing ones', async () => {
        expect(await readMasterAdminState('user-1', 'a'.repeat(40))).toMatchObject({
            lifecycle: 'INGESTED',
            generation: '17273000000000000',
            openTaskIds: [],
        });
        docState = { exists: false, data: undefined };
        expect(await readMasterAdminState('user-1', 'a'.repeat(40))).toBeUndefined();
    });

    it('setMasterOpenTasks merges the pointer list without touching lifecycle', async () => {
        await setMasterOpenTasks('user-1', 'a'.repeat(40), ['task-1']);
        expect(setData).toMatchObject({ openTaskIds: ['task-1'] });
        expect(setData).not.toHaveProperty('lifecycle');
    });
});
