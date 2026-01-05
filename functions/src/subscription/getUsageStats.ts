/**
 * Firebase Cloud Function: Get User Usage Statistics
 *
 * Retrieves usage statistics for the current billing period.
 */

import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { UsageStats, SubscriptionTier } from '../../../src/services/subscription/types';
import { TIER_CONFIGS } from '../../../src/services/subscription/SubscriptionTier';

export const getUsageStats = onCall(async (request) => {
  const { userId } = request.data;

  if (!userId || userId !== request.auth?.uid) {
    throw new Error('Unauthorized');
  }

  try {
    const db = getFirestore();

    // Get subscription
    const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
    if (!subscriptionDoc.exists()) {
      throw new Error('Subscription not found');
    }

    const subscription = subscriptionDoc.data();
    const tier = subscription.tier as SubscriptionTier;
    const tierConfig = TIER_CONFIGS[tier];

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
    let aiChatTokensUsed = 0;
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
          aiChatTokensUsed += record.amount;
          break;
        case 'storage':
          storageUsedBytes += record.amount;
          break;
      }
    });

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
    const teamSnapshot = await db
      .collection('organizations')
      .where(`members.${userId}`, '!=', null)
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
  } catch (error) {
    console.error('[getUsageStats] Error:', error);
    throw new Error('Failed to retrieve usage statistics');
  }
});
