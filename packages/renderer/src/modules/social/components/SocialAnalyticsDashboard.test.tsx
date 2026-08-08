import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SocialAnalyticsDashboard from './SocialAnalyticsDashboard';
import {
    syncInstagramStats,
    syncSpotifyStats,
    syncTikTokStats,
    syncTwitterStats,
    syncYouTubeStats,
} from '@/services/social/SocialPlatformService';

const { getState } = vi.hoisted(() => ({
    getState: vi.fn(() => ({
        userProfile: { id: 'user-1', spotifyArtistId: 'artist-1' },
    })),
}));

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        vi.fn((selector: (state: ReturnType<typeof getState>) => unknown) => selector(getState())),
        { getState },
    ),
}));

vi.mock('@/services/social/SocialPlatformService', () => ({
    syncSpotifyStats: vi.fn(),
    syncInstagramStats: vi.fn(),
    syncTikTokStats: vi.fn(),
    syncTwitterStats: vi.fn(),
    syncYouTubeStats: vi.fn(),
}));

describe('SocialAnalyticsDashboard connection truth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(syncSpotifyStats).mockResolvedValue({
            platform: 'spotify',
            fetchedAt: Date.now(),
            connected: false,
            authorized: false,
            liveSyncOk: false,
            cacheOnly: false,
            error: 'not_connected',
        });
        vi.mocked(syncInstagramStats).mockResolvedValue({
            platform: 'instagram',
            followers: 80,
            fetchedAt: Date.now() - 60_000,
            connected: true,
            authorized: true,
            liveSyncOk: false,
            cacheOnly: true,
            error: 'live_sync_failed',
        });
        vi.mocked(syncTikTokStats).mockResolvedValue({
            platform: 'tiktok',
            followers: 120,
            fetchedAt: Date.now(),
            connected: true,
            authorized: true,
            liveSyncOk: true,
            cacheOnly: false,
        });
        vi.mocked(syncTwitterStats).mockResolvedValue({
            platform: 'twitter', fetchedAt: Date.now(), connected: false,
            authorized: false, liveSyncOk: false, cacheOnly: false, error: 'not_connected',
        });
        vi.mocked(syncYouTubeStats).mockResolvedValue({
            platform: 'youtube', fetchedAt: Date.now(), connected: false,
            authorized: false, liveSyncOk: false, cacheOnly: false, error: 'not_connected',
        });
    });

    it('separates live, cached, and disconnected states instead of inferring from metrics', async () => {
        render(<SocialAnalyticsDashboard />);

        await waitFor(() => expect(syncYouTubeStats).toHaveBeenCalled());

        expect(screen.getByText('Live Sync')).toBeInTheDocument();
        expect(screen.getByText('Connected · Cached')).toBeInTheDocument();
        expect(screen.getByText('Live sync failed — showing cached metrics')).toBeInTheDocument();
        expect(screen.getAllByText('Not Connected')).toHaveLength(3);
        expect(screen.getByText('2 / 5')).toBeInTheDocument();
    });
});
