import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';

const db = admin.firestore();

/**
 * Social platform connection status.
 * Returns ONLY sanitized metadata; never exposes OAuth tokens or credentials.
 */
interface SocialConnectionStatus {
  platform: string;
  isConnected: boolean;
  lastSyncAt?: string; // ISO 8601 timestamp
  lastError?: string;
  needsReAuth?: boolean;
}

const GetSocialConnectionStatusRequestSchema = z.object({
  platform: z.enum(['spotify', 'instagram', 'tiktok', 'twitter', 'youtube']).optional(),
});

export const getSocialConnectionStatus = onCall(async (request) => {
  // Require authentication
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'User must be signed in.');
  }

  const userId = request.auth.uid;

  try {
    const parsed = GetSocialConnectionStatusRequestSchema.parse(request.data);
    const platform = parsed.platform;

    if (platform) {
      // Single platform status
      return getSinglePlatformStatus(userId, platform);
    } else {
      // All platforms status
      return getAllPlatformsStatus(userId);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new HttpsError('invalid-argument', `Invalid request: ${error.message}`);
    }
    throw new HttpsError('internal', 'Failed to retrieve connection status.');
  }
});

async function getSinglePlatformStatus(
  userId: string,
  platform: string
): Promise<SocialConnectionStatus> {
  try {
    const platformStatsDoc = await db
      .collection('users')
      .doc(userId)
      .collection('platformStats')
      .doc(platform)
      .get();

    if (!platformStatsDoc.exists) {
      return {
        platform,
        isConnected: false,
      };
    }

    const data = platformStatsDoc.data();
    return {
      platform,
      isConnected: true,
      lastSyncAt: data?.lastSyncAt?.toISOString?.() || data?.lastSyncAt,
      lastError: data?.lastError || undefined,
      needsReAuth: data?.needsReAuth || false,
    };
  } catch (error) {
    console.error(`Failed to fetch status for ${platform}:`, error);
    return {
      platform,
      isConnected: false,
      lastError: 'Failed to fetch connection status',
    };
  }
}

async function getAllPlatformsStatus(
  userId: string
): Promise<SocialConnectionStatus[]> {
  const platforms = ['spotify', 'instagram', 'tiktok', 'twitter', 'youtube'] as const;
  const statuses: SocialConnectionStatus[] = [];

  try {
    const platformStatsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('platformStats')
      .get();

    const cachedPlatforms = new Set(
      platformStatsSnapshot.docs.map((doc) => doc.id)
    );

    for (const platform of platforms) {
      if (cachedPlatforms.has(platform)) {
        const doc = platformStatsSnapshot.docs.find((d) => d.id === platform);
        const data = doc?.data();
        statuses.push({
          platform,
          isConnected: true,
          lastSyncAt: data?.lastSyncAt?.toISOString?.() || data?.lastSyncAt,
          lastError: data?.lastError || undefined,
          needsReAuth: data?.needsReAuth || false,
        });
      } else {
        statuses.push({
          platform,
          isConnected: false,
        });
      }
    }

    return statuses;
  } catch (error) {
    console.error('Failed to fetch all platform statuses:', error);
    return platforms.map((platform) => ({
      platform,
      isConnected: false,
      lastError: 'Failed to fetch connection status',
    }));
  }
}
