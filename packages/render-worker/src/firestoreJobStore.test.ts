import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(),
    FieldValue: { serverTimestamp: () => '__ts__', delete: () => '__delete__' },
}));

import { createFirestoreJobStore } from './firestoreJobStore';

const path = 'users/artist-1/videoRenderJobs/job-1';

function harness(initial: Record<string, unknown>) {
    const records = new Map([[path, { ...initial }]]);
    const ref = (documentPath: string) => ({ path: documentPath, get: async () => ({ exists: records.has(documentPath), data: () => records.get(documentPath) }) });
    const db = {
        doc: vi.fn(ref),
        runTransaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) => run({
            get: async (document: { path: string }) => ({ data: () => records.get(document.path) }),
            update: (document: { path: string }, change: Record<string, unknown>) => {
                const next = { ...records.get(document.path), ...change };
                for (const [key, value] of Object.entries(next)) if (value === '__delete__') delete next[key];
                records.set(document.path, next);
            },
        })),
    };
    return { db, records };
}

describe('cloud render lease fencing', () => {
    const project = { id: 'project-1', clips: [] };
    it('rejects a cross-owner snapshot before claiming or loading media', async () => {
        const { db } = harness({ status: 'queued', userId: 'other', projectId: project.id, projectSnapshot: project });
        const store = createFirestoreJobStore(db as never);
        await expect(store.getJob(path)).rejects.toThrow(/owner/);
        await expect(store.setRunning(path)).rejects.toThrow(/owned/);
    });

    it('lets an expired lease be reclaimed while fencing the old worker', async () => {
        const { db, records } = harness({ status: 'queued', userId: 'artist-1', projectId: project.id, projectSnapshot: project });
        const first = createFirestoreJobStore(db as never);
        await first.setRunning(path);
        const originalToken = records.get(path)!.leaseToken;
        await expect(createFirestoreJobStore(db as never).setRunning(path)).rejects.toThrow(/expired-lease/);

        records.set(path, { ...records.get(path), leaseExpiresAtMs: Date.now() - 1 });
        const replacement = createFirestoreJobStore(db as never);
        await replacement.setRunning(path);
        expect(records.get(path)!.leaseToken).not.toBe(originalToken);
        await expect(first.setCompleted(path, 'gs://artifact', '42')).rejects.toThrow(/replaced/);
        await replacement.setCompleted(path, 'gs://artifact', '42');
        expect(records.get(path)).toMatchObject({ status: 'completed', artifactUrl: 'gs://artifact' });
    });
});
