import { logger } from '@/utils/logger';
/**
 * Usage Tracker Service
 *
 * Tracks and records usage for all actions that consume quota.
 * Works with the subscription system to enforce limits.
 */

import { UsageRecord } from './types';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { auth } from '@/services/firebase';

class UsageTracker {
  /**
   * Track image generation
   */
  async trackImageGeneration(userId: string, count: number = 1, metadata?: UsageRecord['metadata']): Promise<void> {
    await this.trackUsage(userId, {
      type: 'image',
      amount: count,
      metadata: {
        ...metadata,
        action: 'generate_image'
      }
    });
  }

  /**
   * Track video generation
   */
  async trackVideoGeneration(userId: string, durationSeconds: number, metadata?: UsageRecord['metadata']): Promise<void> {
    await this.trackUsage(userId, {
      type: 'video',
      amount: durationSeconds,
      metadata: {
        ...metadata,
        action: 'generate_video',
        duration: durationSeconds
      }
    });
  }

  /**
   * Track AI chat token usage
   */
  async trackChatTokens(userId: string, tokenCount: number, metadata?: UsageRecord['metadata']): Promise<void> {
    await this.trackUsage(userId, {
      type: 'chat_tokens',
      amount: tokenCount,
      metadata: {
        ...metadata,
        action: 'ai_chat'
      }
    });
  }

  /**
   * Track storage usage (in bytes)
   */
  async trackStorage(userId: string, bytes: number, path: string): Promise<void> {
    await this.trackUsage(userId, {
      type: 'storage',
      amount: bytes,
      metadata: {
        action: 'storage',
        path,
        fileSizeBytes: bytes
      }
    });
  }

  /**
   * Track export operation
   */
  async trackExport(userId: string, metadata?: UsageRecord['metadata']): Promise<void> {
    await this.trackUsage(userId, {
      type: 'export',
      amount: 1,
      metadata: {
        ...metadata,
        action: 'export'
      }
    });
  }

  /**
   * Generic usage tracking method
   */
  private async trackUsage(
    userId: string,
    record: Omit<UsageRecord, 'id' | 'userId' | 'subscriptionId' | 'timestamp'>,
    attempt: number = 0
  ): Promise<void> {
    try {
      const trackUsageFn = httpsCallable(functions, 'trackUsage');

      await trackUsageFn({
        userId,
        ...record,
        timestamp: Date.now()
      });
    } catch (error: unknown) {
      logger.error(`[UsageTracker] Error tracking usage (attempt ${attempt + 1}):`, error);

      const maxAttempts = 3;
      if (attempt < maxAttempts - 1) {
        // Exponential backoff with jitter: 1s, 2s, 4s + random 0-1s
        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        logger.debug(`[UsageTracker] Retrying in ${Math.round(backoffMs)}ms...`);

        // Fire and forget the retry
        setTimeout(() => {
          this.trackUsage(userId, record, attempt + 1).catch(e => {
            logger.error('[UsageTracker] Retry failed:', e);
          });
        }, backoffMs);
      } else {
        // Final failure log
        logger.error('[UsageTracker] Failed to track usage after max attempts:', error);
      }
    }
  }
}

export const usageTracker = new UsageTracker();
