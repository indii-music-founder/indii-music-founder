import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
    collection: vi.fn((_db: unknown, path: string) => ({ path })),
    getDocs: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({ db: { project: 'test' } }));
vi.mock('firebase/firestore', () => firestoreMocks);

import { loadRegistrationCatalog } from './RegistrationCatalog';

describe('loadRegistrationCatalog', () => {
    beforeEach(() => vi.clearAllMocks());

    it('includes new owner tracks without a deleted field and maps canonical metadata names', async () => {
        firestoreMocks.getDocs.mockResolvedValue({
            docs: [{
                id: 'SONIC-master',
                data: () => ({
                    trackTitle: 'Water Finds a Way',
                    artistName: 'indii',
                    durationSeconds: 213.4,
                    isrc: 'USABC2600001',
                    iswc: 'T1234567890',
                    splits: [{
                        legalName: 'Writer One',
                        role: 'songwriter',
                        percentage: 100,
                        email: 'writer@example.com',
                    }],
                    releaseDate: '2026-07-17',
                }),
            }],
        });

        const tracks = await loadRegistrationCatalog('owner-1');

        expect(firestoreMocks.collection).toHaveBeenCalledWith(
            expect.anything(),
            'users/owner-1/tracks'
        );
        expect(tracks).toEqual([expect.objectContaining({
            id: 'SONIC-master',
            title: 'Water Finds a Way',
            duration: 213.4,
            isrc: 'USABC2600001',
            iswc: 'T1234567890',
            writersAndContributors: [{
                name: 'Writer One',
                role: 'songwriter',
                percentage: 100,
            }],
        })]);
    });

    it('filters only explicitly deleted tracks', async () => {
        firestoreMocks.getDocs.mockResolvedValue({
            docs: [
                { id: 'active', data: () => ({ trackTitle: 'Active', artistName: 'Artist' }) },
                { id: 'deleted', data: () => ({ trackTitle: 'Deleted', artistName: 'Artist', deleted: true }) },
            ],
        });

        const tracks = await loadRegistrationCatalog('owner-1');

        expect(tracks.map(track => track.id)).toEqual(['active']);
    });

    it('uses composition shares for writer registration, never master-recording shares', async () => {
        firestoreMocks.getDocs.mockResolvedValue({
            docs: [{
                id: 'split-track',
                data: () => ({
                    trackTitle: 'Split Rights',
                    artistName: 'Artist',
                    compositionSplits: [{
                        legalName: 'Composition Writer',
                        role: 'songwriter',
                        percentage: 100,
                        email: 'writer@example.com',
                    }],
                    recordingSplits: [{
                        legalName: 'Master Owner',
                        role: 'producer',
                        percentage: 100,
                        email: 'owner@example.com',
                    }],
                }),
            }],
        });

        const [track] = await loadRegistrationCatalog('owner-1');

        expect(track?.writersAndContributors).toEqual([{
            name: 'Composition Writer',
            role: 'songwriter',
            percentage: 100,
        }]);
    });
});
