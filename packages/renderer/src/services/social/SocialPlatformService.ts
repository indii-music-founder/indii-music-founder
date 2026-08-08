/**
 * SocialPlatformService
 *
 * Sanitized analytics facade. OAuth credentials, provider requests, and cache
 * writes stay inside the `syncPlatformStats` Cloud Function. Social publishing
 * uses the persisted scheduled-post pipeline and its server-side delivery worker;
 * this renderer module intentionally exposes no browser-token or direct-publish API.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

export type SocialPlatform = 'twitter' | 'instagram' | 'tiktok' | 'youtube' | 'spotify';

export interface PlatformStats {
    platform: SocialPlatform;
    followers?: number;
    impressions?: number;
    plays?: number;
    likes?: number;
    shares?: number;
    fetchedAt: number;
    connected?: boolean;
    authorized?: boolean;
    liveSyncOk?: boolean;
    cacheOnly?: boolean;
    error?: 'not_connected' | 'authorization_expired' | 'live_sync_failed';
}

async function syncStatsViaServer(platform: SocialPlatform, artistId?: string): Promise<PlatformStats> {
    const sync = httpsCallable<
        { platform: SocialPlatform; artistId?: string },
        PlatformStats
    >(functions, 'syncPlatformStats');
    const result = await sync({ platform, ...(artistId ? { artistId } : {}) });
    return result.data;
}

export async function syncSpotifyStats(_uid: string, artistId: string): Promise<PlatformStats> {
    return syncStatsViaServer('spotify', artistId || undefined);
}

export async function syncInstagramStats(_uid: string): Promise<PlatformStats> {
    return syncStatsViaServer('instagram');
}

export async function syncTikTokStats(_uid: string): Promise<PlatformStats> {
    return syncStatsViaServer('tiktok');
}

export async function syncTwitterStats(_uid: string): Promise<PlatformStats> {
    return syncStatsViaServer('twitter');
}

export async function syncYouTubeStats(_uid: string): Promise<PlatformStats> {
    return syncStatsViaServer('youtube');
}
