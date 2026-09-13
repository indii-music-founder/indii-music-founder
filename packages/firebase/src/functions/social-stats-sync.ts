import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { calculateReelEngagementPercent, resolveReelShareSignal, resolveUnifiedViews } from '@indii/shared';

const SyncStatsRequestSchema = z.object({
  platform: z.enum(['spotify', 'instagram', 'tiktok', 'twitter', 'youtube']),
  artistId: z.string().regex(/^[A-Za-z0-9]{1,128}$/).optional(),
});

type SocialStatsPlatform = z.infer<typeof SyncStatsRequestSchema>['platform'];

export interface PlatformStats {
  platform: SocialStatsPlatform;
  followers?: number;
  impressions?: number;
  plays?: number;
  views?: number;
  viewsSource?: string;
  viewsLabel?: string;
  likes?: number;
  shares?: number;
  shareSignalKind?: string;
  shareSignalLabel?: string;
  reelEngagementPercent?: number | null;
  contentViewsByFormat?: Partial<Record<'photo' | 'carousel' | 'story' | 'reel', number>>;
  fetchedAt: number;
}

export interface PlatformSyncResult extends PlatformStats {
  connected: boolean;
  authorized: boolean;
  liveSyncOk: boolean;
  cacheOnly: boolean;
  error?: 'not_connected' | 'authorization_expired' | 'live_sync_failed';
}

interface StoredSocialToken {
  accessToken?: unknown;
  expiresAt?: unknown;
  igUserId?: unknown;
}

interface SnapshotLike {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

interface DocumentRefLike {
  get(): Promise<SnapshotLike>;
  set(data: Record<string, unknown>, options: { merge: boolean }): Promise<unknown>;
}

interface UserDocumentLike {
  collection(name: string): { doc(id: string): DocumentRefLike };
}

export interface SocialStatsDependencies {
  userDocument(uid: string): UserDocumentLike;
  fetch: typeof fetch;
  now(): number;
  serverTimestamp(): unknown;
}

const defaultDependencies: SocialStatsDependencies = {
  userDocument: (uid) => admin.firestore().collection('users').doc(uid) as unknown as UserDocumentLike,
  fetch,
  now: () => Date.now(),
  serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
};

function subdocument(deps: SocialStatsDependencies, uid: string, collection: string, id: string): DocumentRefLike {
  return deps.userDocument(uid).collection(collection).doc(id);
}

async function readServerToken(
  deps: SocialStatsDependencies,
  uid: string,
  platform: SocialStatsPlatform,
): Promise<StoredSocialToken | undefined> {
  // OAuth analytics connections use analyticsTokens. Legacy publishing/social
  // connections may still live in socialTokens, so read that only as a migration
  // fallback. Both paths remain inaccessible to the browser.
  const analyticsSnapshot = await subdocument(deps, uid, 'analyticsTokens', platform).get();
  if (analyticsSnapshot.exists) return analyticsSnapshot.data() as StoredSocialToken;
  const socialSnapshot = await subdocument(deps, uid, 'socialTokens', platform).get();
  return socialSnapshot.exists ? socialSnapshot.data() as StoredSocialToken : undefined;
}

function cachedStats(platform: SocialStatsPlatform, data: Record<string, unknown> | undefined): PlatformStats | undefined {
  if (!data) return undefined;
  const result: PlatformStats = {
    platform,
    fetchedAt: typeof data.fetchedAt === 'number' ? data.fetchedAt : 0,
  };
  for (const field of ['followers', 'impressions', 'plays', 'views', 'likes', 'shares'] as const) {
    if (typeof data[field] === 'number' && Number.isFinite(data[field])) result[field] = data[field];
  }
  if (typeof data.viewsSource === 'string') result.viewsSource = data.viewsSource;
  if (typeof data.viewsLabel === 'string') result.viewsLabel = data.viewsLabel;
  if (typeof data.shareSignalKind === 'string') result.shareSignalKind = data.shareSignalKind;
  if (typeof data.shareSignalLabel === 'string') result.shareSignalLabel = data.shareSignalLabel;
  if (typeof data.reelEngagementPercent === 'number' || data.reelEngagementPercent === null) result.reelEngagementPercent = data.reelEngagementPercent;
  if (data.contentViewsByFormat && typeof data.contentViewsByFormat === 'object') result.contentViewsByFormat = data.contentViewsByFormat as PlatformStats['contentViewsByFormat'];
  return Object.keys(result).length > 2 ? result : undefined;
}

function failed(platform: SocialStatsPlatform, now: number, lastError: string): PlatformStats & { lastError: string } {
  return { platform, fetchedAt: now, lastError };
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; status: number }> {
  const response = await fetchImpl(url, init);
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, body: await response.json() as Record<string, unknown> };
}

