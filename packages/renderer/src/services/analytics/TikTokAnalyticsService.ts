/**
 * TikTokAnalyticsService — TikTok Display API + Creator Marketplace Integration
 *
 * OAuth 2.0 flow via server-side Cloud Functions (platformTokenExchange.ts).
 * Client secret is NEVER exposed — all token operations go through Firebase Functions.
 *
 * API used:
 *   - TikTok Display API v2 (open.tiktokapis.com) — video list, video stats
 *   - Research API (business.tiktokapis.com) — available to approved partners only;
 *     falls back to Display API stats if Research API access not granted.
 *
 * Scopes requested (via TikTok app settings):
 *   user.info.basic    — Profile info
 *   video.list         — List user's videos
 *   video.upload       — Allowed in TikTok for Business
 *
 * NOTE: TikTok does NOT expose raw sound/audio usage counts via the Display API.
 * The "creator count" metric (how many creators used your audio) requires either:
 *   (a) TikTok Research API (approved academic/business partners only), or
 *   (b) Manual search via TikTok app "Sound Details" page.
 * The creatorCount field is set to 0 unless Research API access is available.
 *
 * Firestore token path: users/{uid}/analyticsTokens/tiktok
 */

import { functions as firebaseFunctions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import * as Sentry from '@sentry/react';
import type { PlatformData, StreamDataPoint } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const TIKTOK_BASE = 'https://open.tiktokapis.com/v2';

interface TikTokVideoListResponse {
    data: {
        videos: TikTokVideo[];
        cursor: number;
        has_more: boolean;
    };
    error: { code: string; message: string; log_id: string };
}

interface TikTokVideo {
    id: string;
    title: string;
    cover_image_url: string;
    share_url: string;
    video_description: string;
    duration: number;            // seconds
    height: number;
    width: number;
    view_count: number;
    like_count: number;
    comment_count: number;
    share_count: number;
    create_time: number;         // Unix timestamp
}

interface TikTokUserInfoResponse {
    data: {
        user: {
            open_id: string;
            union_id: string;
            display_name: string;
            avatar_url: string;
            follower_count: number;
            following_count: number;
            likes_count: number;
            video_count: number;
        };
    };
    error: { code: string; message: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// TikTokAnalyticsService
// ─────────────────────────────────────────────────────────────────────────────

export class TikTokAnalyticsService {
    private redirectUri = `${window.location.origin}/auth/tiktok/callback`;

    // ── OAuth / Connection ────────────────────────────────────────────────────

    /**
     * Initiate TikTok OAuth flow. Redirects to TikTok authorization page.
     * Uses state + PKCE-equivalent (code_verifier) for CSRF protection.
     *
     * NOTE: TikTok OAuth 2.0 uses a standard authorization code flow.
     * The actual token exchange happens server-side in the Cloud Function.
     */
    async initiateOAuth(): Promise<void> {
        const clientKey = import.meta.env.VITE_TIKTOK_CLIENT_KEY;
        if (!clientKey) {
            throw new Error('VITE_TIKTOK_CLIENT_KEY is not configured. Add it to your .env file.');
        }

        const state = crypto.randomUUID();
        sessionStorage.setItem('tiktok_oauth_state', state);

        const params = new URLSearchParams({
            client_key: clientKey,
            scope: 'user.info.basic,video.list',
            response_type: 'code',
            redirect_uri: this.redirectUri,
            state,
        });

        window.location.href = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
    }

    /**
     * Handle the OAuth callback — exchange code for tokens via Cloud Function.
     */
    async handleCallback(code: string, state: string): Promise<void> {
        const storedState = sessionStorage.getItem('tiktok_oauth_state');
        if (state !== storedState) {
            throw new Error('OAuth state mismatch — possible CSRF attack.');
        }

        const exchangeFn = httpsCallable<unknown, { ok: boolean }>(
            firebaseFunctions, 'analyticsExchangeToken'
        );

        await exchangeFn({
            platform: 'tiktok',
            code,
            redirectUri: this.redirectUri,
        });

        sessionStorage.removeItem('tiktok_oauth_state');
    }

    /**
     * Disconnect TikTok — revokes token and removes from Firestore.
     */
    async disconnect(): Promise<void> {
        const revokeFn = httpsCallable(firebaseFunctions, 'analyticsRevokeToken');
        await revokeFn({ platform: 'tiktok' });
    }

    /**
     * Check if TikTok is connected and token is valid.
     */
    async isConnected(): Promise<boolean> {
        const uid = auth.currentUser?.uid;
        if (!uid) return false;
        try {
            const statusFn = httpsCallable<unknown, { connected?: boolean }>(
                firebaseFunctions, 'analyticsGetConnectionStatus'
            );
            const result = await statusFn({ platform: 'tiktok' });
            return result.data.connected === true;
        } catch (err: unknown) {
            logger.error('[TikTokAnalyticsService] Failed to check connection:', err);
            Sentry.captureException(err);
            return false;
        }
    }

    // ── Data fetching ─────────────────────────────────────────────────────────

    /**
     * Get user profile info including follower count.
     */
    async getUserInfo(): Promise<TikTokUserInfoResponse['data']['user']> {
        const token = await this._getValidToken();
        const res = await this._fetch<TikTokUserInfoResponse>(
            `${TIKTOK_BASE}/user/info/?fields=open_id,union_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count`,
            token
        );
        return res.data.user;
    }

    /**
     * Get the user's videos with view/like/share counts.
     * Returns up to `maxVideos` most recent videos.
     */
    async getVideoList(maxVideos = 20): Promise<TikTokVideo[]> {
        const token = await this._getValidToken();
        const videos: TikTokVideo[] = [];
        let cursor = 0;
        let hasMore = true;

        while (hasMore && videos.length < maxVideos) {
            const fields = [
                'id', 'title', 'cover_image_url', 'share_url',
                'video_description', 'duration', 'view_count',
                'like_count', 'comment_count', 'share_count', 'create_time',
            ].join(',');

            const body = JSON.stringify({
                max_count: Math.min(20, maxVideos - videos.length),
                cursor,
                fields,
            });

            const res = await this._fetchPost<TikTokVideoListResponse>(
                `${TIKTOK_BASE}/video/list/`,
                token,
                body
            );

            if (res.error?.code && res.error.code !== 'ok') {
                logger.warn('[TikTok] Video list error:', res.error.message);
                break;
            }

            videos.push(...(res.data?.videos ?? []));
            cursor = res.data?.cursor ?? 0;
            hasMore = res.data?.has_more ?? false;
        }

        return videos.slice(0, maxVideos);
    }

    // ── High-level builders ───────────────────────────────────────────────────

    /**
     * Build PlatformData for the analytics engine from TikTok video stats.
     */
    async buildPlatformData(): Promise<PlatformData> {
        const videos = await this.getVideoList(20);

        if (videos.length === 0) {
            return {
                platform: 'tiktok',
                streams: 0,
                saves: 0,
                completionRate: 0,
                creatorCount: 0,
                savesUnavailable: true,
                completionUnavailable: true,
                sourceLabel: 'No videos were returned; completion, saves, and audio-creator usage are unavailable.',
            };
        }

        const totalViews  = videos.reduce((s, v) => s + v.view_count, 0);

        return {
            platform: 'tiktok',
            streams: totalViews,
            saves: 0,
            completionRate: 0,
            creatorCount: 0, // Requires Research API access (partner program)
            savesUnavailable: true,
            completionUnavailable: true,
            sourceLabel: 'Views are provider-reported account video totals; saves, completion, and audio-creator usage are unavailable.',
        };
    }

    /**
     * TikTok Display API returns current lifetime totals by video, not daily
     * activity. Upload dates cannot be relabeled as the dates those views
     * occurred, so no history is emitted.
     */
    async buildStreamHistory(): Promise<StreamDataPoint[]> {
        logger.info('[TikTokAnalyticsService] Daily view history is unavailable through the Display API.');
        return [];
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private async _getValidToken(): Promise<string> {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error('Not authenticated.');

        const refreshFn = httpsCallable<unknown, { ok: boolean; accessToken: string; expiresAt: number }>(
            firebaseFunctions, 'analyticsRefreshToken'
        );
        const result = await refreshFn({ platform: 'tiktok' });
        if (!result.data.accessToken) throw new Error('TikTok not connected.');
        return result.data.accessToken;
    }

    private async _fetch<T>(url: string, token: string): Promise<T> {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(15_000),
        });

        if (res.status === 401) throw new Error('TikTok token expired — please reconnect.');
        if (res.status === 429) throw new Error('TikTok rate limit hit. Please wait before retrying.');
        if (!res.ok) {
            const err = await res.text().catch(() => res.statusText);
            throw new Error(`TikTok API error ${res.status}: ${err}`);
        }
        return res.json() as Promise<T>;
    }

    private async _fetchPost<T>(url: string, token: string, body: string): Promise<T> {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
            body,
            signal: AbortSignal.timeout(15_000),
        });

        if (res.status === 401) throw new Error('TikTok token expired — please reconnect.');
        if (res.status === 429) throw new Error('TikTok rate limit hit. Please wait before retrying.');
        if (!res.ok) {
            const err = await res.text().catch(() => res.statusText);
            throw new Error(`TikTok API error ${res.status}: ${err}`);
        }
        return res.json() as Promise<T>;
    }
}

export const tikTokAnalyticsService = new TikTokAnalyticsService();
