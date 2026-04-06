/**
 * InstagramAnalyticsService — Instagram Graph API Integration
 *
 * Uses the Instagram Graph API (requires Professional/Creator/Business account
 * linked to a Facebook Page) to pull Reels insights and account-level analytics.
 *
 * OAuth Flow:
 *   1. User grants permission via Facebook Login (OAuth 2.0)
 *   2. Server-side token exchange handled by `analyticsExchangeToken` Cloud Function
 *      (platform: 'instagram') — stores token to users/{uid}/analyticsTokens/instagram
 *
 * Scopes required (Meta app permissions):
 *   instagram_basic         — Account info, media list
 *   instagram_manage_insights — Media + account insights (engagement, reach, impressions)
 *   pages_show_list         — Enumerate linked Facebook Pages
 *   pages_read_engagement   — Page engagement data
 *
 * API references:
 *   - https://developers.facebook.com/docs/instagram-platform/
 *   - https://developers.facebook.com/docs/instagram-platform/insights/
 *
 * NOTE: Instagram Reels insights (plays, reach, impressions) are available via the
 * Media Insights endpoint. Sound/audio usage across other creators' Reels requires
 * the Reels Audio API (restricted beta access only).
 *
 * Firestore token path: users/{uid}/analyticsTokens/instagram
 */

import { db, functions as firebaseFunctions } from '@/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth } from '@/services/firebase';
import type { PlatformData, StreamDataPoint } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.instagram.com';
const TOKEN_COLLECTION = (uid: string) =>
    doc(db, 'users', uid, 'analyticsTokens', 'instagram');

// ── Meta/Instagram API response types ─────────────────────────────────────────

interface IGStoredToken {
    accessToken: string;
    expiresAt: number;
    igUserId: string;
}

interface IGUserResponse {
    id: string;
    username: string;
    name: string;
    biography?: string;
    followers_count: number;
    follows_count: number;
    media_count: number;
    profile_picture_url?: string;
    website?: string;
}

interface IGMediaListResponse {
    data: IGMedia[];
    paging?: { cursors: { before: string; after: string }; next?: string };
}

interface IGMedia {
    id: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';
    media_product_type?: 'FEED' | 'REELS' | 'STORY';
    caption?: string;
    timestamp: string;   // ISO 8601
    permalink: string;
    thumbnail_url?: string;
    media_url?: string;
    like_count?: number;
    comments_count?: number;
}

interface IGMediaInsights {
    data: {
        name: string;
        period: string;
        values?: { value: number; end_time: string }[];
        value?: number;
        title: string;
        description: string;
        id: string;
    }[];
}

interface IGAccountInsightsResponse {
    data: {
        name: string;
        period: string;
        values: { value: number; end_time: string }[];
        title: string;
        description: string;
        id: string;
    }[];
    paging?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// InstagramAnalyticsService
// ─────────────────────────────────────────────────────────────────────────────

export class InstagramAnalyticsService {
    private redirectUri = `${window.location.origin}/auth/instagram/callback`;

    // ── OAuth / Connection ────────────────────────────────────────────────────

    /**
     * Initiate Instagram OAuth via Facebook Login.
     * Redirects user to Facebook's OAuth dialog.
     */
    async initiateOAuth(): Promise<void> {
        const appId = import.meta.env.VITE_META_APP_ID;
        if (!appId) {
            throw new Error('VITE_META_APP_ID is not configured. Add it to your .env file.');
        }

        const state = crypto.randomUUID();
        sessionStorage.setItem('instagram_oauth_state', state);

        const scopes = [
            'instagram_basic',
            'instagram_manage_insights',
            'pages_show_list',
            'pages_read_engagement',
        ].join(',');

        const params = new URLSearchParams({
            client_id:     appId,
            redirect_uri:  this.redirectUri,
            scope:         scopes,
            response_type: 'code',
            state,
        });

        window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
    }

    /**
     * Handle the OAuth callback.
     * The code is exchanged for a token via the `analyticsExchangeToken` Cloud Function.
     */
    async handleCallback(code: string, state: string): Promise<void> {
        const storedState = sessionStorage.getItem('instagram_oauth_state');
        if (state !== storedState) {
            throw new Error('OAuth state mismatch — possible CSRF attack.');
        }

        const exchangeFn = httpsCallable<unknown, { ok: boolean }>(
            firebaseFunctions, 'analyticsExchangeToken'
        );

        await exchangeFn({
            platform:    'instagram',
            code,
            redirectUri: this.redirectUri,
        });

        sessionStorage.removeItem('instagram_oauth_state');
    }

