/**
 * PlatformDataService — Aggregates real analytics from all connected platforms.
 *
 * Combines the owner's canonical release catalogue with the authorization state
 * of connected analytics providers.
 *
 * indii Growth Protocol v2.0: Also provides Spotify popularity score fetching
 * for algorithmic milestone tracking.
 *
 * Data aggregation strategy:
 * - Track identity: the owner-scoped proprietary release collection is authoritative.
 * - Track activity: unsupported artist-track metrics remain unavailable. The
 *   service never allocates account or channel totals by popularity.
 * - History and geography: left unavailable until a provider supplies genuine
 *   track-level audience data. Account listening and channel geography are not
 *   silently relabeled as artist-track analytics.
 *
 * Connection state: each platform is optional. The engine works with whatever
 * subset of platforms the user has connected.
 */

import { spotifyService } from './SpotifyService';
import { youTubeAnalyticsService } from './YouTubeAnalyticsService';
import { tikTokAnalyticsService } from './TikTokAnalyticsService';
import { instagramAnalyticsService } from './InstagramAnalyticsService';
import { appleMusicService } from './AppleMusicService';
import { logger } from '@/utils/logger';
import {
    getReleaseArtist,
    getReleaseCoverUrl,
    getReleaseDate,
    getReleaseGenre,
    getReleaseTitle,
    releaseCatalogService,
} from '@/services/distribution/ReleaseCatalogService';
import type {
    TrackAnalytics,
    PlatformData,
    PopularityScores,
} from './types';

// ── Connection status ─────────────────────────────────────────────────────────

export interface PlatformConnectionStatus {
    spotify: boolean;
    youtube: boolean;
    tiktok: boolean;
    apple_music: boolean;
    instagram: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PlatformDataService
// ─────────────────────────────────────────────────────────────────────────────

export class PlatformDataService {

    /**
     * Check which platforms the user has connected.
     */
    async getConnectionStatus(): Promise<PlatformConnectionStatus> {
        const [spotify, youtube, tiktok, instagram, apple] = await Promise.allSettled([
            spotifyService.isConnected(),
            youTubeAnalyticsService.isConnected(),
            tikTokAnalyticsService.isConnected(),
            instagramAnalyticsService.isConnected(),
            appleMusicService.isConnected(),
        ]);

        return {
            spotify: spotify.status === 'fulfilled' && spotify.value,
            youtube: youtube.status === 'fulfilled' && youtube.value,
            tiktok: tiktok.status === 'fulfilled' && tiktok.value,
            apple_music: apple.status === 'fulfilled' && apple.value,
            instagram: instagram.status === 'fulfilled' && instagram.value,
        };
    }

    /**
     * Returns true if at least one platform is connected.
     */
    async hasAnyConnection(): Promise<boolean> {
        const status = await this.getConnectionStatus();
        return status.spotify || status.youtube || status.tiktok || status.instagram || status.apple_music;
    }

    /**
     * Build a full TrackAnalytics catalogue from all connected platforms.
     *
     * Returns an empty array if no platforms are connected.
     */
    async buildCatalogue(): Promise<TrackAnalytics[]> {
        const status = await this.getConnectionStatus();

        if (!Object.values(status).some(Boolean)) {
            return [];
        }

        return this._buildOwnedReleaseCatalogue(status);
    }

    // ── Owner-scoped release catalogue ────────────────────────────────────────