async function fetchLiveStats(
  platform: SocialStatsPlatform,
  token: StoredSocialToken,
  artistId: string | undefined,
  deps: SocialStatsDependencies,
): Promise<PlatformStats & { lastError?: string }> {
  const accessToken = String(token.accessToken);
  const authorization = { Authorization: `Bearer ${accessToken}` };
  const timeout = () => AbortSignal.timeout(10_000);
  const now = deps.now();

  try {
    if (platform === 'spotify') {
      const endpoint = artistId
        ? `https://api.spotify.com/v1/artists/${artistId}`
        : 'https://api.spotify.com/v1/me';
      const response = await fetchJson(deps.fetch, endpoint, { headers: authorization, signal: timeout() });
      if (!response.ok) return failed(platform, now, `spotify_${response.status}`);
      const followers = response.body.followers as { total?: unknown } | undefined;
      return {
        platform,
        ...(typeof followers?.total === 'number' ? { followers: followers.total } : {}),
        fetchedAt: now,
      };
    }

    if (platform === 'instagram') {
      let instagramUserId = typeof token.igUserId === 'string' ? token.igUserId : undefined;
      if (!instagramUserId) {
        const me = await fetchJson(
          deps.fetch,
        `https://graph.facebook.com/v23.0/me?fields=instagram_business_account&access_token=${encodeURIComponent(accessToken)}`,
          { signal: timeout() },
        );
        if (!me.ok) return failed(platform, now, `instagram_${me.status}`);
        const businessAccount = me.body.instagram_business_account as { id?: unknown } | undefined;
        instagramUserId = typeof businessAccount?.id === 'string' ? businessAccount.id : undefined;
      }
      if (!instagramUserId) return failed(platform, now, 'instagram_account_missing');
      const response = await fetchJson(
        deps.fetch,
        `https://graph.facebook.com/v23.0/${encodeURIComponent(instagramUserId)}?fields=followers_count,media_count&access_token=${encodeURIComponent(accessToken)}`,
        { signal: timeout() },
      );
      if (!response.ok) return failed(platform, now, `instagram_${response.status}`);
      const mediaFields = 'id,media_type,media_product_type,like_count,comments_count';
      const [mediaResponse, storyResponse] = await Promise.all([
        fetchJson(deps.fetch, `https://graph.facebook.com/v23.0/${encodeURIComponent(instagramUserId)}/media?fields=${mediaFields}&limit=50&access_token=${encodeURIComponent(accessToken)}`, { signal: timeout() }),
        fetchJson(deps.fetch, `https://graph.facebook.com/v23.0/${encodeURIComponent(instagramUserId)}/stories?fields=${mediaFields}&limit=50&access_token=${encodeURIComponent(accessToken)}`, { signal: timeout() }),
      ]);
      type MediaRow = { id?: unknown; media_type?: unknown; media_product_type?: unknown; like_count?: unknown; comments_count?: unknown };
      const media = [
        ...(mediaResponse.ok && Array.isArray(mediaResponse.body.data) ? mediaResponse.body.data as MediaRow[] : []),
        ...(storyResponse.ok && Array.isArray(storyResponse.body.data) ? storyResponse.body.data as MediaRow[] : []),
      ];
      const insightResults = await Promise.allSettled(media.map(async item => {
        if (typeof item.id !== 'string') return undefined;
        const insight = await fetchJson(deps.fetch, `https://graph.facebook.com/v23.0/${encodeURIComponent(item.id)}/insights?metric=views,shares&period=lifetime&access_token=${encodeURIComponent(accessToken)}`, { signal: timeout() });
        if (!insight.ok || !Array.isArray(insight.body.data)) return undefined;
        const rows = insight.body.data as Array<{ name?: unknown; value?: unknown; values?: Array<{ value?: unknown }> }>;
        const value = (name: string) => {
          const row = rows.find(candidate => candidate.name === name);
          const candidate = row?.value ?? row?.values?.[0]?.value;
          return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0;
        };
        const product = String(item.media_product_type ?? '').toUpperCase();
        const mediaType = String(item.media_type ?? '').toUpperCase();
        const format: 'photo' | 'carousel' | 'story' | 'reel' = product === 'STORY' ? 'story' : product === 'REELS' ? 'reel' : mediaType === 'CAROUSEL_ALBUM' ? 'carousel' : 'photo';
        return { format, views: value('views'), shares: value('shares'), likes: Number(item.like_count ?? 0), comments: Number(item.comments_count ?? 0) };
      }));
      const totals = { views: 0, shares: 0, likes: 0, comments: 0, successful: 0, contentViewsByFormat: {} as Record<string, number> };
      const reelTotals = { views: 0, shares: 0, likes: 0, comments: 0 };
      for (const result of insightResults) {
        if (result.status !== 'fulfilled' || !result.value) continue;
        totals.successful += 1;
        totals.views += result.value.views; totals.shares += result.value.shares;
        totals.likes += result.value.likes; totals.comments += result.value.comments;
        totals.contentViewsByFormat[result.value.format] = (totals.contentViewsByFormat[result.value.format] ?? 0) + result.value.views;
        if (result.value.format === 'reel') {
          reelTotals.views += result.value.views; reelTotals.shares += result.value.shares;
          reelTotals.likes += result.value.likes; reelTotals.comments += result.value.comments;
        }
      }
      const unified = resolveUnifiedViews({ views: totals.successful > 0 ? totals.views : undefined });
      const shareSignal = resolveReelShareSignal({ shares: totals.shares });
      return {
        platform,
        ...(typeof response.body.followers_count === 'number' ? { followers: response.body.followers_count } : {}),
        ...(unified.views !== null ? { views: unified.views } : {}),
        viewsSource: unified.source,
        viewsLabel: unified.label,
        likes: totals.likes,
        shares: totals.shares,
        shareSignalKind: shareSignal.kind,
        shareSignalLabel: shareSignal.label,
        reelEngagementPercent: calculateReelEngagementPercent({ views: reelTotals.views, likes: reelTotals.likes, shares: reelTotals.shares, comments: reelTotals.comments }),
        contentViewsByFormat: totals.contentViewsByFormat,
        fetchedAt: now,
      };
    }

    if (platform === 'tiktok') {
      const response = await fetchJson(
        deps.fetch,
        'https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count,video_count',
        { headers: authorization, signal: timeout() },
      );
      if (!response.ok) return failed(platform, now, `tiktok_${response.status}`);
      const data = response.body.data as { user?: Record<string, unknown> } | undefined;
      const user = data?.user;
      return {
        platform,
        ...(typeof user?.follower_count === 'number' ? { followers: user.follower_count } : {}),
        ...(typeof user?.likes_count === 'number' ? { likes: user.likes_count } : {}),
        fetchedAt: now,
      };
    }

    if (platform === 'twitter') {
      const response = await fetchJson(
        deps.fetch,
        'https://api.twitter.com/2/users/me?user.fields=public_metrics',
        { headers: authorization, signal: timeout() },
      );
      if (!response.ok) return failed(platform, now, `twitter_${response.status}`);
      const data = response.body.data as { public_metrics?: Record<string, unknown> } | undefined;
      const metrics = data?.public_metrics;
      return {
        platform,
        ...(typeof metrics?.followers_count === 'number' ? { followers: metrics.followers_count } : {}),
        ...(typeof metrics?.impression_count === 'number' ? { impressions: metrics.impression_count } : {}),
        ...(typeof metrics?.like_count === 'number' ? { likes: metrics.like_count } : {}),
        fetchedAt: now,
      };
    }

    const response = await fetchJson(
      deps.fetch,
      'https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true',
      { headers: authorization, signal: timeout() },
    );
    if (!response.ok) return failed(platform, now, `youtube_${response.status}`);
    const items = response.body.items as Array<{ statistics?: Record<string, unknown> }> | undefined;
    const stats = items?.[0]?.statistics;
    const followers = typeof stats?.subscriberCount === 'string' ? Number.parseInt(stats.subscriberCount, 10) : undefined;
    const plays = typeof stats?.viewCount === 'string' ? Number.parseInt(stats.viewCount, 10) : undefined;
    return {
      platform,
      ...(Number.isFinite(followers) ? { followers } : {}),
      ...(Number.isFinite(plays) ? { plays } : {}),
      fetchedAt: now,
    };
  } catch (error) {
    console.error(`[syncPlatformStats] ${platform} live request failed`, error);
    return failed(platform, now, `${platform}_network`);
  }
}