    /**
     * Disconnect Instagram — revokes token and removes from Firestore.
     */
    async disconnect(): Promise<void> {
        const revokeFn = httpsCallable(firebaseFunctions, 'analyticsRevokeToken');
        await revokeFn({ platform: 'instagram' });
    }

    /**
     * Check if Instagram is connected and token is valid.
     */
    async isConnected(): Promise<boolean> {
        const uid = auth.currentUser?.uid;
        if (!uid) return false;
        try {
            const snap = await getDoc(TOKEN_COLLECTION(uid));
            if (!snap.exists()) return false;
            const token = snap.data() as IGStoredToken;
            return !!token.accessToken && token.expiresAt > Date.now();
        } catch {
            return false;
        }
    }

    // ── Data fetching ─────────────────────────────────────────────────────────

    /**
     * Get Instagram Business/Creator account info.
     */
    async getUserProfile(): Promise<IGUserResponse> {
        const { token, igUserId } = await this._getValidToken();
        return this._fetch<IGUserResponse>(
            `${GRAPH_BASE}/${igUserId}?fields=id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website`,
            token
        );
    }

    /**
     * Get recent Reels and video posts with basic stats.
     */
    async getReels(limit = 20): Promise<IGMedia[]> {
        const { token, igUserId } = await this._getValidToken();
        const fields = 'id,media_type,media_product_type,caption,timestamp,permalink,thumbnail_url,like_count,comments_count';

        const res = await this._fetch<IGMediaListResponse>(
            `${GRAPH_BASE}/${igUserId}/media?fields=${fields}&limit=${limit}`,
            token
        );

        // Filter to only Reels and video content
        return (res.data ?? []).filter(m =>
            m.media_type === 'VIDEO' || m.media_product_type === 'REELS'
        );
    }

    /**
     * Get insights for a specific Reel: plays, reach, impressions, likes, comments.
     */
    async getReelInsights(mediaId: string): Promise<{
        plays: number;
        reach: number;
        impressions: number;
        likes: number;
        comments: number;
        shares: number;
        saved: number;
    }> {
        const { token } = await this._getValidToken();

        // Reels-specific metrics
        const metrics = [
            'plays', 'reach', 'impressions', 'likes', 'comments', 'shares', 'saved',
        ].join(',');

        const res = await this._fetch<IGMediaInsights>(
            `${GRAPH_BASE}/${mediaId}/insights?metric=${metrics}&period=lifetime`,
            token
        );

        const getValue = (name: string): number => {
            const item = res.data?.find(d => d.name === name);
            return Number(item?.value ?? 0);
        };

        return {
            plays:       getValue('plays'),
            reach:       getValue('reach'),
            impressions: getValue('impressions'),
            likes:       getValue('likes'),
            comments:    getValue('comments'),
            shares:      getValue('shares'),
            saved:       getValue('saved'),
        };
    }

