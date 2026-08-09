import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
    get: vi.fn(),
    list: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
}));

vi.mock('@/services/FirestoreService', () => ({
    FirestoreService: class {
        get = firestoreMocks.get;
        list = firestoreMocks.list;
        set = firestoreMocks.set;
        update = firestoreMocks.update;
    },
}));

vi.mock('firebase/firestore', () => ({
    Timestamp: {
        now: vi.fn(() => ({ seconds: 123, nanoseconds: 0 })),
    },
}));
vi.mock('@/utils/logger', () => ({
    logger: { warn: vi.fn(), info: vi.fn() },
}));

import { WikiStorageAdapter } from './WikiStorageAdapter';

describe('WikiStorageAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('propagates document read failures instead of treating them as missing', async () => {
        const failure = new Error('permission denied');
        firestoreMocks.get.mockRejectedValue(failure);

        await expect(
            new WikiStorageAdapter().readWikiDoc('user-1', 'Tour_Plan')
        ).rejects.toBe(failure);
    });

    it('propagates list failures instead of returning an empty knowledge base', async () => {
        const failure = new Error('offline');
        firestoreMocks.list.mockRejectedValue(failure);

        await expect(
            new WikiStorageAdapter().listWikiDocs('user-1')
        ).rejects.toBe(failure);
    });

    it('does not overwrite a document when the existence check fails', async () => {
        firestoreMocks.get.mockRejectedValue(new Error('read failed'));

        await expect(
            new WikiStorageAdapter().writeWikiDoc('user-1', 'Brand', {
                content: '# Brand',
            })
        ).rejects.toThrow('read failed');

        expect(firestoreMocks.set).not.toHaveBeenCalled();
        expect(firestoreMocks.update).not.toHaveBeenCalled();
    });
});
