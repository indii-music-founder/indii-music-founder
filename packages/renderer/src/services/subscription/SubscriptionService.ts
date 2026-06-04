/**
 * Subscription Management Service
 *
 * Handles all subscription-related operations including:
 * - Tier management and upgrades/downgrades
 * - Quota checking
 * - Usage tracking
 * - Stripe checkout sessions
 */

import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/services/firebase';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import {
  UsageWarningLevel
} from './types';
import type {
  Subscription,
  UsageStats,
  QuotaCheckResult,
  CheckoutSessionParams,
  CheckoutSessionResponse,
  UsageWarning
} from './types';
import { SubscriptionTier, getTierConfig } from './SubscriptionTier';
import { cacheService } from '@/services/cache/CacheService';
import { SubscriptionSchema, UsageStatsSchema } from './schemas';
import { logger } from '@/utils/logger';

export class SubscriptionService {
  private subscriptionCache: Map<string, { subscription: Subscription; timestamp: number }> = new Map();
  private usageCache: Map<string, { stats: UsageStats; timestamp: number }> = new Map();
  private inFlightSubscription: Map<string, Promise<Subscription>> = new Map();
  private inFlightUsage: Map<string, Promise<UsageStats>> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get current user's subscription
   */
  async getSubscription(userId: string, forceRefresh = false): Promise<Subscription> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (isFirebaseE2EMockEnabled()) {
      const now = Date.now();
      return {
        id: 'mock-subscription-123',
        userId,
        tier: SubscriptionTier.STUDIO,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now
      };
    }

