import { describe, it, expect, vi } from 'vitest';
import { DistributionSyncService } from './DistributionSyncService';
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

        (getDocs as any).mockResolvedValueOnce(mockSnapshot);

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

        (getDocs as any).mockResolvedValueOnce({
            docs: [{ id: 'doc-2', data: () => mockData }]
        });

        const result = await DistributionSyncService.fetchReleases('org-1');
        expect(result[0].title).toBe('Single Title');
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

        (getDoc as any).mockResolvedValueOnce(mockDocSnapshot);

        const result = await DistributionSyncService.getRelease('release-123');
        expect(result).toEqual(mockReleaseData);
        expect(doc).toHaveBeenCalled();
        expect(getDoc).toHaveBeenCalled();
    });

    it('should return null if release does not exist', async () => {
        const mockDocSnapshot = {
            exists: () => false,
        };
        (getDoc as any).mockResolvedValueOnce(mockDocSnapshot);

        const result = await DistributionSyncService.getRelease('non-existent');
        expect(result).toBeNull();
    });
});
