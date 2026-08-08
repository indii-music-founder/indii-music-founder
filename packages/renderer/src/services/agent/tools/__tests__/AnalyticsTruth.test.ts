import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsTools } from '../AnalyticsTools';
import { AnalysisTools } from '../AnalysisTools';
import { syncSpotifyStats } from '@/services/social/SocialPlatformService';

const { authState } = vi.hoisted(() => ({
    authState: { currentUser: { uid: 'user-1' } as { uid: string } | null },
}));

vi.mock('@/services/firebase', () => ({
    auth: authState,
    functions: {},
}));

vi.mock('@/services/social/SocialPlatformService', () => ({
    syncSpotifyStats: vi.fn(),
}));

describe('analytics truth boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authState.currentUser = { uid: 'user-1' };
    });

    it('labels release velocity as a low-confidence illustration even with live followers', async () => {
        vi.mocked(syncSpotifyStats).mockResolvedValue({
            platform: 'spotify',
            followers: 1000,
            fetchedAt: 1_800_000_000_000,
            connected: true,
            authorized: true,
            liveSyncOk: true,
            cacheOnly: false,
        });

        const result = await AnalyticsTools.benchmark_release_velocity({ trackId: 'track-1', artistId: 'artist-1' });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
            trackId: 'track-1',
            followers: 1000,
            personalized: true,
            confidence: 'low',
            source: 'live_spotify_followers',
            estimateMetadata: {
                kind: 'illustrative_estimate',
                providerVerifiedForecast: false,
                liveSyncOk: true,
            },
            velocityCurve: { day1: 120, day7: 450, day30: 1800 },
        });
        expect(result.message).toContain('not a Spotify forecast');
    });

    it('uses an explicitly hypothetical baseline when no authorized metrics exist', async () => {
        vi.mocked(syncSpotifyStats).mockResolvedValue({
            platform: 'spotify',
            fetchedAt: 1_800_000_000_000,
            connected: false,
            authorized: false,
            liveSyncOk: false,
            cacheOnly: false,
            error: 'not_connected',
        });

        const result = await AnalyticsTools.benchmark_release_velocity({});

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
            trackId: null,
            followers: 1500,
            personalized: false,
            source: 'hypothetical_1500_follower_baseline',
        });
        expect(result.data.estimateMetadata.assumptions).toContain('Audience size is a hypothetical 1,500 followers.');
        expect(result.message).toContain('not personalized or provider-verified');
    });

    it('reports cache-only Spotify data without claiming a live sync', async () => {
        vi.mocked(syncSpotifyStats).mockResolvedValue({
            platform: 'spotify',
            followers: 555,
            fetchedAt: 1_700_000_000_000,
            connected: true,
            authorized: true,
            liveSyncOk: false,
            cacheOnly: true,
            error: 'live_sync_failed',
        });

        const result = await AnalysisTools.sync_dsp_stats({ dsp: 'Spotify', artistId: 'artist-1' });

        expect(result.success).toBe(true);
        expect(result.data.source).toBe('cache_only');
        expect(result.message).toContain('live sync failed');
        expect(result.message).toContain('not current');
    });

    it('fails closed for the unbuilt Apple Music analytics integration', async () => {
        const result = await AnalysisTools.sync_dsp_stats({ dsp: 'Apple', artistId: 'artist-1' });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('DSP_INTEGRATION_UNAVAILABLE');
        expect(syncSpotifyStats).not.toHaveBeenCalled();
    });
});
