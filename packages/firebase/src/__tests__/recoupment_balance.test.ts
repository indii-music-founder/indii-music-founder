import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin', () => ({
    apps: [{}],
    initializeApp: vi.fn(),
    firestore: Object.assign(vi.fn(), {
        FieldValue: { serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP') },
    }),
}));

vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_options: unknown, handler: unknown) => handler),
    HttpsError: class HttpsError extends Error {
        constructor(public code: string, message: string) {
            super(message);
        }
    },
}));

import { processSetRecoupmentBalance } from '../functions/finance/setRecoupmentBalance';

function makeFirestore(seed: Record<string, Record<string, unknown>>) {
    const store = new Map(Object.entries(seed));
    const reference = (path: string): any => ({
        path,
        collection: (name: string) => collection(`${path}/${name}`),
    });
    const collection = (path: string): any => ({ doc: (id: string) => reference(`${path}/${id}`) });
    const snapshot = (path: string) => ({ exists: store.has(path), data: () => store.get(path) });
    const firestore = {
        collection,
        runTransaction: async (callback: (transaction: any) => Promise<unknown>) => callback({
            get: async (ref: any) => snapshot(ref.path),
            set: (ref: any, data: Record<string, unknown>, options?: { merge?: boolean }) => {
                store.set(ref.path, options?.merge ? { ...store.get(ref.path), ...data } : data);
            },
        }),
    };
    return { firestore, store };
}

describe('processSetRecoupmentBalance', () => {
    it('derives the owner release identity from the server catalog and records an idempotent audit adjustment', async () => {
        const { firestore, store } = makeFirestore({
            'users/owner-1/tracks/track-1': { upc: '012345678901' },
        });

        const first = await processSetRecoupmentBalance('owner-1', {
            trackId: 'track-1',
            amount: 125.5,
            requestId: 'request-1',
            reason: 'Approved recording costs',
        }, firestore as never);
        const second = await processSetRecoupmentBalance('owner-1', {
            trackId: 'track-1',
            amount: 125.5,
            requestId: 'request-1',
            reason: 'Approved recording costs',
        }, firestore as never);

        expect(first).toEqual(expect.objectContaining({
            releaseId: '012345678901',
            balanceMicros: 125_500_000,
            alreadyApplied: false,
        }));
        expect(second.alreadyApplied).toBe(true);
        expect([...store.entries()].find(([path]) => path.startsWith('recoupment_balances/'))?.[1])
            .toEqual(expect.objectContaining({
                userId: 'owner-1',
                releaseId: '012345678901',
                balanceMicros: 125_500_000,
            }));
        expect([...store.entries()].filter(([path]) => path.startsWith('recoupment_adjustments/'))).toHaveLength(1);
    });

    it('refuses a track that is not present in the authenticated owner catalog', async () => {
        const { firestore } = makeFirestore({
            'users/owner-1/tracks/track-1': { upc: '012345678901' },
        });

        await expect(processSetRecoupmentBalance('attacker', {
            trackId: 'track-1',
            amount: 10,
            requestId: 'request-1',
            reason: 'Attempt',
        }, firestore as never)).rejects.toThrow(/not found/);
    });
});
