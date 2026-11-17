import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateDoc = vi.hoisted(() => vi.fn());
const docMock = vi.hoisted(() => vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })));
vi.mock('firebase/firestore', () => ({ doc: docMock, updateDoc }));
vi.mock('@/services/firebase', () => ({ db: {} }));

import { persistUserUpdates } from './brandPersistence';

describe('persistUserUpdates', () => {
    beforeEach(() => vi.clearAllMocks());

    it('writes the fields to the signed-in user and reports success', async () => {
        updateDoc.mockResolvedValue(undefined);
        const onFailure = vi.fn();
        expect(await persistUserUpdates('u1', { careerStage: 'Established' }, onFailure)).toBe(true);
        expect(updateDoc).toHaveBeenCalledWith({ path: 'users/u1' }, { careerStage: 'Established' });
        expect(onFailure).not.toHaveBeenCalled();
    });

    it('tells the user instead of rejecting when the write fails', async () => {
        updateDoc.mockRejectedValue(new Error('PERMISSION_DENIED'));
        const onFailure = vi.fn();
        await expect(persistUserUpdates('u1', { goals: ['a'] }, onFailure)).resolves.toBe(false);
        expect(onFailure).toHaveBeenCalledWith('Your change could not be saved. Please try again.');
    });

    it('does nothing without a user id', async () => {
        const onFailure = vi.fn();
        expect(await persistUserUpdates(undefined, { goals: [] }, onFailure)).toBe(false);
        expect(updateDoc).not.toHaveBeenCalled();
        expect(onFailure).not.toHaveBeenCalled();
    });
});
