"use strict";
/**
 * Firebase Cloud Function: Get User Usage Statistics
 *
 * Retrieves usage statistics for the current billing period.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsageStats = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const SubscriptionTier_1 = require("../shared/subscription/SubscriptionTier");
exports.getUsageStats = (0, https_1.onCall)({ enforceAppCheck: process.env.SKIP_APP_CHECK !== 'true' }, async (request) => {
    var _a;
    const { userId } = request.data;
    if (!userId || userId !== ((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new https_1.HttpsError('unauthenticated', 'Unauthorized');
    }
    try {
        const db = (0, firestore_1.getFirestore)();
        // Get subscription
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        if (!subscriptionDoc.exists) {
            throw new https_1.HttpsError('not-found', 'Subscription not found');
        }
        const subscription = subscriptionDoc.data();
        if (!subscription) {
            throw new https_1.HttpsError('not-found', 'Subscription data not found');
        }
        const tier = subscription.tier;
        const tierConfig = SubscriptionTier_1.TIER_CONFIGS[tier];
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
        const teamMembersField = new firestore_1.FieldPath('members', userId);
        const teamSnapshot = await db
            .collection('organizations')
            .where(teamMembersField, '!=', null)
            .get();
        const teamMembersUsed = teamSnapshot.size;
        // Build response
        const stats = {
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
    }
    catch (error) {
        console.error('[getUsageStats] Error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to retrieve usage statistics');
    }
});
//# sourceMappingURL=getUsageStats.js.map