    private async _buildOwnedReleaseCatalogue(status: PlatformConnectionStatus): Promise<TrackAnalytics[]> {
        const releases = await releaseCatalogService.listCurrentUserReleases(250);
        const unavailablePlatform = (platform: PlatformData['platform'], sourceLabel: string): PlatformData => ({
            platform,
            streams: 0,
            saves: 0,
            completionRate: 0,
            metricsUnavailable: true,
            savesUnavailable: true,
            completionUnavailable: true,
            sourceLabel,
        });

        return releases.flatMap(release => {
            const title = getReleaseTitle(release.data);
            const artist = getReleaseArtist(release.data);
            if (!title || !artist) {
                logger.warn(`[PlatformDataService] Release ${release.id} lacks a title or artist and cannot be shown in track analytics.`);
                return [];
            }

            const platforms: PlatformData[] = [];
            if (status.spotify) {
                platforms.push(unavailablePlatform('spotify', 'Spotify is authorized, but the Web API does not provide artist-track performance metrics.'));
            }
            if (status.youtube) {
                platforms.push(unavailablePlatform('youtube', 'YouTube channel totals cannot be attributed to this release without a provider track/video match.'));
            }
            if (status.tiktok) {
                platforms.push(unavailablePlatform('tiktok', 'TikTok account video totals cannot be attributed to this release or its audio.'));
            }
            if (status.instagram) {
                platforms.push(unavailablePlatform('instagram_reels', 'Instagram account Reel totals cannot be attributed to this release or its audio.'));
            }
            if (status.apple_music) {
                platforms.push(unavailablePlatform('apple_music', 'Apple Music artist-level partner data cannot be allocated across releases without a provider track identifier.'));
            }

            return [{
                trackId: release.id,
                trackName: title,
                artistName: artist,
                coverUrl: getReleaseCoverUrl(release.data),
                releaseDate: getReleaseDate(release.data)?.toISOString().slice(0, 10) ?? '',
                genre: getReleaseGenre(release.data) ?? 'Music',
                totalStreams: 0,
                platforms,
                history: [],
                creatorCount: 0,
                regions: [],
            }];
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // ── indii Growth Protocol: Popularity Score Fetching ────────────────────

    /**
     * Cache of previous popularity scores for delta calculation.
     * Key: trackId, Value: last known scores
     */
    private _popularityCache = new Map<string, { track: number; artist: number }>();

    /**
     * Fetch the Spotify Popularity Score for a track and its artist.
     *
     * indii Growth Protocol v2.0: Popularity scores are the primary signal
     * for algorithmic milestone tracking. This method:
     *   1. Fetches current track & artist popularity via SpotifyService
     *   2. Compares against cached previous values for delta calculation
     *   3. Returns a PopularityScores object for GrowthPatternService alerts
     *
     * @param trackId - Spotify track ID
     * @returns PopularityScores or null if Spotify is not connected
     */
    async fetchPopularityScores(trackId: string): Promise<PopularityScores | null> {
        const status = await this.getConnectionStatus();
        if (!status.spotify) {
            logger.warn('[PlatformDataService] Cannot fetch popularity scores: Spotify not connected.');
            return null;
        }

        try {
            const trackData = await spotifyService.getTrack(trackId);
            if (!trackData) {
                logger.warn(`[PlatformDataService] Track ${trackId} not found on Spotify.`);
                return null;
            }

            const artistId = trackData.artists?.[0]?.id;
            let artistPopularity = 0;

            if (artistId) {
                try {
                    const artistData = await spotifyService.getArtist(artistId);
                    artistPopularity = artistData?.popularity ?? 0;
                } catch (err: unknown) {
                    logger.warn(`[PlatformDataService] Artist popularity fetch failed:`, err);
                }
            }

            // Retrieve previous scores from cache
            const cached = this._popularityCache.get(trackId);

            const scores: PopularityScores = {
                trackPopularity: trackData.popularity ?? 0,
                artistPopularity,
                fetchedAt: new Date().toISOString(),
                previousTrackPopularity: cached?.track,
                previousArtistPopularity: cached?.artist,
            };

            // Update cache with current scores
            this._popularityCache.set(trackId, {
                track: scores.trackPopularity,
                artist: scores.artistPopularity,
            });

            return scores;
        } catch (err: unknown) {
            logger.error('[PlatformDataService] Popularity score fetch failed:', err);
            return null;
        }
    }
}

export const platformDataService = new PlatformDataService();
