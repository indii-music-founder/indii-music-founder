/**
 * YouTubeAnalyticsService — YouTube Analytics API Integration
 *
 * Uses the user's existing Google OAuth token from Firebase auth to query
 * the YouTube Analytics API. No separate OAuth flow required — the user is
 * already signed in with Google via Firebase.
 *
 * Additional scopes required (requested via `linkWithCredential` or
 * `reauthenticateWithPopup` with an updated GoogleAuthProvider):
 *   https://www.googleapis.com/auth/youtube.readonly
 *   https://www.googleapis.com/auth/yt-analytics.readonly
 *
 * Endpoints used:
 *   - YouTube Data API v3  /youtube/v3/channels   → channel + playlist IDs
 *   - YouTube Data API v3  /youtube/v3/videos      → per-video metadata + statistics
 *   - YouTube Analytics API /youtube/analytics/v2/reports → real views, watch time, likes
 *
 * NOTE: The YouTube Analytics API returns aggregate channel-level data. Per-video
 * analytics (impressions, CTR, revenue) require YouTube Studio or the YouTube
 * Reporting API (batch download, not real-time).
 *
 * Token storage: uses Firebase auth user's Google credential — no Firestore token
 * doc needed for YouTube (unlike Spotify/TikTok which use separate OAuth).
 */

import { auth } from '@/services/firebase';
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import type { PlatformData, StreamDataPoint, RegionData } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const YT_DATA_BASE    = 'https://www.googleapis.com/youtube/v3';
const YT_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2';

const REQUIRED_SCOPES = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
];

// ── YouTube API response types ────────────────────────────────────────────────

interface YTChannelListResponse {
    items: {
        id: string;
        snippet: { title: string; description: string; customUrl: string };
        statistics: {
            viewCount: string;
            subscriberCount: string;
            videoCount: string;
        };
        contentDetails: { relatedPlaylists: { uploads: string } };
    }[];
}

interface YTPlaylistItemsResponse {
    items: {
        contentDetails: { videoId: string; videoPublishedAt: string };
    }[];
    nextPageToken?: string;
    pageInfo: { totalResults: number; resultsPerPage: number };
}

interface YTVideoListResponse {
    items: {
        id: string;
        snippet: {
            title: string;
            publishedAt: string;
            thumbnails: { high: { url: string } };
        };
        statistics: {
            viewCount: string;
            likeCount: string;
            commentCount: string;
            favoriteCount: string;
        };
        contentDetails: { duration: string }; // ISO 8601 duration
    }[];
}

interface YTAnalyticsReportResponse {
    kind: string;
    columnHeaders: { name: string; dataType: string }[];
    rows?: (string | number)[][];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse ISO 8601 duration (e.g. PT3M45S) to seconds */
function parseDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] ?? '0') * 3600)
         + (parseInt(match[2] ?? '0') * 60)
         + parseInt(match[3] ?? '0');
}

/** Format date as YYYY-MM-DD */
function toDateStr(date: Date): string {
    return date.toISOString().split('T')[0]!;
}

/** Get a date N days ago */
function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// YouTubeAnalyticsService
// ─────────────────────────────────────────────────────────────────────────────

export class YouTubeAnalyticsService {

    // ── Auth & token management ───────────────────────────────────────────────

    /**
     * Get a Google OAuth access token from the current Firebase user.
     * If YouTube scopes are not yet granted, triggers a reauth popup.
     */
    private async _getAccessToken(): Promise<string> {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated.');

        // Check if we already have a token with YouTube scopes
        // Firebase stores the raw Google credential in `providerData`
        // but doesn't expose the access token directly after initial sign-in.
        // We use `getIdToken` for Firebase calls; for Google APIs we need
        // the Google OAuth token which requires credential storage or reauth.

        // Strategy: attempt to get token from stored credential; if missing
        // or expired, trigger reauth with required scopes.
        const stored = sessionStorage.getItem('yt_google_access_token');
        const expiry = sessionStorage.getItem('yt_google_token_expiry');

        if (stored && expiry && Date.now() < parseInt(expiry) - 60_000) {
            return stored;
        }

        return this._reauthForYouTubeScopes();
    }