    /**
     * Get account-level daily insights for the last 30 days.
     * Metrics: impressions, reach, profile_views, follower_count.
     */
    async getAccountDailyInsights(igUserId: string): Promise<{
        date: string;
        impressions: number;
        reach: number;
        profileViews: number;
    }[]> {
        const { token } = await this._getValidToken();

        const since = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
        const until = Math.floor(Date.now() / 1000);

        const metrics = 'impressions,reach,profile_views';
        const res = await this._fetch<IGAccountInsightsResponse>(
            `${GRAPH_BASE}/${igUserId}/insights?metric=${metrics}&period=day&since=${since}&until=${until}`,
            token
        );

        // Pivot: the API returns one series per metric
        const byDate = new Map<string, { impressions: number; reach: number; profileViews: number }>();

        for (const series of (res.data ?? [])) {
            for (const point of (series.values ?? [])) {
                const dateStr = point.end_time.split('T')[0]!;
                const existing = byDate.get(dateStr) ?? { impressions: 0, reach: 0, profileViews: 0 };

                if (series.name === 'impressions')   existing.impressions  = point.value;
                if (series.name === 'reach')         existing.reach        = point.value;
                if (series.name === 'profile_views') existing.profileViews = point.value;

                byDate.set(dateStr!, existing);
            }
        }

        return Array.from(byDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, data]) => ({ date, ...data }));
    }

    // ── High-level builders ───────────────────────────────────────────────────

    /**
     * Build PlatformData for the analytics engine from Instagram Reels insights.
     */
    async buildPlatformData(): Promise<PlatformData> {
        const { igUserId } = await this._getValidToken();
        const reels = await this.getReels(20);

        if (reels.length === 0) {
            return {
                platform: 'instagram_reels',
                streams: 0,
                saves: 0,
                completionRate: 0.5,
                creatorCount: 0,
            };
        }

        // Fetch insights for each Reel (capped at 10 to avoid rate limits)
        const insightsResults = await Promise.allSettled(
            reels.slice(0, 10).map(r => this.getReelInsights(r.id))
        );

        let totalPlays  = 0;
        let totalSaves  = 0;
        let totalShares = 0;
        let successCount = 0;

        for (const result of insightsResults) {
            if (result.status === 'fulfilled') {
                totalPlays  += result.value.plays;
                totalSaves  += result.value.saved + result.value.shares;
                totalShares += result.value.shares;
                successCount++;
            }
        }

        // Completion rate: Instagram Reels plays / impressions ratio approximates completion
        const totalImpressions = insightsResults
            .filter(r => r.status === 'fulfilled')
            .reduce((s, r) => s + ((r as PromiseFulfilledResult<{ plays: number; impressions: number }>).value.impressions ?? 0), 0);

        const completionRate = totalImpressions > 0
            ? Math.min(totalPlays / totalImpressions, 1)
            : 0.6;

        return {
            platform: 'instagram_reels',
            streams: totalPlays,
            saves: totalSaves,
            completionRate,
            creatorCount: 0, // Reels Audio API (restricted beta) required for creator usage count
        };
    }

    /**
     * Build a 30-day stream history from Instagram account-level daily insights.
     */
    async buildStreamHistory(igUserId: string): Promise<StreamDataPoint[]> {
        const dailyInsights = await this.getAccountDailyInsights(igUserId);
        const byDate = new Map(dailyInsights.map(d => [d.date, d]));

        const history: StreamDataPoint[] = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0]!;
            const day = byDate.get(dateStr);

            history.push({
                date:             dateStr!,
                streams:          day?.impressions ?? 0,
                saves:            0,
                completions:      0,
                uniqueListeners:  day?.reach ?? 0,
                shares:           0,
                newFollowers:     0,
                playlistAdditions: 0,
            });
        }
        return history;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private async _getValidToken(): Promise<{ token: string; igUserId: string }> {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not authenticated.');

        const snap = await getDoc(TOKEN_COLLECTION(uid));
        if (!snap.exists()) throw new Error('Instagram not connected.');

        const stored = snap.data() as IGStoredToken;

        if (!stored.expiresAt || stored.expiresAt < Date.now() + 5 * 60 * 1000) {
            const refreshFn = httpsCallable<unknown, { ok: boolean; accessToken: string; expiresAt: number }>(
                firebaseFunctions, 'analyticsRefreshToken'
            );
            const result = await refreshFn({ platform: 'instagram' });
            return { token: result.data.accessToken, igUserId: stored.igUserId };
        }

        return { token: stored.accessToken, igUserId: stored.igUserId };
    }

    private async _fetch<T>(url: string, token: string): Promise<T> {
        const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}access_token=${token}`, {
            signal: AbortSignal.timeout(15_000),
        });

        if (res.status === 401 || res.status === 190) {
            throw new Error('Instagram token expired — please reconnect.');
        }
        if (res.status === 429) {
            throw new Error('Instagram API rate limit hit. Please wait before retrying.');
        }
        if (!res.ok) {
            const err = await res.text().catch(() => res.statusText);
            throw new Error(`Instagram Graph API error ${res.status}: ${err}`);
        }
        return res.json() as Promise<T>;
    }
}

export const instagramAnalyticsService = new InstagramAnalyticsService();
