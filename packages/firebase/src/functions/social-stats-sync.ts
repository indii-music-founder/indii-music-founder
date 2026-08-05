import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const db = admin.firestore();

export interface PlatformStats {
  platform: string;
  followers?: number;
  impressions?: number;
  plays?: number;
  likes?: number;
  shares?: number;
  fetchedAt: number;
  lastError?: string;
}

const SyncStatsRequestSchema = z.object({
  platform: z.enum(['spotify', 'instagram', 'tiktok', 'twitter', 'youtube']),
});

/**
 * Server-side platform stats sync.
 * Reads OAuth tokens via Admin SDK (bypasses client-side rules denials).
 * Client calls this callable instead of reading tokens directly.
 */
export const syncPlatformStats = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'User must be signed in.');
  }

  try {
    const parsed = SyncStatsRequestSchema.parse(request.data);
    const { platform } = parsed;
    const userId = request.auth.uid;

    // Read token via Admin SDK (always succeeds, rules don't apply)
    const tokenDoc = await db
      .collection('users')
      .doc(userId)
      .collection('socialTokens')
      .doc(platform)
      .get();

    if (!tokenDoc.exists) {
      // No token stored — user not connected
      return {
        platform,
        fetchedAt: Date.now(),
        error: 'Not connected',
      } as PlatformStats;
    }

    const token = tokenDoc.data();
    if (!token?.accessToken) {
      return {
        platform,
        fetchedAt: Date.now(),
        error: 'Invalid token',
      } as PlatformStats;
    }

    let stats: PlatformStats;

    switch (platform) {
      case 'spotify':
        stats = await syncSpotifyStatsServerSide(userId, token);
        break;
      case 'instagram':
        stats = await syncInstagramStatsServerSide(userId, token);
        break;
      case 'tiktok':
        stats = await syncTikTokStatsServerSide(userId, token);
        break;
      case 'twitter':
        stats = await syncTwitterStatsServerSide(userId, token);
        break;
      case 'youtube':
        stats = await syncYouTubeStatsServerSide(userId, token);
        break;
      default:
        return {
          platform,
          fetchedAt: Date.now(),
          error: 'Unsupported platform',
        } as PlatformStats;
    }

    // Persist to platformStats (server writes, client reads via rules)
    await db
      .collection('users')
      .doc(userId)
      .collection('platformStats')
      .doc(platform)
      .set(
        {
          ...stats,
          lastError: undefined, // Don't persist errors
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return stats;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new HttpsError('invalid-argument', `Invalid request: ${error.message}`);
    }
    console.error('Platform stats sync error:', error);
    throw new HttpsError('internal', 'Failed to sync platform stats.');
  }
});

// ────────────────────────────────────────────────────────────────────

async function syncSpotifyStatsServerSide(
  userId: string,
  token: any
): Promise<PlatformStats> {
  try {
    const artistRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${token.accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!artistRes.ok) {
      return { platform: 'spotify', fetchedAt: Date.now(), lastError: 'API error' };
    }

    const artist = await artistRes.json() as {
      followers?: { total: number };
      popularity?: number;
    };

    return {
      platform: 'spotify',
      followers: artist.followers?.total,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.error('Spotify sync error:', err);
    return { platform: 'spotify', fetchedAt: Date.now(), lastError: String(err) };
  }
}

async function syncInstagramStatsServerSide(
  userId: string,
  token: any
): Promise<PlatformStats> {
  try {
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=instagram_business_account&access_token=${token.accessToken}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!meRes.ok) {
      return { platform: 'instagram', fetchedAt: Date.now(), lastError: 'API error' };
    }

    const meData = await meRes.json() as { instagram_business_account?: { id: string } };
    const igId = meData.instagram_business_account?.id;

    if (!igId) {
      return { platform: 'instagram', fetchedAt: Date.now(), lastError: 'No business account' };
    }

    const statsRes = await fetch(
      `https://graph.facebook.com/v19.0/${igId}?fields=followers_count,media_count&access_token=${token.accessToken}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!statsRes.ok) {
      return { platform: 'instagram', fetchedAt: Date.now(), lastError: 'API error' };
    }

    const stats = await statsRes.json() as { followers_count?: number; media_count?: number };

    return {
      platform: 'instagram',
      followers: stats.followers_count,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.error('Instagram sync error:', err);
    return { platform: 'instagram', fetchedAt: Date.now(), lastError: String(err) };
  }
}

async function syncTikTokStatsServerSide(
  userId: string,
  token: any
): Promise<PlatformStats> {
  try {
    const userRes = await fetch('https://open.tiktokapis.com/v1/user/info/', {
      headers: { 'Authorization': `Bearer ${token.accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!userRes.ok) {
      return { platform: 'tiktok', fetchedAt: Date.now(), lastError: 'API error' };
    }

    const userData = await userRes.json() as any;
    const user = userData.data?.user;

    return {
      platform: 'tiktok',
      followers: user?.follower_count,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.error('TikTok sync error:', err);
    return { platform: 'tiktok', fetchedAt: Date.now(), lastError: String(err) };
  }
}

async function syncTwitterStatsServerSide(
  userId: string,
  token: any
): Promise<PlatformStats> {
  try {
    const userRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${token.accessToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!userRes.ok) {
      return { platform: 'twitter', fetchedAt: Date.now(), lastError: 'API error' };
    }

    const userData = await userRes.json() as any;
    const user = userData.data;

    // Get public_metrics with a second call
    const metricsRes = await fetch(
      `https://api.twitter.com/2/users/${user?.id}?user.fields=public_metrics`,
      { headers: { 'Authorization': `Bearer ${token.accessToken}` } }
    );

    if (!metricsRes.ok) {
      return { platform: 'twitter', fetchedAt: Date.now(), lastError: 'API error' };
    }

    const metricsData = await metricsRes.json() as any;
    const metrics = metricsData.data?.public_metrics;

    return {
      platform: 'twitter',
      followers: metrics?.followers_count,
      likes: metrics?.like_count,
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.error('Twitter sync error:', err);
    return { platform: 'twitter', fetchedAt: Date.now(), lastError: String(err) };
  }
}

async function syncYouTubeStatsServerSide(
  userId: string,
  token: any
): Promise<PlatformStats> {
  try {
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true',
      { headers: { 'Authorization': `Bearer ${token.accessToken}` } }
    );

    if (!channelRes.ok) {
      return { platform: 'youtube', fetchedAt: Date.now(), lastError: 'API error' };
    }

    const channelData = await channelRes.json() as any;
    const stats = channelData.items?.[0]?.statistics;

    return {
      platform: 'youtube',
      followers: parseInt(stats?.subscriberCount, 10),
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.error('YouTube sync error:', err);
    return { platform: 'youtube', fetchedAt: Date.now(), lastError: String(err) };
  }
}