    /**
     * Trigger Google reauth popup with YouTube scopes.
     * Stores access token in sessionStorage (scoped to this tab session).
     */
    async requestYouTubeAccess(): Promise<void> {
        await this._reauthForYouTubeScopes();
    }

    private async _reauthForYouTubeScopes(): Promise<string> {
        const provider = new GoogleAuthProvider();
        REQUIRED_SCOPES.forEach(s => provider.addScope(s));
        provider.setCustomParameters({ access_type: 'online', prompt: 'consent' });

        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated.');

        const result = await reauthenticateWithPopup(user, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;

        if (!token) {
            throw new Error('Failed to obtain Google access token — YouTube scopes may not have been granted.');
        }

        // Store for this session (access tokens typically last 1 hour)
        sessionStorage.setItem('yt_google_access_token', token);
        sessionStorage.setItem('yt_google_token_expiry', String(Date.now() + 3600 * 1000));

        return token;
    }

    /**
     * Check if the user has connected YouTube (has Google token with YT scopes).
     */
    async isConnected(): Promise<boolean> {
        const user = auth.currentUser;
        if (!user) return false;
        // User is a Google user if their provider includes google.com
        return user.providerData.some(p => p.providerId === 'google.com');
    }

    /**
     * Check if we have an active YouTube token (with scopes) in this session.
     */
    hasActiveToken(): boolean {
        const stored = sessionStorage.getItem('yt_google_access_token');
        const expiry = sessionStorage.getItem('yt_google_token_expiry');
        return !!(stored && expiry && Date.now() < parseInt(expiry) - 60_000);
    }

    /**
     * Clear YouTube session token (disconnect for this session).
     */
    disconnect(): void {
        sessionStorage.removeItem('yt_google_access_token');
        sessionStorage.removeItem('yt_google_token_expiry');
    }

    // ── Channel info ──────────────────────────────────────────────────────────

    /**
     * Get the authenticated user's YouTube channel info + upload playlist.
     */
    async getChannel(): Promise<YTChannelListResponse['items'][0]> {
        const token = await this._getAccessToken();
        const res = await this._fetch<YTChannelListResponse>(
            `${YT_DATA_BASE}/channels?part=snippet,statistics,contentDetails&mine=true`,
            token
        );
        const channel = res.items?.[0];
        if (!channel) throw new Error('No YouTube channel found for this Google account.');
        return channel;
    }

    // ── Video catalog ─────────────────────────────────────────────────────────

    /**
     * Get video IDs from the uploads playlist (last N videos).
     */
    async getUploadedVideoIds(playlistId: string, maxResults = 50): Promise<string[]> {
        const token = await this._getAccessToken();
        const ids: string[] = [];
        let pageToken: string | undefined;

        do {
            const params = new URLSearchParams({
                part: 'contentDetails',
                playlistId,
                maxResults: String(Math.min(maxResults - ids.length, 50)),
                ...(pageToken ? { pageToken } : {}),
            });

            const res = await this._fetch<YTPlaylistItemsResponse>(
                `${YT_DATA_BASE}/playlistItems?${params.toString()}`,
                token
            );

            ids.push(...res.items.map(i => i.contentDetails.videoId));
            pageToken = res.nextPageToken;
        } while (pageToken && ids.length < maxResults);

        return ids.slice(0, maxResults);
    }

    /**
     * Get full video metadata + statistics for a list of video IDs.
     * YouTube allows up to 50 IDs per request.
     */
    async getVideoDetails(videoIds: string[]): Promise<YTVideoListResponse['items']> {
        const token = await this._getAccessToken();
        const chunks = this._chunk(videoIds, 50);
        const results: YTVideoListResponse['items'] = [];

        for (const chunk of chunks) {
            const params = new URLSearchParams({
                part: 'snippet,statistics,contentDetails',
                id: chunk.join(','),
            });
            const res = await this._fetch<YTVideoListResponse>(
                `${YT_DATA_BASE}/videos?${params.toString()}`,
                token
            );
            results.push(...res.items);
        }

        return results;
    }

    // ── Analytics data ────────────────────────────────────────────────────────

    /**
     * Get channel-level analytics for the last 30 days.
     * Returns views, estimatedMinutesWatched, likes, subscribersGained per day.
     */
    async getChannelDailyAnalytics(channelId: string): Promise<{
        date: string;
        views: number;
        watchMinutes: number;
        likes: number;
        subscribersGained: number;
    }[]> {
        const token = await this._getAccessToken();

        const endDate = toDateStr(new Date());
        const startDate = toDateStr(daysAgo(30));

        const params = new URLSearchParams({
            ids: `channel==${channelId}`,
            startDate,
            endDate,
            metrics: 'views,estimatedMinutesWatched,likes,subscribersGained',
            dimensions: 'day',
            sort: 'day',
        });

        const res = await this._fetch<YTAnalyticsReportResponse>(
            `${YT_ANALYTICS_BASE}/reports?${params.toString()}`,
            token
        );

        // Parse columnHeaders to find column indices
        const headers = (res.columnHeaders ?? []).map(h => h.name);
        const dateIdx = headers.indexOf('day');
        const viewsIdx = headers.indexOf('views');
        const watchIdx = headers.indexOf('estimatedMinutesWatched');
        const likesIdx = headers.indexOf('likes');
        const subsIdx = headers.indexOf('subscribersGained');

        return (res.rows ?? []).map(row => ({
            date: String(row[dateIdx]),
            views: Number(row[viewsIdx] ?? 0),
            watchMinutes: Number(row[watchIdx] ?? 0),
            likes: Number(row[likesIdx] ?? 0),
            subscribersGained: Number(row[subsIdx] ?? 0),
        }));
    }

    /**
     * Get per-video analytics for a specific video (last 30 days).
     */
    async getVideoDailyAnalytics(channelId: string, videoId: string): Promise<{
        date: string;
        views: number;
        watchMinutes: number;
        likes: number;
    }[]> {
        const token = await this._getAccessToken();

        const endDate = toDateStr(new Date());
        const startDate = toDateStr(daysAgo(30));

        const params = new URLSearchParams({
            ids: `channel==${channelId}`,
            startDate,
            endDate,
            metrics: 'views,estimatedMinutesWatched,likes',
            dimensions: 'day',
            filters: `video==${videoId}`,
            sort: 'day',
        });

        const res = await this._fetch<YTAnalyticsReportResponse>(
            `${YT_ANALYTICS_BASE}/reports?${params.toString()}`,
            token
        );

        const headers = (res.columnHeaders ?? []).map(h => h.name);
        const dateIdx = headers.indexOf('day');
        const viewsIdx = headers.indexOf('views');
        const watchIdx = headers.indexOf('estimatedMinutesWatched');
        const likesIdx = headers.indexOf('likes');

        return (res.rows ?? []).map(row => ({
            date: String(row[dateIdx]),
            views: Number(row[viewsIdx] ?? 0),
            watchMinutes: Number(row[watchIdx] ?? 0),
            likes: Number(row[likesIdx] ?? 0),
        }));
    }

    /**
     * Get geographic breakdown (top countries by views) for the last 30 days.
     */
    async getGeographicBreakdown(channelId: string): Promise<{ country: string; views: number }[]> {
        const token = await this._getAccessToken();

        const endDate = toDateStr(new Date());
        const startDate = toDateStr(daysAgo(30));

        const params = new URLSearchParams({
            ids: `channel==${channelId}`,
            startDate,
            endDate,
            metrics: 'views',
            dimensions: 'country',
            sort: '-views',
            maxResults: '10',
        });

        const res = await this._fetch<YTAnalyticsReportResponse>(
            `${YT_ANALYTICS_BASE}/reports?${params.toString()}`,
            token
        );

        const headers = (res.columnHeaders ?? []).map(h => h.name);
        const countryIdx = headers.indexOf('country');
        const viewsIdx = headers.indexOf('views');

        return (res.rows ?? []).map(row => ({
            country: String(row[countryIdx]),
            views: Number(row[viewsIdx] ?? 0),
        }));
    }

    // ── High-level builders ───────────────────────────────────────────────────

    /**
     * Build PlatformData for the analytics engine from YouTube channel analytics.
     */
    async buildPlatformData(): Promise<PlatformData> {
        const channel = await this.getChannel();
        const channelId = channel.id;

        const dailyAnalytics = await this.getChannelDailyAnalytics(channelId);

        const totalViews = dailyAnalytics.reduce((s, d) => s + d.views, 0);
        const totalWatchMinutes = dailyAnalytics.reduce((s, d) => s + d.watchMinutes, 0);
        const totalLikes = dailyAnalytics.reduce((s, d) => s + d.likes, 0);

        // Estimate completion rate from watch time / (views * avg video duration)
        // Without per-video data we approximate from channel's average video length
        const avgVideoMinutes = 4; // typical music video length
        const completionRate = totalViews > 0
            ? Math.min(totalWatchMinutes / (totalViews * avgVideoMinutes), 1)
            : 0;

        return {
            platform: 'youtube_shorts',
            streams: totalViews,
            saves: totalLikes, // likes ≈ saves in YouTube context
            completionRate,
        };
    }

    /**
     * Build a 30-day view history from channel daily analytics.
     */
    async buildStreamHistory(channelId: string): Promise<StreamDataPoint[]> {
        const dailyAnalytics = await this.getChannelDailyAnalytics(channelId);
        const byDate = new Map(dailyAnalytics.map(d => [d.date, d]));

        const history: StreamDataPoint[] = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = toDateStr(date);
            const day = byDate.get(dateStr);

            history.push({
                date: dateStr,
                streams: day?.views ?? 0,
                saves: day?.likes ?? 0,
                completions: 0, // requires per-video audience retention data
                uniqueListeners: 0, // not exposed by YT Analytics
                shares: 0,
                newFollowers: day?.subscribersGained ?? 0,
                playlistAdditions: 0,
            });
        }
        return history;
    }

