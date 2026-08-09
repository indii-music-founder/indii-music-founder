import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlatformData } from './types';

const spotifyPlatform: PlatformData = {
    platform: 'spotify',
    streams: 1000,
    saves: 100,
    completionRate: 0.5,
};

const spotifyServiceMock = vi.hoisted(() => ({
    isConnected: vi.fn(),
    buildPlatformData: vi.fn(),
    buildStreamHistory: vi.fn(),
    getTrack: vi.fn(),
    getArtist: vi.fn(),
}));

const youtubeServiceMock = vi.hoisted(() => ({
    isConnected: vi.fn(),
    buildPlatformData: vi.fn(),
    getChannel: vi.fn(),
    buildRegionData: vi.fn(),
}));

const tiktokServiceMock = vi.hoisted(() => ({
    isConnected: vi.fn(),
    buildPlatformData: vi.fn(),
}));

const instagramServiceMock = vi.hoisted(() => ({
    isConnected: vi.fn(),
    buildPlatformData: vi.fn(),
}));

const appleMusicServiceMock = vi.hoisted(() => ({
    isConnected: vi.fn(),
    buildPlatformData: vi.fn(),
}));

const releaseCatalogServiceMock = vi.hoisted(() => ({
    listCurrentUserReleases: vi.fn(),
}));

vi.mock('./SpotifyService', () => ({ spotifyService: spotifyServiceMock }));
vi.mock('./YouTubeAnalyticsService', () => ({ youTubeAnalyticsService: youtubeServiceMock }));
vi.mock('./TikTokAnalyticsService', () => ({ tikTokAnalyticsService: tiktokServiceMock }));
vi.mock('./InstagramAnalyticsService', () => ({ instagramAnalyticsService: instagramServiceMock }));
vi.mock('./AppleMusicService', () => ({ appleMusicService: appleMusicServiceMock }));
vi.mock('@/services/distribution/ReleaseCatalogService', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/services/distribution/ReleaseCatalogService')>();
    return { ...original, releaseCatalogService: releaseCatalogServiceMock };
});

describe('PlatformDataService attribution boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        spotifyServiceMock.isConnected.mockResolvedValue(true);
        spotifyServiceMock.buildPlatformData.mockResolvedValue({
            platform: spotifyPlatform,
            tracks: [
                {
                    id: 'track-1',
                    name: 'First Track',
                    artist: 'Artist',
                    albumArt: 'https://example.com/cover.jpg',
                    releaseDate: '2026-01-01',
                    popularity: 80,
                },
                {
                    id: 'track-2',
                    name: 'Second Track',
                    artist: 'Artist',
                    albumArt: 'https://example.com/cover-2.jpg',
                    releaseDate: '2026-01-02',
                    popularity: 20,
                },
            ],
        });
        spotifyServiceMock.buildStreamHistory.mockResolvedValue([]);

        youtubeServiceMock.isConnected.mockResolvedValue(false);
        tiktokServiceMock.isConnected.mockResolvedValue(false);
        instagramServiceMock.isConnected.mockResolvedValue(false);
        appleMusicServiceMock.isConnected.mockResolvedValue(true);
        releaseCatalogServiceMock.listCurrentUserReleases.mockResolvedValue([
            {
                id: 'release-1',
                data: {
                    metadata: {
                        trackTitle: 'Owned Track',
                        artistName: 'Owned Artist',
                        genre: 'Soul',
                        releaseDate: '2026-01-01',
                    },
                    assets: { coverArtUrl: 'https://example.com/owned-cover.jpg' },
                },
            },
        ]);
    });

    it('does not fabricate Spotify artist metrics or a zero-filled history', async () => {
        appleMusicServiceMock.buildPlatformData.mockResolvedValue(null);
        const { PlatformDataService } = await import('./PlatformDataService');

        const catalogue = await new PlatformDataService().buildCatalogue();

        expect(catalogue[0]?.platforms.map(platform => platform.platform)).toEqual(['spotify', 'apple_music']);
        expect(catalogue[0]).toMatchObject({
            trackId: 'release-1',
            trackName: 'Owned Track',
            artistName: 'Owned Artist',
            releaseDate: '2026-01-01',
            totalStreams: 0,
            history: [],
            regions: [],
        });
        expect(catalogue[0]?.platforms[0]).toMatchObject({
            streams: 0,
            saves: 0,
            completionRate: 0,
            metricsUnavailable: true,
        });
    });

    it('does not allocate artist-level Apple Music data across unrelated Spotify tracks', async () => {
        appleMusicServiceMock.buildPlatformData.mockResolvedValue({
            platform: 'apple_music',
            streams: 100,
            saves: 10,
            completionRate: 0.75,
            creatorCount: 0,
        } satisfies PlatformData);
        const { PlatformDataService } = await import('./PlatformDataService');

        const catalogue = await new PlatformDataService().buildCatalogue();

        expect(catalogue[0]?.platforms.find(platform => platform.platform === 'apple_music')).toMatchObject({
            streams: 0,
            saves: 0,
            completionRate: 0,
            metricsUnavailable: true,
        });
        expect(catalogue.reduce((sum, track) => sum + track.totalStreams, 0)).toBe(0);
        expect(appleMusicServiceMock.buildPlatformData).not.toHaveBeenCalled();
        expect(spotifyServiceMock.buildPlatformData).not.toHaveBeenCalled();
    });
});