    // Check cache
    if (!forceRefresh && this.subscriptionCache.has(userId)) {
      const cached = this.subscriptionCache.get(userId)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.subscription;
      }
    }

    // Check cache service
    const cached = cacheService.get<Subscription>(`subscription:${userId}`);
    if (cached && !forceRefresh) {
      this.subscriptionCache.set(userId, { subscription: cached, timestamp: Date.now() });
      return cached;
    }

    // Deduplicate in-flight requests
    if (this.inFlightSubscription.has(userId)) {
      return this.inFlightSubscription.get(userId)!;
    }

    const fetchPromise = (async (): Promise<Subscription & { isFallback?: boolean }> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let lastError: any = null;
      const maxRetries = 3;
      const baseDelay = 500;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const getSubscriptionFn = httpsCallable(functions, 'getSubscription');

          const result = await getSubscriptionFn({ userId });

          // Zod Validation (Bolt Hardening)
          const parsed = SubscriptionSchema.safeParse(result.data);
          if (!parsed.success) {
            logger.error(`[SubscriptionService] Validation failed (Attempt ${attempt}):`, parsed.error);
            throw new Error("Received invalid subscription data from backend.");
          }

          const subscription: Subscription = parsed.data as Subscription;

          // Update caches
          this.subscriptionCache.set(userId, { subscription, timestamp: Date.now() });
          cacheService.set(`subscription:${userId}`, subscription, this.CACHE_TTL);

          return subscription;
        } catch (error: unknown) {
          lastError = error;
          const isNetworkError = error instanceof Error && 
            (error.message.includes('network-request-failed') || error.message.includes('Failed to fetch'));
          
          if (isNetworkError && attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            logger.warn(`[SubscriptionService] Network error fetching subscription (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // If not a network error or we're out of retries, break to the fail-closed error below.
          break;
        }
      }

      // If we're here, all retries failed or it was a non-retryable error
      logger.error("SubscriptionService.getSubscription failed after retries:", {
        error: lastError,
        userId,
        message: lastError instanceof Error ? lastError.message : String(lastError)
      });

      throw lastError instanceof Error
        ? lastError
        : new Error(`Failed to fetch subscription for ${userId}.`);
    })().finally(() => {
      this.inFlightSubscription.delete(userId);
    });

    this.inFlightSubscription.set(userId, fetchPromise);
    return fetchPromise;
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
    if (isFirebaseE2EMockEnabled()) {
      const tierConfig = getTierConfig(SubscriptionTier.STUDIO);
      return {
        userId,
        tier: SubscriptionTier.STUDIO,
        resetDate: Date.now() + (7 * 24 * 60 * 60 * 1000),
        imagesGenerated: 0,
        imagesRemaining: tierConfig.imageGenerations.monthly,
        imagesPerMonth: tierConfig.imageGenerations.monthly,
        videoDurationSeconds: 0,
        videoDurationMinutes: 0,
        videoRemainingMinutes: tierConfig.videoGenerations.totalDurationMinutes,
        videoTotalMinutes: tierConfig.videoGenerations.totalDurationMinutes,
        aiChatTokensUsed: 0,
        aiChatTokensRemaining: tierConfig.aiChat.tokensPerMonth,
        aiChatTokensPerMonth: tierConfig.aiChat.tokensPerMonth,
        storageUsedGB: 0,
        storageRemainingGB: tierConfig.storage.totalGB,
        storageTotalGB: tierConfig.storage.totalGB,
        projectsCreated: 0,
        projectsRemaining: tierConfig.maxProjects,
        maxProjects: tierConfig.maxProjects,
        teamMembersUsed: 0,
        teamMembersRemaining: tierConfig.maxTeamMembers,
        maxTeamMembers: tierConfig.maxTeamMembers,
        isFallback: true
      };
    }

    // Check cache
    if (!forceRefresh && this.usageCache.has(userId)) {
      const cached = this.usageCache.get(userId)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.stats;
      }
    }

    // Deduplicate in-flight requests
    if (this.inFlightUsage.has(userId)) {
      return this.inFlightUsage.get(userId)!;
    }

    const fetchPromise = (async (): Promise<UsageStats & { isFallback?: boolean }> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let lastError: any = null;
      const maxRetries = 3;
      const baseDelay = 500;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const getUsageStatsFn = httpsCallable(functions, 'getUsageStats');

          const result = await getUsageStatsFn({ userId });

          // Zod Validation (Bolt Hardening)
          const parsed = UsageStatsSchema.safeParse(result.data);
          if (!parsed.success) {
            logger.error(`[SubscriptionService] Usage stats validation failed (Attempt ${attempt}):`, parsed.error);
            throw new Error("Received invalid usage stats from backend.");
          }

          const stats: UsageStats = parsed.data as UsageStats;

          // Update cache
          this.usageCache.set(userId, { stats, timestamp: Date.now() });

          return stats;
        } catch (error: unknown) {
          lastError = error;
          const isNetworkError = error instanceof Error && 
            (error.message.includes('network-request-failed') || error.message.includes('Failed to fetch'));
          
          if (isNetworkError && attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1);
            logger.warn(`[SubscriptionService] Network error fetching usage stats (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // If not a network error or we're out of retries, break to fallback
          break;
        }
      }

      // If we're here, all retries failed or it was a non-retryable error
      logger.error("SubscriptionService.getUsageStats failed after retries:", {
        error: lastError,
        userId,
        message: lastError instanceof Error ? lastError.message : String(lastError)
      });

      // SAFE FALLBACK: Return empty FREE stats
      const tierConfig = getTierConfig(SubscriptionTier.FREE);
      const fallback: UsageStats & { isFallback: boolean } = {
        userId,
        tier: SubscriptionTier.FREE,
        resetDate: Date.now() + (7 * 24 * 60 * 60 * 1000),
        imagesGenerated: 0,
        imagesRemaining: tierConfig.imageGenerations.monthly,
        imagesPerMonth: tierConfig.imageGenerations.monthly,
        videoDurationSeconds: 0,
        videoDurationMinutes: 0,
        videoRemainingMinutes: tierConfig.videoGenerations.totalDurationMinutes,
        videoTotalMinutes: tierConfig.videoGenerations.totalDurationMinutes,
        aiChatTokensUsed: 0,
        aiChatTokensRemaining: tierConfig.aiChat.tokensPerMonth,
        aiChatTokensPerMonth: tierConfig.aiChat.tokensPerMonth,
        storageUsedGB: 0,
        storageRemainingGB: tierConfig.storage.totalGB,
        storageTotalGB: tierConfig.storage.totalGB,
        projectsCreated: 0,
        projectsRemaining: tierConfig.maxProjects,
        maxProjects: tierConfig.maxProjects,
        teamMembersUsed: 0,
        teamMembersRemaining: tierConfig.maxTeamMembers,
        maxTeamMembers: tierConfig.maxTeamMembers,
        isFallback: true
      };
      return fallback;
    })().finally(() => {
      this.inFlightUsage.delete(userId);
    });

    this.inFlightUsage.set(userId, fetchPromise);
    return fetchPromise;
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
    // GOD MODE: Bypass via custom claim
    if (auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
      try {
        const tokenResult = await auth.currentUser.getIdTokenResult();
        if (tokenResult?.claims?.god_mode === true) {
          if (action === 'generateVideo' && amount > 120) {
            logger.warn(`[SubscriptionService] God Mode blocked: single request too large (${amount}s)`);
            return { allowed: false, reason: 'God Mode blocked: Single generation request too large.' };
          }
          return { allowed: true };
        }
      } catch (e: unknown) {
        logger.warn('[SubscriptionService] Failed to check god_mode claim:', e);
      }
    }

    const targetUserId = userId || auth.currentUser?.uid;

    if (!targetUserId) {
      logger.warn(`[SubscriptionService] Blocked unauthenticated action (${action})`);
      return { allowed: false, reason: 'Authentication required for subscription quota checks.' };
    }

    try {
      // Add timeout protection to prevent hanging (5s timeout)
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Subscription check timeout')), 5000);
      });

      // Wrap individually so a single auth failure (401) doesn't abort the entire check.
      // If either call fails we fall through to graceful degradation below.
      const [subscriptionResult, usageResult] = await Promise.race([
        Promise.allSettled([
          this.getSubscription(targetUserId),
          this.getUsageStats(targetUserId)
        ]),
        timeoutPromise.then(() => [
          { status: 'rejected' as const, reason: new Error('timeout') },
          { status: 'rejected' as const, reason: new Error('timeout') },
        ])
      ]);

      if (timeoutId) clearTimeout(timeoutId);

      // If either call failed (auth error, network, etc.), block instead of granting unmetered access.
      if (subscriptionResult.status === 'rejected' || usageResult.status === 'rejected') {
        const reason = subscriptionResult.status === 'rejected'
          ? (subscriptionResult.reason instanceof Error ? subscriptionResult.reason.message : String(subscriptionResult.reason))
          : (usageResult.status === 'rejected' ? (usageResult.reason instanceof Error ? usageResult.reason.message : String(usageResult.reason)) : 'unknown');
        logger.warn(`[SubscriptionService] Pre-flight check failed (${reason}); blocking action.`);
        return { allowed: false, reason: `Subscription quota check failed: ${reason}` };
      }

      const [subscription, usage] = [subscriptionResult.value, usageResult.value] as [Subscription, UsageStats];

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

        case 'generateVideo': {
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
        }

        case 'chat':
          if (usage.aiChatTokensRemaining < amount) {
            return {
              allowed: false,
              reason: 'Intelligence chat token quota exceeded. Upgrade to continue using Intelligence chat.',
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
    } catch (error: unknown) {
      // GRACEFUL DEGRADATION: If subscription check fails (timeout, auth, network),
      // allow the action to proceed for demo experience. The backend will enforce limits.
      logger.warn('[SubscriptionService] Quota check failed, allowing action with graceful degradation:', error instanceof Error ? error.message : String(error));
      return { allowed: true };
    }
  }

  /**
   * Create Stripe checkout session for upgrade/downgrade
   */
  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResponse> {
    if (!auth.currentUser && !params.userId) {
      throw new Error('User must be authenticated');
    }

    try {
      const createSessionFn = httpsCallable(functions, 'createCheckoutSession');

      const result = await createSessionFn(params);
      return result.data as CheckoutSessionResponse;
    } catch (_error: unknown) {
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
      const getPortalFn = httpsCallable(functions, 'getCustomerPortal');

      const result = await getPortalFn({
        userId: auth.currentUser.uid,
        returnUrl
      });
      return result.data as { url: string };
    } catch (_error: unknown) {
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
      const cancelFn = httpsCallable(functions, 'cancelSubscription');

      await cancelFn({ userId: targetUserId });

      // Invalidate cache
      this.subscriptionCache.delete(targetUserId);
      cacheService.invalidate(`subscription:${targetUserId}`);
    } catch (_error: unknown) {
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
      const resumeFn = httpsCallable(functions, 'resumeSubscription');

      await resumeFn({ userId: targetUserId });

      // Invalidate cache
      this.subscriptionCache.delete(targetUserId);
      cacheService.invalidate(`subscription:${targetUserId}`);
    } catch (_error: unknown) {
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
        message: 'Intelligence chat quota exceeded. Upgrade your plan for more tokens.',
        percentage: chatPercentage,
        upgradeUrl: '/pricing',
        dismissible: false
      });
    } else if (chatPercentage >= 90) {
      warnings.push({
        type: 'chat',
        level: UsageWarningLevel.CRITICAL,
        message: `${usage.aiChatTokensRemaining} tokens remaining for Intelligence chat this month.`,
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
