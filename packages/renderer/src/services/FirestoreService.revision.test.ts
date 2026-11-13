import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocFromServer, runTransaction, type DocumentSnapshot, type Transaction } from 'firebase/firestore';
import { FirestoreService } from './FirestoreService';

vi.mock('@/utils/e2eMode', () => ({ isFirebaseE2EMockEnabled: () => false }));

const write = vi.fn();
let saved: Record<string, unknown> | undefined;
function transaction(record: Record<string, unknown> | undefined, set = write): Transaction {
    return {
        get: vi.fn(async () => ({ exists: () => record !== undefined, data: () => record }) as DocumentSnapshot),
        set,
    } as unknown as Transaction;
}
const service = new FirestoreService('users/owner/agentLoopExecutions');

// Structural SDK adapter tests. Real transaction conflicts/rules are also exercised
// separately against an isolated Firestore emulator, never against production data.
describe('FirestoreService revision writes', () => {
    beforeEach(() => {
        saved = { checkpointRevision: 1 };
        write.mockReset();
        vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback(transaction(saved)));
    });
    it('requires a server read when refreshing an execution for resume', async () => {
        vi.mocked(getDocFromServer).mockResolvedValueOnce({ exists: () => true, id: 'execution', data: () => ({ checkpointRevision: 3 }) } as unknown as DocumentSnapshot);
        expect(await service.get('execution', true)).toEqual({ id: 'execution', checkpointRevision: 3 });
        expect(getDocFromServer).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/owner/agentLoopExecutions/execution' }));
    });
    it('writes the next revision only when the expected revision matches', async () => {
        expect(await service.setIfRevision('execution', { id: 'execution', nested: { keep: 1, omit: undefined } }, 'checkpointRevision', 1)).toBe(2);
        expect(write).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/owner/agentLoopExecutions/execution' }),
            expect.objectContaining({ id: 'execution', checkpointRevision: 2, nested: { keep: 1 } }));
    });
    it('does not recreate a deleted checkpoint or overwrite a newer one', async () => {
        saved = undefined;
        await expect(service.setIfRevision('execution', {}, 'checkpointRevision', 1)).rejects.toThrow('revision changed');
        saved = { checkpointRevision: 2 };
        await expect(service.setIfRevision('execution', {}, 'checkpointRevision', 1)).rejects.toThrow('revision changed');
        expect(write).not.toHaveBeenCalled();
    });
    it('creates only missing records and upgrades a legacy record once', async () => {
        await expect(service.setIfRevision('execution', {}, 'checkpointRevision', null)).rejects.toThrow('revision changed');
        saved = undefined;
        expect(await service.setIfRevision('execution', {}, 'checkpointRevision', null)).toBe(1);
        saved = { id: 'legacy' };
        expect(await service.setIfRevision('legacy', {}, 'checkpointRevision', 0)).toBe(1);
    });
    it('rechecks its original expected revision when Firestore retries a transaction', async () => {
        const discardedWrite = vi.fn();
        vi.mocked(runTransaction).mockImplementationOnce(async (_db, callback) => {
            await callback(transaction({ checkpointRevision: 1 }, discardedWrite));
            return callback(transaction({ checkpointRevision: 2 }));
        });
        await expect(service.setIfRevision('execution', {}, 'checkpointRevision', 1)).rejects.toThrow('revision changed');
        expect(discardedWrite).toHaveBeenCalledOnce();
        expect(write).not.toHaveBeenCalled();
    });
    it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER])('rejects an invalid expected revision %s', async expected => {
        await expect(service.setIfRevision('execution', {}, 'checkpointRevision', expected)).rejects.toThrow('Invalid expected');
        expect(write).not.toHaveBeenCalled();
    });
});
