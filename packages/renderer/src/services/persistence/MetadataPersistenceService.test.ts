import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    auth: { currentUser: null as { uid: string } | null },
    addDoc: vi.fn(),
    collection: vi.fn((_db: unknown, path: string) => ({ path })),
    emit: vi.fn(),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    db: { name: 'test-db' },
}));

vi.mock('firebase/firestore', () => ({
    addDoc: mocks.addDoc,
    collection: mocks.collection,
    serverTimestamp: mocks.serverTimestamp,
}));

vi.mock('@/core/events', () => ({ events: { emit: mocks.emit } }));
vi.mock('@/utils/e2eMode', () => ({ isFirebaseE2EMockEnabled: () => false }));
vi.mock('@/utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { metadataPersistenceService } from './MetadataPersistenceService';

describe('MetadataPersistenceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.currentUser = { uid: 'user-123' };
        localStorage.clear();
    });

    it('persists audio metadata to the authenticated user collection', async () => {
        mocks.addDoc.mockResolvedValueOnce({ id: 'track-1' });

        const result = await metadataPersistenceService.save('audio', { filename: 'song.wav' });

        expect(result).toEqual({ success: true, docId: 'track-1', retryable: false });
        expect(mocks.collection).toHaveBeenCalledWith(expect.anything(), 'users/user-123/analyzed_tracks');
        expect(mocks.addDoc).toHaveBeenCalledWith(
            { path: 'users/user-123/analyzed_tracks' },
            expect.objectContaining({ filename: 'song.wav', userId: 'user-123', assetType: 'audio' }),
        );
    });

    it('fails explicitly when unauthenticated and never invents a pending-user save', async () => {
        mocks.auth.currentUser = null;
        localStorage.setItem('indii_pendingMetadataSaves', '[{"legacy":true}]');

        const result = await metadataPersistenceService.save('image', { prompt: 'cover art' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('logged in');
        expect(mocks.addDoc).not.toHaveBeenCalled();
        expect(localStorage.getItem('indii_pendingMetadataSaves')).toBe('[{"legacy":true}]');
        expect(mocks.emit).not.toHaveBeenCalledWith(
            'SYSTEM_ALERT',
            expect.objectContaining({ message: expect.stringContaining('Saved locally') }),
        );
    });

    it('reports a network failure without claiming the record was queued', async () => {
        mocks.addDoc.mockRejectedValueOnce(new Error('network offline'));

        const result = await metadataPersistenceService.save(
            'image',
            { prompt: 'cover art' },
            { maxRetries: 0 },
        );

        expect(result).toEqual({ success: false, error: 'network offline', retryable: true });
        expect(localStorage.getItem('indii_pendingMetadataSaves')).toBeNull();
        expect(mocks.emit).toHaveBeenCalledWith(
            'SYSTEM_ALERT',
            expect.objectContaining({ message: expect.stringContaining('Save failed after retries') }),
        );
    });
});
