import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    auth: { currentUser: { uid: 'artist-123' } as { uid: string } | null },
    collection: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    query: vi.fn(),
    getDocs: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    auth: mocks.auth,
    db: { app: 'firestore' },
}));

vi.mock('firebase/firestore', () => ({
    collection: mocks.collection,
    where: mocks.where,
    limit: mocks.limit,
    query: mocks.query,
    getDocs: mocks.getDocs,
}));

import {
    getReleaseArtist,
    getReleaseCoverUrl,
    getReleaseDate,
    getReleaseGenre,
    getReleaseIsrc,
    getReleaseTitle,
    getReleaseWriters,
    ReleaseCatalogService,
} from './ReleaseCatalogService';

describe('ReleaseCatalogService', () => {
    beforeEach(() => {
        mocks.auth.currentUser = { uid: 'artist-123' };
        mocks.collection.mockReset().mockReturnValue('release-collection');
        mocks.where.mockReset().mockReturnValue('owner-filter');
        mocks.limit.mockReset().mockReturnValue('result-limit');
        mocks.query.mockReset().mockReturnValue('release-query');
        mocks.getDocs.mockReset().mockResolvedValue({
            docs: [{ id: 'release-1', data: () => ({ metadata: { trackTitle: 'Night Shift' } }) }],
        });
    });

    it('queries the canonical top-level collection with an owner constraint', async () => {
        const records = await new ReleaseCatalogService().listCurrentUserReleases();

        expect(mocks.collection).toHaveBeenCalledWith({ app: 'firestore' }, 'proprietaryIngestionReleases');
        expect(mocks.where).toHaveBeenCalledWith('userId', '==', 'artist-123');
        expect(mocks.query).toHaveBeenCalledWith('release-collection', 'owner-filter', 'result-limit');
        expect(records).toEqual([{ id: 'release-1', data: { metadata: { trackTitle: 'Night Shift' } } }]);
    });

    it('rejects an unauthenticated lookup instead of returning an empty catalog', async () => {
        mocks.auth.currentUser = null;
        await expect(new ReleaseCatalogService().listCurrentUserReleases()).rejects.toThrow(/sign in/i);
        expect(mocks.getDocs).not.toHaveBeenCalled();
    });

    it('normalizes both canonical and legacy top-level document shapes', () => {
        const timestamp = { toDate: () => new Date('2026-09-01T00:00:00Z') };
        const data = {
            metadata: {
                trackTitle: 'Night Shift',
                isrc: 'US-ABC-26-00001',
                releaseDate: timestamp,
                writers: [{ name: 'A. Writer' }],
            },
            assets: { isrc: 'ignored-fallback' },
        };
        expect(getReleaseTitle(data)).toBe('Night Shift');
        expect(getReleaseIsrc(data)).toBe('US-ABC-26-00001');
        expect(getReleaseDate(data)?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
        expect(getReleaseWriters(data)).toEqual(['A. Writer']);
        expect(getReleaseTitle({ title: 'Legacy Root Title' })).toBe('Legacy Root Title');
        expect(getReleaseArtist({ metadata: { artistName: 'The Artist' } })).toBe('The Artist');
        expect(getReleaseGenre({ genre: 'Soul' })).toBe('Soul');
        expect(getReleaseCoverUrl({ assets: { coverArtUrl: 'https://example.com/cover.jpg' } })).toBe('https://example.com/cover.jpg');
    });
});
