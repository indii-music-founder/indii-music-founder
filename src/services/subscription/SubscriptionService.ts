/**
 * Subscription Management Service
 *
 * Handles all subscription-related operations including:
 * - Tier management and upgrades/downgrades
 * - Quota checking
 * - Usage tracking
 * - Stripe checkout sessions
 */

import { getApps, initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '@/services/firebase';
import {
  UsageWarningLevel
} from './types';
import type {
  Subscription,
  UsageStats,
  QuotaCheckResult,
  CheckoutSessionParams,
  CheckoutSessionResponse,
  UsageWarning,
  SubscriptionChangeRequest
} from './types';
import { SubscriptionTier, TIER_CONFIGS, getTierConfig } from './SubscriptionTier';
import { cacheService } from '@/services/cache/CacheService';

export class SubscriptionService {
  private subscriptionCache: Map<string, Subscription> = new Map();
  private usageCache: Map<string, { stats: UsageStats; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get current user's subscription
   */
  async getSubscription(userId: string, forceRefresh = false): Promise<Subscription> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Check cache
    if (!forceRefresh && this.subscriptionCache.has(userId)) {
      return this.subscriptionCache.get(userId)!;
    }

    // Check cache service
    const cached = cacheService.get<Subscription>(`subscription:${userId}`);
    if (cached && !forceRefresh) {
      this.subscriptionCache.set(userId, cached);
      return cached;
    }

    // Fetch from Firebase Functions
    try {
      const functions = getFunctions();
      const getSubscriptionFn = httpsCallable(functions, 'getSubscription');

      const result = await getSubscriptionFn({ userId });
      const subscription: Subscription = result.data as Subscription;

      // Update caches
      this.subscriptionCache.set(userId, subscription);
      cacheService.set(`subscription:${userId}`, subscription, this.CACHE_TTL);

      return subscription;
    } catch (error) {
      // FALLBACK FOR DEV: Bypass CORS/Function errors in local development
      if (import.meta.env.DEV) {
        const mockSub: Subscription = {
          id: 'mock_sub_' + userId,
          userId,
          tier: SubscriptionTier.STUDIO, // Give unlimited access for dev
          status: 'active',
          currentPeriodStart: Date.now(),
          currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
          cancelAtPeriodEnd: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        this.subscriptionCache.set(userId, mockSub);
        return mockSub;
      }

      throw new Error('Failed to fetch subscription. Please try again.');
    }
  }

  /**
   * Get current user's subscription (uses authenticated user)
   */
  async getCurrentSubscription(forceRefresh = false): Promise<Subscription> {
    if (!auth.currentUser) {
      throw new Error('User must be authenticated');
    }
    return this.getSubscription(auth.currentUser.uid, forceRefresh);
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(userId: string, forceRefresh = false): Promise<UsageStats> {
    // Check cache
    if (!forceRefresh && this.usageCache.has(userId)) {
      const cached = this.usageCache.get(userId)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.stats;
      }
    }

    try {
      const functions = getFunctions();
      const getUsageStatsFn = httpsCallable(functions, 'getUsageStats');

      const result = await getUsageStatsFn({ userId });
      const stats: UsageStats = result.data as UsageStats;

      // Update cache
      this.usageCache.set(userId, { stats, timestamp: Date.now() });

      return stats;
    } catch (error) {
      // FALLBACK FOR DEV: Bypass CORS/Function errors in local development
      if (import.meta.env.DEV) {
        const mockStats: UsageStats = {
          userId,
          tier: SubscriptionTier.STUDIO,
          imagesGenerated: 0,
          imagesRemaining: 9999,
          imagesPerMonth: 9999,
          videoDurationSeconds: 0,
          videoDurationMinutes: 0,
          videoRemainingMinutes: 9999,
          videoTotalMinutes: 9999,
          aiChatTokensUsed: 0,
          aiChatTokensRemaining: 999999,
          aiChatTokensPerMonth: 999999,
          storageUsedGB: 0,
          storageTotalGB: 1000,
          storageRemainingGB: 1000,
          projectsCreated: 0,
          projectsRemaining: 999,
          maxProjects: 999,
          teamMembersUsed: 0,
          teamMembersRemaining: 999,
          maxTeamMembers: 999,
          resetDate: Date.now() + 30 * 24 * 60 * 60 * 1000
        };
        this.usageCache.set(userId, { stats: mockStats, timestamp: Date.now() });
        return mockStats;
      }

      throw new Error('Failed to fetch usage statistics. Please try again.');
    }
  }

  /**
   * Get current user's usage statistics
   */
  async getCurrentUsageStats(forceRefresh = false): Promise<UsageStats> {
    if (!auth.currentUser) {
      throw new Error('User must be authenticated');
    }
    return this.getUsageStats(auth.currentUser.uid, forceRefresh);
  }

  /**
   * Check if user can perform an action based on subscription quota
   */
  async canPerformAction(
    action: 'generateImage' | 'generateVideo' | 'chat' | 'storage' | 'createProject' | 'addTeamMember',
    amount: number = 1,
    userId?: string
  ): Promise<QuotaCheckResult> {
    const targetUserId = userId || auth.currentUser?.uid;
    if (!targetUserId) {
      return {
        allowed: false,
        reason: 'User must be authenticated',
        upgradeRequired: true
      };
    }

    try {
      const [subscription, usage] = await Promise.all([
        this.getSubscription(targetUserId),
        this.getUsageStats(targetUserId)
      ]);

      const tierConfig = getTierConfig(subscription.tier);

      // Skip quota check for studio tier (unlimited)
      if (subscription.tier === SubscriptionTier.STUDIO) {
        return { allowed: true };
      }

      switch (action) {
        case 'generateImage':
          if (usage.imagesRemaining < amount) {
            return {
              allowed: false,
              reason: `Image quota exceeded. You've used ${usage.imagesGenerated}/${tierConfig.imageGenerations.monthly} images this month.`,
              upgradeRequired: subscription.tier === SubscriptionTier.FREE,
              suggestedTier: subscription.tier === SubscriptionTier.FREE ? SubscriptionTier.PRO_MONTHLY : SubscriptionTier.STUDIO,
              upgradeUrl: '/pricing',
              currentUsage: {
                used: usage.imagesGenerated,
                limit: tierConfig.imageGenerations.monthly,
                remaining: usage.imagesRemaining
              }
            };
          }
          return { allowed: true };

        case 'generateVideo':
          const videoMinutesNeeded = amount / 60;
          if (usage.videoRemainingMinutes < videoMinutesNeeded) {
            return {
              allowed: false,
              reason: `Video quota exceeded. You've used ${usage.videoDurationMinutes}/${tierConfig.videoGenerations.totalDurationMinutes} minutes this month.`,
              upgradeRequired: subscription.tier === SubscriptionTier.FREE,
              suggestedTier: subscription.tier === SubscriptionTier.FREE ? SubscriptionTier.PRO_MONTHLY : SubscriptionTier.STUDIO,
              upgradeUrl: '/pricing',
              currentUsage: {
                used: usage.videoDurationMinutes,
                limit: tierConfig.videoGenerations.totalDurationMinutes,
                remaining: usage.videoRemainingMinutes
              }
            };
          }
          return { allowed: true };

        case 'chat':
          if (usage.aiChatTokensRemaining < amount) {
            return {
              allowed: false,
              reason: 'AI chat token quota exceeded. Upgrade to continue using AI chat.',
              upgradeRequired: subscription.tier === SubscriptionTier.FREE,
              suggestedTier: subscription.tier === SubscriptionTier.FREE ? SubscriptionTier.PRO_MONTHLY : SubscriptionTier.STUDIO,
              upgradeUrl: '/pricing',
              currentUsage: {
                used: usage.aiChatTokensUsed,
                limit: tierConfig.aiChat.tokensPerMonth,
                remaining: usage.aiChatTokensRemaining
              }
            };
          }
          return { allowed: true };

        case 'storage':
          if (usage.storageRemainingGB < amount) {
            return {
              allowed: false,
              reason: 'Storage quota exceeded. Upgrade for more storage space.',
              upgradeRequired: subscription.tier === SubscriptionTier.FREE,
              suggestedTier: subscription.tier === SubscriptionTier.FREE ? SubscriptionTier.PRO_MONTHLY : SubscriptionTier.STUDIO,
              upgradeUrl: '/pricing',
              currentUsage: {
                used: usage.storageUsedGB,
                limit: usage.storageTotalGB,
                remaining: usage.storageRemainingGB
              }
            };
          }
          return { allowed: true };

        case 'createProject':
          if (usage.projectsRemaining < amount) {
            return {
              allowed: false,
              reason: `Project limit reached. You've created ${usage.projectsCreated}/${tierConfig.maxProjects} projects.`,
              upgradeRequired: true,
              suggestedTier: SubscriptionTier.PRO_MONTHLY,
              upgradeUrl: '/pricing'
            };
          }
          return { allowed: true };

        case 'addTeamMember':
          if (usage.teamMembersRemaining < amount) {
            return {
              allowed: false,
              reason: `Team member limit reached. You have ${usage.teamMembersUsed}/${tierConfig.maxTeamMembers} members.`,
              upgradeRequired: true,
              suggestedTier: SubscriptionTier.STUDIO,
              upgradeUrl: '/pricing'
            };
          }
          return { allowed: true };

        default:
          return {
            allowed: false,
            reason: `Unknown action: ${action}`
          };
      }
    } catch (error) {
      return {
        allowed: false,
        reason: 'Failed to check quota. Please try again.'
      };
    }
  }

  /**
   * Create Stripe checkout session for upgrade/downgrade
   */
  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse> {
    if (!auth.currentUser && !params.userId) {
      throw new Error('User must be authenticated');
    }

    const userId = params.userId || auth.currentUser!.uid;

    try {
      const functions = getFunctions();
      const createSessionFn = httpsCallable(functions, 'createCheckoutSession');

      const result = await createSessionFn(params);
      return result.data as CheckoutSessionResponse;
    } catch (error) {
      throw new Error('Failed to create checkout session. Please try again.');
    }
  }

  /**
   * Get customer portal URL for managing subscription
   */
  async getCustomerPortalUrl(returnUrl: string): Promise<{ url: string }> {
    if (!auth.currentUser) {
      throw new Error('User must be authenticated');
    }

    try {
      const functions = getFunctions();
      const getPortalFn = httpsCallable(functions, 'getCustomerPortal');

      const result = await getPortalFn({
        userId: auth.currentUser.uid,
        returnUrl
      });
      return result.data as { url: string };
    } catch (error) {
      throw new Error('Failed to access customer portal. Please try again.');
    }
  }

  /**
   * Cancel subscription at end of current billing period
   */
  async cancelSubscription(userId?: string): Promise<void> {
    const targetUserId = userId || auth.currentUser?.uid;
    if (!targetUserId) {
      throw new Error('User must be authenticated');
    }

    try {
      const functions = getFunctions();
      const cancelFn = httpsCallable(functions, 'cancelSubscription');

      await cancelFn({ userId: targetUserId });

      // Invalidate cache
      this.subscriptionCache.delete(targetUserId);
      cacheService.invalidate(`subscription:${targetUserId}`);
    } catch (error) {
      throw new Error('Failed to cancel subscription. Please try again.');
    }
  }

  /**
   * Resume cancelled subscription
   */
  async resumeSubscription(userId?: string): Promise<void> {
    const targetUserId = userId || auth.currentUser?.uid;
    if (!targetUserId) {
      throw new Error('User must be authenticated');
    }

    try {
      const functions = getFunctions();
      const resumeFn = httpsCallable(functions, 'resumeSubscription');

      await resumeFn({ userId: targetUserId });

      // Invalidate cache
      this.subscriptionCache.delete(targetUserId);
      cacheService.invalidate(`subscription:${targetUserId}`);
    } catch (error) {
      throw new Error('Failed to resume subscription. Please try again.');
    }
  }

  /**
   * Get usage warnings for UI notifications
   */
  async getUsageWarnings(userId?: string): Promise<UsageWarning[]> {
    const targetUserId = userId || auth.currentUser?.uid;
    if (!targetUserId) {
      return [];
    }

    const warnings: UsageWarning[] = [];
    const usage = await this.getUsageStats(targetUserId);
    const tierConfig = getTierConfig(usage.tier);

    // Skip for studio tier
    if (usage.tier === SubscriptionTier.STUDIO) {
      return warnings;
    }

    // Image usage warnings
    const imagePercentage = (usage.imagesGenerated / tierConfig.imageGenerations.monthly) * 100;
    if (imagePercentage >= 100) {
      warnings.push({
        type: 'image',
        level: UsageWarningLevel.EXCEEDED,
        message: 'Image quota exceeded. Upgrade to continue generating images.',
        percentage: imagePercentage,
        upgradeUrl: '/pricing',
        dismissible: false
      });
    } else if (imagePercentage >= 85) {
      warnings.push({
        type: 'image',
        level: UsageWarningLevel.CRITICAL,
        message: `You've used ${usage.imagesGenerated}/${tierConfig.imageGenerations.monthly} images. Only ${usage.imagesRemaining} remaining.`,
        percentage: imagePercentage,
        upgradeUrl: '/pricing',
        dismissible: true
      });
    } else if (imagePercentage >= 70) {
      warnings.push({
        type: 'image',
        level: UsageWarningLevel.HIGH,
        message: `${usage.imagesRemaining} image generations remaining this month.`,
        percentage: imagePercentage,
        dismissible: true
      });
    }

    // Video usage warnings
    const videoPercentage = (usage.videoDurationMinutes / tierConfig.videoGenerations.totalDurationMinutes) * 100;
    if (videoPercentage >= 100) {
      warnings.push({
        type: 'video',
        level: UsageWarningLevel.EXCEEDED,
        message: 'Video quota exceeded. Upgrade to continue generating videos.',
        percentage: videoPercentage,
        upgradeUrl: '/pricing',
        dismissible: false
      });
    } else if (videoPercentage >= 85) {
      warnings.push({
        type: 'video',
        level: UsageWarningLevel.CRITICAL,
        message: `You've used ${usage.videoDurationMinutes}/${tierConfig.videoGenerations.totalDurationMinutes} minutes of video. Only ${usage.videoRemainingMinutes} minutes remaining.`,
        percentage: videoPercentage,
        upgradeUrl: '/pricing',
        dismissible: true
      });
    }

    // Chat tokens warning
    const chatPercentage = (usage.aiChatTokensUsed / tierConfig.aiChat.tokensPerMonth) * 100;
    if (chatPercentage >= 100) {
      warnings.push({
        type: 'chat',
        level: UsageWarningLevel.EXCEEDED,
        message: 'AI chat quota exceeded. Upgrade your plan for more tokens.',
        percentage: chatPercentage,
        upgradeUrl: '/pricing',
        dismissible: false
      });
    } else if (chatPercentage >= 90) {
      warnings.push({
        type: 'chat',
        level: UsageWarningLevel.CRITICAL,
        message: `${usage.aiChatTokensRemaining} tokens remaining for AI chat this month.`,
        percentage: chatPercentage,
        upgradeUrl: '/pricing',
        dismissible: true
      });
    }

    // Storage warning
    const storagePercentage = (usage.storageUsedGB / tierConfig.storage.totalGB) * 100;
    if (storagePercentage >= 100) {
      warnings.push({
        type: 'storage',
        level: UsageWarningLevel.EXCEEDED,
        message: 'Storage quota exceeded. Delete files or upgrade your plan.',
        percentage: storagePercentage,
        upgradeUrl: '/pricing',
        dismissible: false
      });
    } else if (storagePercentage >= 85) {
      warnings.push({
        type: 'storage',
        level: UsageWarningLevel.CRITICAL,
        message: `Storage nearly full (${usage.storageUsedGB}/${tierConfig.storage.totalGB} GB). Only ${usage.storageRemainingGB} GB remaining.`,
        percentage: storagePercentage,
        upgradeUrl: '/pricing',
        dismissible: true
      });
    }

    return warnings;
  }

  /**
   * Clear local cache
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.subscriptionCache.delete(userId);
      this.usageCache.delete(userId);
      cacheService.invalidate(`subscription:${userId}`);
    } else {
      this.subscriptionCache.clear();
      this.usageCache.clear();
      cacheService.invalidatePattern('subscription:');
    }
  }

  /**
   * Invalidate usage cache after tracking usage
   */
  invalidateUsageCache(userId: string): void {
    this.usageCache.delete(userId);
    cacheService.invalidate(`usage:${userId}`);
  }
}

export const subscriptionService = new SubscriptionService();

if (import.meta.env.DEV) {
  (window as any).subscriptionService = subscriptionService;
}
