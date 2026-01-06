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
    record: Omit<UsageRecord, 'id' | 'userId' | 'subscriptionId' | 'timestamp'>
  ): Promise<void> {
    try {
      const trackUsageFn = httpsCallable(functions, 'trackUsage');

      await trackUsageFn({
        userId,
        ...record,
        timestamp: Date.now()
      });
    } catch (error) {
      // Non-blocking error - usage tracking failure should not disrupt user experience
    }
  }
}

export const usageTracker = new UsageTracker();
