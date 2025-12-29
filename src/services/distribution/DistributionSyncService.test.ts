import { describe, it, expect, vi } from 'vitest';
import { DistributionSyncService } from './DistributionSyncService';
import { getDocs } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    getDocs: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
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
});
