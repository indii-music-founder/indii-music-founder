/**
 * PlatformDataService — Aggregates real analytics from all connected platforms.
 *
 * Orchestrates SpotifyService, YouTubeAnalyticsService, and TikTokAnalyticsService
 * into a unified TrackAnalytics[] catalogue for the Growth Intelligence Engine.
 *
 * Data aggregation strategy:
 * - Track identity:  Spotify is used as the master track catalog (most complete metadata).
 *   YouTube and TikTok data is then aggregated at the channel/account level and
 *   distributed across tracks proportionally to popularity.
 * - Stream counts:   Per-platform actual values where available; estimated otherwise.
 * - History:         Spotify recently-played provides per-track history; YouTube/TikTok
 *                    provide channel-level history which is prorated.
 * - Region data:     Sourced from YouTube Analytics geographic breakdown (most complete).
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
import type {
    TrackAnalytics,
    PlatformData,
    StreamDataPoint,
    RegionData,
} from './types';

// ── Connection status ─────────────────────────────────────────────────────────

export interface PlatformConnectionStatus {
    spotify: boolean;
    youtube: boolean;
    tiktok: boolean;
    apple_music: boolean;   // placeholder — MusicKit OAuth TBD
    instagram: boolean;     // placeholder — Meta API TBD
}

// ── Internal merge helper ─────────────────────────────────────────────────────

/** Zero-fill a 30-day history array with empty StreamDataPoints */
function emptyHistory(): StreamDataPoint[] {
    const result: StreamDataPoint[] = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        result.push({
            date: d.toISOString().split('T')[0]!,
            streams: 0,
            saves: 0,
            completions: 0,
            uniqueListeners: 0,
            shares: 0,
            newFollowers: 0,
            playlistAdditions: 0,
        });
    }
    return result;
}

