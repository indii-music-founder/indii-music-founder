import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
    auth: { currentUser: { uid: 'owner-1' } as { uid: string } | null },
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn((reference: unknown) => reference),
    setDoc: vi.fn(),
    timestamp: class MockTimestamp {
        static now = vi.fn(() => 'timestamp');
    },
}));

vi.mock('@/services/firebase', () => ({
    auth: firebaseMocks.auth,
    db: { project: 'test' },
}));

vi.mock('firebase/firestore', () => ({
    collection: firebaseMocks.collection,
    doc: firebaseMocks.doc,
    getDoc: firebaseMocks.getDoc,
    getDocs: firebaseMocks.getDocs,
    query: firebaseMocks.query,
    setDoc: firebaseMocks.setDoc,
    Timestamp: firebaseMocks.timestamp,
}));

import { TrackLibraryService } from './TrackLibraryService';
import type { ExtendedGoldenMetadata } from './types';

describe('TrackLibraryService', () => {
    const metadata = {
        masterFingerprint: 'SONIC-owner-master',
        trackTitle: 'Owned Track',
    } as ExtendedGoldenMetadata;

    beforeEach(() => {
        vi.clearAllMocks();
        firebaseMocks.auth.currentUser = { uid: 'owner-1' };
    });

    it('reads a fingerprint from the authenticated owner-scoped catalog', async () => {
        firebaseMocks.getDoc.mockResolvedValue({
            exists: () => true,
            id: metadata.masterFingerprint,
            data: () => ({ ...metadata, userId: 'owner-1' }),
        });

        const service = new TrackLibraryService();
        const result = await service.getByFingerprint(metadata.masterFingerprint!);

        expect(firebaseMocks.doc).toHaveBeenCalledWith(
            expect.anything(),
            'users',
            'owner-1',
            'tracks',
            metadata.masterFingerprint
        );
        expect(result?.userId).toBe('owner-1');
    });

    it('writes the owner identity with metadata under the same scoped path', async () => {
        const service = new TrackLibraryService();

        await service.saveTrack(metadata);

        expect(firebaseMocks.setDoc).toHaveBeenCalledWith(
            expect.objectContaining({ path: `users/owner-1/tracks/${metadata.masterFingerprint}` }),
            expect.objectContaining({
                ...metadata,
                userId: 'owner-1',
                updatedAt: 'timestamp',
            }),
            { merge: true }
        );
    });

    it('refuses catalog access without an authenticated owner', async () => {
        firebaseMocks.auth.currentUser = null;
        const service = new TrackLibraryService();

        await expect(service.getByFingerprint(metadata.masterFingerprint!))
            .rejects.toThrow('authenticated');
    });
});