export async function syncPlatformStatsForUser(
  uid: string,
  rawInput: unknown,
  deps: SocialStatsDependencies = defaultDependencies,
): Promise<PlatformSyncResult> {
  const { platform, artistId } = SyncStatsRequestSchema.parse(rawInput);
  const now = deps.now();
  const token = await readServerToken(deps, uid, platform);
  if (!token?.accessToken) {
    return {
      platform,
      fetchedAt: now,
      connected: false,
      authorized: false,
      liveSyncOk: false,
      cacheOnly: false,
      error: 'not_connected',
    };
  }
  if (typeof token.expiresAt === 'number' && token.expiresAt <= now) {
    return {
      platform,
      fetchedAt: now,
      connected: false,
      authorized: false,
      liveSyncOk: false,
      cacheOnly: false,
      error: 'authorization_expired',
    };
  }

  const live = await fetchLiveStats(platform, token, artistId, deps);
  const cacheRef = subdocument(deps, uid, 'platformStats', platform);
  if (live.lastError) {
    const cacheSnapshot = await cacheRef.get();
    const cache = cacheSnapshot.exists ? cachedStats(platform, cacheSnapshot.data()) : undefined;
    return {
      ...(cache ?? { platform, fetchedAt: now }),
      connected: true,
      authorized: true,
      liveSyncOk: false,
      cacheOnly: Boolean(cache),
      error: 'live_sync_failed',
    };
  }

  await cacheRef.set({
    ...live,
    authorized: true,
    liveSyncOk: true,
    updatedAt: deps.serverTimestamp(),
  }, { merge: true });

  return {
    ...live,
    connected: true,
    authorized: true,
    liveSyncOk: true,
    cacheOnly: false,
  };
}

/**
 * Server-side platform stats sync. Raw OAuth tokens remain behind Admin SDK;
 * callers receive sanitized status and numeric analytics only.
 */
export const syncPlatformStats = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'User must be signed in.');

  try {
    return await syncPlatformStatsForUser(request.auth.uid, request.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new HttpsError('invalid-argument', `Invalid request: ${error.message}`);
    }
    console.error('Platform stats sync error:', error);
    throw new HttpsError('internal', 'Failed to sync platform stats.');
  }
});
