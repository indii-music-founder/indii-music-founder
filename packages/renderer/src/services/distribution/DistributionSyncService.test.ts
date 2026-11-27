import { describe, it, expect, vi } from 'vitest';
import { DistributionSyncService } from '@/services/distribution/DistributionSyncService';
import { getDocs, getDoc, doc } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    getDocs: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    serverTimestamp: vi.fn(),
    db: {},
    auth: {
        currentUser: { uid: 'test-user', email: 'test@example.com' }
    },
    storage: {},
    functions: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    remoteConfig: { defaultConfig: {}, fetchAndActivate: vi.fn(() => Promise.resolve()), getValue: vi.fn(() => ({ asString: () => '', asBoolean: () => false, asNumber: () => 0 })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

describe('DistributionSyncService', () => {
    it('should map Firestore DDEXReleaseRecord to DashboardRelease', async () => {
        const mockData = {
            metadata: {
                releaseTitle: 'Album Title',
                trackTitle: 'Track Title',
                artistName: 'Artist Name',
                releaseDate: '2025-01-01',
            },
            assets: {
                coverArtUrl: 'https://example.com/cover.jpg',
            },
            distributors: [
                {
                    distributorId: 'distrokid',
                    status: 'live',
                    error: undefined
                },
                {
                    distributorId: 'tunecore',
                    status: 'processing',
                    error: 'Pending validation'
                }
            ]
        };

        const mockSnapshot = {
            docs: [
                {
                    id: 'doc-1',
                    data: () => mockData
                }
            ]
        };

        vi.mocked(getDocs).mockResolvedValueOnce(mockSnapshot as unknown as Awaited<ReturnType<typeof getDocs>>);

        const result = await DistributionSyncService.fetchReleases('org-1');

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            id: 'doc-1',
            title: 'Album Title',
            artist: 'Artist Name',
            coverArtUrl: 'https://example.com/cover.jpg',
            releaseDate: '2025-01-01',
            deployments: {
                distrokid: { status: 'live', error: undefined },
                tunecore: { status: 'processing', error: 'Pending validation' }
            }
        });
    });

    it('should fall back to trackTitle if releaseTitle is missing', async () => {
        const mockData = {
            metadata: {
                trackTitle: 'Single Title',
                artistName: 'Artist Name',
            },
            assets: {},
            distributors: []
        };

        vi.mocked(getDocs).mockResolvedValueOnce({
            docs: [{ id: 'doc-2', data: () => mockData }]
        } as unknown as Awaited<ReturnType<typeof getDocs>>);

        const result = await DistributionSyncService.fetchReleases('org-1');
        expect(result[0]!.title).toBe('Single Title');
    });

    it('lists records that have no metadata map instead of failing the whole catalogue (ISSUE-1692)', async () => {
        vi.mocked(getDocs).mockResolvedValueOnce({
            docs: [
                // Submit Release before ISSUE-1692: top-level title only.
                { id: 'release-legacy', data: () => ({ userId: 'test-user', title: 'Legacy Title', status: 'cover_art_audit_pending' }) },
                // DistributionTools.prepare_release: top-level title and artist.
                { id: 'release-staged', data: () => ({ userId: 'test-user', title: 'Staged', artist: 'Staged Artist', status: 'STAGED' }) },
                { id: 'release-bare', data: () => ({ userId: 'test-user', distributors: 'not-a-list' }) },
            ],
        } as unknown as Awaited<ReturnType<typeof getDocs>>);

        const result = await DistributionSyncService.fetchReleases('org-1');

        expect(result.map(release => [release.id, release.title, release.artist])).toEqual([
            ['release-legacy', 'Legacy Title', ''],
            ['release-staged', 'Staged', 'Staged Artist'],
            ['release-bare', 'Untitled release', ''],
        ]);
        expect(result[2]!.deployments).toEqual({});
    });

    it('should fetch a single release by ID', async () => {
        const mockReleaseData = {
            metadata: { releaseTitle: 'Test Release' },
            id: 'release-123'
        };

        const mockDocSnapshot = {
            exists: () => true,
            id: 'release-123',
            data: () => mockReleaseData
        };

        vi.mocked(getDoc).mockResolvedValueOnce(mockDocSnapshot as unknown as Awaited<ReturnType<typeof getDoc>>);

        const result = await DistributionSyncService.getRelease('release-123');
        expect(result).toEqual(mockReleaseData);
        expect(doc).toHaveBeenCalled();
        expect(getDoc).toHaveBeenCalled();
    });

    it('should return null if release does not exist', async () => {
        const mockDocSnapshot = {
            exists: () => false,
        };
        vi.mocked(getDoc).mockResolvedValueOnce(mockDocSnapshot as unknown as Awaited<ReturnType<typeof getDoc>>);

        const result = await DistributionSyncService.getRelease('non-existent');
        expect(result).toBeNull();
    });
});
