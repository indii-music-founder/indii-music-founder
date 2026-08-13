/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Firebase Cloud Function: Get User Usage Statistics
 *
 * Retrieves usage statistics for the current billing period.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { UsageStats, SubscriptionTier } from '../shared/subscription/types';
import { TIER_CONFIGS } from '../shared/subscription/SubscriptionTier';
import { getOrCreateSubscription } from './subscriptionDefaults';

export const getUsageStats = onCall({ enforceAppCheck: false /* true */ }, async (request) => {
  const { userId } = request.data;

  if (!userId || userId !== request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Unauthorized');
  }

  try {
    const db = getFirestore();

    const subscription = await getOrCreateSubscription(db, userId);

    const tier = subscription.tier as SubscriptionTier;
    const tierConfig = TIER_CONFIGS[tier];
    if (!tierConfig) {
      throw new HttpsError('failed-precondition', `Unsupported subscription tier: ${tier}`);
    }

    // Get usage records for current billing period
    const now = Date.now();
    const periodStart = subscription.currentPeriodStart || (now - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = subscription.currentPeriodEnd || (now + 30 * 24 * 60 * 60 * 1000);

    const usageSnapshot = await db
      .collection('usage')
      .where('userId', '==', userId)
      .where('timestamp', '>=', periodStart)
      .where('timestamp', '<', periodEnd)
      .get();

    // Calculate usage
    let imagesGenerated = 0;
    let videoDurationSeconds = 0;
    let ledgerChatTokensUsed = 0;
    let storageUsedBytes = 0;

    usageSnapshot.forEach(doc => {
      const record = doc.data();
      switch (record.type) {
        case 'image':
          imagesGenerated += record.amount;
          break;
        case 'video':
          videoDurationSeconds += record.amount;
          break;
        case 'chat_tokens':
          ledgerChatTokensUsed += record.amount;
          break;
        case 'storage':
          storageUsedBytes += record.amount;
          break;
        default:
          // ISSUE-1289: an unrecognized/legacy record type used to vanish silently,
          // quietly under-reporting the user's usage. Log it so a new usage type added
          // to the ledger without updating this switch is discoverable rather than
          // invisible. (Display-only path — the billing kill-switch in
          // enforceOperationCost.ts is separate and does not share this gap.)
          logger.warn('[getUsageStats] Unrecognized usage record type; excluded from totals', {
            type: record.type,
            docId: doc.id,
          });
          break;
      }
    });

    // AI calls are metered by the model gateway in daily user_usage_stats
    // documents. The legacy subscription ledger may also contain chat records;
    // use the larger verified total so the UI cannot report zero after real chat.
    const startDate = new Date(periodStart).toISOString().slice(0, 10);
    const endDate = new Date(periodEnd).toISOString().slice(0, 10);
    const dailyUsageSnapshot = await db.collection('user_usage_stats')
      .where('userId', '==', userId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
    let gatewayChatTokensUsed = 0;
    dailyUsageSnapshot.forEach(doc => {
      gatewayChatTokensUsed += Number(doc.data().tokensUsed) || 0;
    });
    const aiChatTokensUsed = Math.max(ledgerChatTokensUsed, gatewayChatTokensUsed);

    // Storage is a current capacity measurement, not cumulative upload traffic.
    // Prefer the daily bucket scan and retain ledger usage only until the first
    // scan is available for an account.
    const storageQuotaDoc = await db.collection('users').doc(userId).collection('usage').doc('storage').get();
    if (storageQuotaDoc.exists) {
      storageUsedBytes = Number(storageQuotaDoc.data()?.totalBytes) || 0;
    }

    // Convert to appropriate units
    const videoDurationMinutes = videoDurationSeconds / 60;
    const storageUsedGB = storageUsedBytes / (1024 * 1024 * 1024);

    // Calculate remaining
    const imagesRemaining = Math.max(0, tierConfig.imageGenerations.monthly - imagesGenerated);
    const videoRemainingMinutes = Math.max(0, tierConfig.videoGenerations.totalDurationMinutes - videoDurationMinutes);
    const tokensRemaining = Math.max(0, tierConfig.aiChat.tokensPerMonth - aiChatTokensUsed);
    const storageRemainingGB = Math.max(0, tierConfig.storage.totalGB - storageUsedGB);

    // Get project count
    const projectsSnapshot = await db
      .collection('projects')
      .where('userId', '==', userId)
      .where('archived', '==', false)
      .get();
    const projectsCreated = projectsSnapshot.size;

    // Get team members count
    const teamMembersField = new FieldPath('members', userId);
    const teamSnapshot = await db
      .collection('organizations')
      .where(teamMembersField, '!=', null)
      .get();
    const teamMembersUsed = teamSnapshot.size;

    // Build response
    const stats: UsageStats = {
      tier,
      resetDate: periodEnd,
      imagesGenerated,
      imagesRemaining,
      imagesPerMonth: tierConfig.imageGenerations.monthly,
      videoDurationSeconds,
      videoDurationMinutes,
      videoRemainingMinutes,
      videoTotalMinutes: tierConfig.videoGenerations.totalDurationMinutes,
      aiChatTokensUsed,
      aiChatTokensRemaining: tokensRemaining,
      aiChatTokensPerMonth: tierConfig.aiChat.tokensPerMonth,
      storageUsedGB,
      storageRemainingGB,
      storageTotalGB: tierConfig.storage.totalGB,
      projectsCreated,
      projectsRemaining: Math.max(0, tierConfig.maxProjects - projectsCreated),
      maxProjects: tierConfig.maxProjects,
      teamMembersUsed,
      teamMembersRemaining: Math.max(0, tierConfig.maxTeamMembers - teamMembersUsed),
      maxTeamMembers: tierConfig.maxTeamMembers
    };

    return stats;
  } catch (error: any) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('[getUsageStats] Error:', error);
    throw new HttpsError('internal', error.message || 'Failed to retrieve usage statistics');
  }
});
