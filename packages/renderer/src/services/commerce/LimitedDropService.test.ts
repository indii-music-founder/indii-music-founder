import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    addDoc: vi.fn(),
    collection: vi.fn(),
    serverTimestamp: vi.fn(),
    fromDate: vi.fn(),
    auth: { currentUser: { uid: 'artist-123' } as { uid: string } | null },
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    db: { app: 'firestore' },
}));

vi.mock('firebase/firestore', () => ({
    addDoc: mocks.addDoc,
    collection: mocks.collection,
    serverTimestamp: mocks.serverTimestamp,
    Timestamp: { fromDate: mocks.fromDate },
}));

import { LimitedDropService } from './LimitedDropService';

describe('LimitedDropService', () => {
    const futureDate = new Date(Date.now() + 86_400_000);

    beforeEach(() => {
        mocks.auth.currentUser = { uid: 'artist-123' };
        mocks.addDoc.mockReset().mockResolvedValue({ id: 'drop-123' });
        mocks.collection.mockReset().mockReturnValue('limitedDrops-ref');
        mocks.serverTimestamp.mockReset().mockReturnValue('server-time');
        mocks.fromDate.mockReset().mockReturnValue('drop-time');
    });

    it('persists one canonical top-level draft with an honest notification status', async () => {
        const service = new LimitedDropService();
        const result = await service.createDraft({
            selectedProductIds: ['shirt-1', 'shirt-1', 'vinyl-2'],
            dropName: 'Night Shift',
            dropDateTime: futureDate,
            presaleEnabled: true,
            superfanOnly: false,
            countdownMessage: 'Coming soon',
        });

        expect(mocks.collection).toHaveBeenCalledWith({ app: 'firestore' }, 'limitedDrops');
        expect(mocks.addDoc).toHaveBeenCalledWith('limitedDrops-ref', expect.objectContaining({
            userId: 'artist-123',
            selectedProductIds: ['shirt-1', 'vinyl-2'],
            status: 'draft',
            notificationStatus: 'setup_required',
            notificationProvider: 'none',
            dropDateTime: 'drop-time',
        }));
        expect(result).toEqual({
            dropId: 'drop-123',
            status: 'draft',
            notificationStatus: 'setup_required',
        });
    });

    it('rejects unauthenticated, empty-product, and past-date drafts before persistence', async () => {
        const service = new LimitedDropService();
        mocks.auth.currentUser = null;
        await expect(service.createDraft({
            selectedProductIds: ['shirt-1'],
            dropName: 'Night Shift',
            dropDateTime: futureDate,
            presaleEnabled: false,
            superfanOnly: false,
            countdownMessage: '',
        })).rejects.toThrow(/sign in/i);

        mocks.auth.currentUser = { uid: 'artist-123' };
        await expect(service.createDraft({
            selectedProductIds: [],
            dropName: 'Night Shift',
            dropDateTime: new Date(Date.now() - 1_000),
            presaleEnabled: false,
            superfanOnly: false,
            countdownMessage: '',
        })).rejects.toThrow();
        expect(mocks.addDoc).not.toHaveBeenCalled();
    });
});