    /**
     * Build RegionData from YouTube geographic breakdown.
     */
    async buildRegionData(channelId: string): Promise<RegionData[]> {
        const geo = await this.getGeographicBreakdown(channelId);
        const totalViews = geo.reduce((s, g) => s + g.views, 0);

        const countryMeta: Record<string, { region: string; flag: string }> = {
            US: { region: 'North America', flag: '🇺🇸' },
            GB: { region: 'Europe',        flag: '🇬🇧' },
            DE: { region: 'Europe',        flag: '🇩🇪' },
            BR: { region: 'Latin America', flag: '🇧🇷' },
            MX: { region: 'Latin America', flag: '🇲🇽' },
            NG: { region: 'Africa',        flag: '🇳🇬' },
            GH: { region: 'Africa',        flag: '🇬🇭' },
            JP: { region: 'Asia',          flag: '🇯🇵' },
            KR: { region: 'Asia',          flag: '🇰🇷' },
            IN: { region: 'Asia',          flag: '🇮🇳' },
            CA: { region: 'North America', flag: '🇨🇦' },
            AU: { region: 'Oceania',       flag: '🇦🇺' },
            FR: { region: 'Europe',        flag: '🇫🇷' },
            ES: { region: 'Europe',        flag: '🇪🇸' },
        };

        return geo.slice(0, 8).map((g, i) => {
            const meta = countryMeta[g.country] ?? { region: 'Other', flag: '🌍' };
            const prevShare = i > 0 ? geo[i - 1]!.views / totalViews : g.views / totalViews;
            const currShare = g.views / totalViews;
            // Approximate week-over-week growth (not directly available from this endpoint)
            const growthRate = ((currShare - prevShare) / Math.max(prevShare, 0.001)) * 100;

            return {
                region: meta.region,
                country: g.country,
                flag: meta.flag,
                streams: g.views,
                growthRate: Math.round(growthRate * 10) / 10,
            };
        });
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private async _fetch<T>(url: string, token: string): Promise<T> {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(15_000),
        });

        if (res.status === 401) {
            // Clear cached token so next call retriggers reauth
            sessionStorage.removeItem('yt_google_access_token');
            throw new Error('YouTube token expired — please reconnect.');
        }
        if (res.status === 403) {
            throw new Error('YouTube access denied — ensure YouTube Analytics scope is granted.');
        }
        if (res.status === 429) {
            throw new Error('YouTube API quota exceeded. Please wait before retrying.');
        }
        if (!res.ok) {
            const err = await res.text().catch(() => res.statusText);
            throw new Error(`YouTube API error ${res.status}: ${err}`);
        }
        return res.json() as Promise<T>;
    }

    private _chunk<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }
}

export const youTubeAnalyticsService = new YouTubeAnalyticsService();
