import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlatformData, StreamDataPoint } from './types';

const spotifyPlatform: PlatformData = {
    platform: 'spotify',
    streams: 1000,
    saves: 100,
    completionRate: 0.5,
};

const spotifyHistory: StreamDataPoint[] = [{
    date: '2026-07-01',
    streams: 50,
    saves: 5,
    completions: 40,
    uniqueListeners: 35,
    shares: 2,
    newFollowers: 1,
    playlistAdditions: 1,
}];

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

vi.mock('./SpotifyService', () => ({ spotifyService: spotifyServiceMock }));
vi.mock('./YouTubeAnalyticsService', () => ({ youTubeAnalyticsService: youtubeServiceMock }));
vi.mock('./TikTokAnalyticsService', () => ({ tikTokAnalyticsService: tiktokServiceMock }));
vi.mock('./InstagramAnalyticsService', () => ({ instagramAnalyticsService: instagramServiceMock }));
vi.mock('./AppleMusicService', () => ({ appleMusicService: appleMusicServiceMock }));

describe('PlatformDataService Apple Music handling', () => {
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
        spotifyServiceMock.buildStreamHistory.mockResolvedValue(spotifyHistory);

        youtubeServiceMock.isConnected.mockResolvedValue(false);
        tiktokServiceMock.isConnected.mockResolvedValue(false);
        instagramServiceMock.isConnected.mockResolvedValue(false);
        appleMusicServiceMock.isConnected.mockResolvedValue(true);
    });

    it('omits Apple Music when it is connected but real analytics are unavailable', async () => {
        appleMusicServiceMock.buildPlatformData.mockResolvedValue(null);
        const { PlatformDataService } = await import('./PlatformDataService');

        const catalogue = await new PlatformDataService().buildCatalogue();

        expect(catalogue[0]?.platforms.map(platform => platform.platform)).toEqual(['spotify']);
        expect(catalogue[0]?.totalStreams).toBe(1000);
    });

    it('includes Apple Music only when real partner platform data is returned', async () => {
        appleMusicServiceMock.buildPlatformData.mockResolvedValue({
            platform: 'apple_music',
            streams: 100,
            saves: 10,
            completionRate: 0.75,
            creatorCount: 0,
        } satisfies PlatformData);
        const { PlatformDataService } = await import('./PlatformDataService');

        const catalogue = await new PlatformDataService().buildCatalogue();

        const firstTrackAppleMusic = catalogue[0]?.platforms.find(platform => platform.platform === 'apple_music');
        expect(firstTrackAppleMusic).toMatchObject({
            platform: 'apple_music',
            streams: 80,
            saves: 8,
            completionRate: 0.75,
            isSynthetic: true,
            syntheticLabel: 'Estimated from account metrics',
        });
    });
});
