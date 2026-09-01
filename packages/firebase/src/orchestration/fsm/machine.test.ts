import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    type Snap = { exists: boolean; data: () => Record<string, unknown> };
    const documents = new Map<string, Record<string, unknown>>();

    const docRef = (collectionName: string, docId: string) => {
        const fullPath = `${collectionName}/${docId}`;
        return {
            __path: fullPath,
            get: vi.fn(async (): Promise<Snap> => {
                const stored = documents.get(fullPath);
                return {
                    exists: stored !== undefined,
                    data: () => stored || {},
                };
            }),
            set: vi.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
                if (opts?.merge && documents.has(fullPath)) {
                    documents.set(fullPath, { ...documents.get(fullPath), ...data });
                } else {
                    documents.set(fullPath, { ...data });
                }
            }),
        };
    };

    const runTransaction = vi.fn(async (cb: (tx: any) => Promise<unknown>) => {
        const tx = {
            get: async (ref: { __path: string }) => {
                const stored = documents.get(ref.__path);
                return {
                    exists: stored !== undefined,
                    data: () => stored || {},
                };
            },
            set: (ref: { __path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
                if (opts?.merge && documents.has(ref.__path)) {
                    documents.set(ref.__path, { ...documents.get(ref.__path), ...data });
                } else {
                    documents.set(ref.__path, { ...data });
                }
            },
        };
        return cb(tx);
    });

    const firestoreMock = {
        collection: vi.fn((colName: string) => ({
            doc: (docId: string) => docRef(colName, docId),
        })),
        runTransaction,
    };

    return {
        documents,
        firestoreMock,
        runTransaction,
    };
});

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => mocks.firestoreMock,
}));

import { CampaignFSM } from './machine';

describe('CampaignFSM', () => {
    beforeEach(() => {
        mocks.documents.clear();
        vi.clearAllMocks();
    });

    it('initializes to IDLE state when no document exists', async () => {
        const fsm = new CampaignFSM('release-123');
        const state = await fsm.getState();

        expect(state.releaseId).toBe('release-123');
        expect(state.state).toBe('IDLE');
        expect(state.retries).toBe(0);
    });

    it('transitions state atomically through runTransaction', async () => {
        const fsm = new CampaignFSM('release-123');
        await fsm.transition('ANALYZING');

        expect(mocks.runTransaction).toHaveBeenCalledOnce();
        const stored = mocks.documents.get('campaign_fsm/release-123');
        expect(stored).toBeDefined();
        expect(stored?.state).toBe('ANALYZING');
        expect(stored?.releaseId).toBe('release-123');
    });

    it('increments retry count on FAILED transition with error message', async () => {
        const fsm = new CampaignFSM('release-retry');
        await fsm.transition('ANALYZING');
        await fsm.transition('FAILED', 'DSP connection timeout');

        const state = await fsm.getState();
        expect(state.state).toBe('FAILED');
        expect(state.error).toBe('DSP connection timeout');
        expect(state.retries).toBe(1);

        // Fail again
        await fsm.transition('FAILED', 'Retry timeout');
        const state2 = await fsm.getState();
        expect(state2.retries).toBe(2);
    });

    it('rejects state transition if campaign is already COMPLETED', async () => {
        const fsm = new CampaignFSM('release-done');
        await fsm.transition('COMPLETED');

        await expect(fsm.transition('DISTRIBUTING')).rejects.toThrow(
            /Cannot transition a completed campaign/
        );
    });
});