/** Merge two StreamDataPoint[] arrays by summing fields on matching dates */
function mergeHistories(a: StreamDataPoint[], b: StreamDataPoint[]): StreamDataPoint[] {
    const map = new Map<string, StreamDataPoint>();
    for (const point of a) {
        map.set(point.date, { ...point });
    }
    for (const point of b) {
        const existing = map.get(point.date);
        if (existing) {
            map.set(point.date, {
                date: point.date,
                streams:          existing.streams         + point.streams,
                saves:            existing.saves           + point.saves,
                completions:      existing.completions     + point.completions,
                uniqueListeners:  existing.uniqueListeners + point.uniqueListeners,
                shares:           existing.shares          + point.shares,
                newFollowers:     existing.newFollowers    + point.newFollowers,
                playlistAdditions:existing.playlistAdditions + point.playlistAdditions,
            });
        } else {
            map.set(point.date, { ...point });
        }
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
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
            spotify:     spotify.status    === 'fulfilled' && spotify.value,
            youtube:     youtube.status    === 'fulfilled' && youtube.value,
            tiktok:      tiktok.status     === 'fulfilled' && tiktok.value,
            apple_music: apple.status      === 'fulfilled' && apple.value,
            instagram:   instagram.status  === 'fulfilled' && instagram.value,
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

        if (!status.spotify && !status.youtube && !status.tiktok) {
            return [];
        }

        // Spotify is the primary track source
        if (status.spotify) {
            return this._buildSpotifyLedCatalogue(status);
        }

        // YouTube-only fallback: create a single synthetic "channel" track
        if (status.youtube) {
            return this._buildYouTubeOnlyCatalogue(status);
        }

        // TikTok-only fallback: create a single synthetic "account" track
        if (status.tiktok) {
            return this._buildTikTokOnlyCatalogue();
        }

        return [];
    }

    // ── Spotify-led catalogue ─────────────────────────────────────────────────

    private async _buildSpotifyLedCatalogue(
        status: PlatformConnectionStatus
    ): Promise<TrackAnalytics[]> {
        // Fetch Spotify data (required)
        const { platform: spotifyPlatform, tracks: spotifyTracks } =
            await spotifyService.buildPlatformData();

        // Fetch supplementary platform data (optional, non-blocking)
        const [ytResult, ttResult, igResult, amResult] = await Promise.allSettled([
            status.youtube    ? youTubeAnalyticsService.buildPlatformData()   : Promise.resolve(null),
            status.tiktok     ? tikTokAnalyticsService.buildPlatformData()    : Promise.resolve(null),
            status.instagram  ? instagramAnalyticsService.buildPlatformData() : Promise.resolve(null),
            status.apple_music ? appleMusicService.buildPlatformData()        : Promise.resolve(null),
        ]);

        const ytPlatform  = ytResult.status  === 'fulfilled' ? ytResult.value  : null;
        const ttPlatform  = ttResult.status  === 'fulfilled' ? ttResult.value  : null;
        const igPlatform  = igResult.status  === 'fulfilled' ? igResult.value  : null;
        const amPlatform  = amResult.status  === 'fulfilled' ? amResult.value  : null;

        // Fetch YouTube region data if available
        let regionData: RegionData[] = [];
        if (status.youtube) {
            try {
                const channel = await youTubeAnalyticsService.getChannel();
                regionData = await youTubeAnalyticsService.buildRegionData(channel.id);
            } catch (err) {
                logger.warn('[PlatformDataService] YouTube region data unavailable:', err);
            }
        }

        // Build one TrackAnalytics per Spotify track (top 10 by popularity)
        const topTracks = spotifyTracks
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 10);

        const catalogue: TrackAnalytics[] = await Promise.all(
            topTracks.map(async (track, index) => {
                // Per-track Spotify stream history
                let spotifyHistory: StreamDataPoint[] = emptyHistory();
                try {
                    spotifyHistory = await spotifyService.buildStreamHistory(track.id);
                } catch (err) {
                    logger.warn(`[PlatformDataService] Stream history unavailable for ${track.name}:`, err);
                }

                // Platform breakdown for this track
                const platforms: PlatformData[] = [spotifyPlatform];

                // Prorate YouTube/TikTok streams proportionally to Spotify popularity rank
                // (tracks with higher popularity get a larger share of cross-platform streams)
                const totalPopularity = topTracks.reduce((s, t) => s + t.popularity, 0);
                const shareRatio = totalPopularity > 0
                    ? track.popularity / totalPopularity
                    : 1 / topTracks.length;

                if (ytPlatform) {
                    platforms.push({
                        platform: 'youtube_shorts',
                        streams:        Math.round(ytPlatform.streams        * shareRatio),
                        saves:          Math.round(ytPlatform.saves          * shareRatio),
                        completionRate: ytPlatform.completionRate,
                    });
                }

                if (ttPlatform) {
                    platforms.push({
                        platform: 'tiktok',
                        streams:       Math.round(ttPlatform.streams       * shareRatio),
                        saves:         Math.round(ttPlatform.saves         * shareRatio),
                        completionRate: ttPlatform.completionRate,
                        creatorCount:  Math.round((ttPlatform.creatorCount ?? 0) * shareRatio),
                    });
                }

                if (igPlatform) {
                    platforms.push({
                        platform: 'instagram_reels',
                        streams:       Math.round(igPlatform.streams       * shareRatio),
                        saves:         Math.round(igPlatform.saves         * shareRatio),
                        completionRate: igPlatform.completionRate,
                        creatorCount:  0,
                    });
                }

                if (amPlatform) {
                    platforms.push({
                        platform: 'apple_music',
                        streams:       Math.round(amPlatform.streams       * shareRatio),
                        saves:         Math.round(amPlatform.saves         * shareRatio),
                        completionRate: amPlatform.completionRate,
                    });
                }

                const totalStreams = platforms.reduce((s, p) => s + p.streams, 0);
                const creatorCount = platforms.reduce((s, p) => s + (p.creatorCount ?? 0), 0);

                return {
                    trackId:      track.id,
                    trackName:    track.name,
                    artistName:   track.artist,
                    coverUrl:     track.albumArt,
                    releaseDate:  track.releaseDate,
                    genre:        'Music',   // Spotify track metadata doesn't include genre at track level
                    totalStreams,
                    platforms,
                    history:      spotifyHistory,
                    creatorCount,
                    regions:      index === 0 ? regionData : this._proRateRegions(regionData, shareRatio),
                };
            })
        );

        return catalogue;
    }

    // ── YouTube-only fallback ─────────────────────────────────────────────────

    private async _buildYouTubeOnlyCatalogue(
        status: PlatformConnectionStatus
    ): Promise<TrackAnalytics[]> {
        const channel = await youTubeAnalyticsService.getChannel();

        const [ytPlatform, ytHistory, ytRegions, ttPlatform] = await Promise.allSettled([
            youTubeAnalyticsService.buildPlatformData(),
            youTubeAnalyticsService.buildStreamHistory(channel.id),
            youTubeAnalyticsService.buildRegionData(channel.id),
            status.tiktok ? tikTokAnalyticsService.buildPlatformData() : Promise.resolve(null),
        ]);

        const platforms: PlatformData[] = [];
        if (ytPlatform.status === 'fulfilled') platforms.push(ytPlatform.value);
        if (ttPlatform.status === 'fulfilled' && ttPlatform.value) platforms.push(ttPlatform.value);

        const history = ytHistory.status === 'fulfilled'
            ? ytHistory.value
            : emptyHistory();

        const regions = ytRegions.status === 'fulfilled' ? ytRegions.value : [];

        return [{
            trackId:      `yt-channel-${channel.id}`,
            trackName:    channel.snippet.title,
            artistName:   channel.snippet.title,
            coverUrl:     undefined,
            releaseDate:  new Date().toISOString().split('T')[0]!,
            genre:        'Music',
            totalStreams: platforms.reduce((s, p) => s + p.streams, 0),
            platforms,
            history,
            creatorCount: 0,
            regions,
        }];
    }

    // ── TikTok-only fallback ──────────────────────────────────────────────────

    private async _buildTikTokOnlyCatalogue(): Promise<TrackAnalytics[]> {
        const [userInfo, ttPlatform, ttHistory] = await Promise.allSettled([
            tikTokAnalyticsService.getUserInfo(),
            tikTokAnalyticsService.buildPlatformData(),
            tikTokAnalyticsService.buildStreamHistory(),
        ]);

        const displayName = userInfo.status === 'fulfilled'
            ? userInfo.value.display_name
            : 'TikTok Account';

        const platforms: PlatformData[] = [];
        if (ttPlatform.status === 'fulfilled') platforms.push(ttPlatform.value);

        const history = ttHistory.status === 'fulfilled'
            ? ttHistory.value
            : emptyHistory();

        return [{
            trackId:      'tt-account',
            trackName:    displayName,
            artistName:   displayName,
            coverUrl:     undefined,
            releaseDate:  new Date().toISOString().split('T')[0]!,
            genre:        'Music',
            totalStreams: platforms.reduce((s, p) => s + p.streams, 0),
            platforms,
            history,
            creatorCount: 0,
            regions:      [],
        }];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _proRateRegions(regions: RegionData[], ratio: number): RegionData[] {
        return regions.map(r => ({
            ...r,
            streams: Math.round(r.streams * ratio),
        }));
    }
}

export const platformDataService = new PlatformDataService();
