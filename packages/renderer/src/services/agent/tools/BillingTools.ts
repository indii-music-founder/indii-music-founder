/**
 * BillingTools — Agent Budget Awareness
 *
 * Agents must call these tools before expensive operations:
 * - check_budget_status() → Check remaining budget and test mode status
 * - estimate_cost(type, params) → Get cost estimate before operation
 *
 * This prevents agents from blowing out budgets without asking first.
 * Test agents (VITE_TEST_MODE=true) are limited to $5/day total.
 */

import { CostControlService } from '@/services/billing/CostControlService';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';

export const BillingTools = {
  /**
   * Check current budget status for the user.
   * Returns: { dailyUsed, dailyRemaining, monthlyUsed, monthlyRemaining, tier, isTestMode, message }
   * Call this before attempting expensive operations.
   */
  check_budget_status: async (): Promise<{
    success: boolean;
    dailyUsed: number;
    dailyRemaining: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    tier: string;
    isTestMode: boolean;
    message: string;
  }> => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        return {
          success: true,
          dailyUsed: 0,
          dailyRemaining: 5,
          monthlyUsed: 0,
          monthlyRemaining: 50,
          tier: 'free',
          isTestMode: false,
          message: 'Not signed in. Using free tier limits ($5/day, $50/month).',
        };
      }

      const status = await CostControlService.getStatus(userId);
      const isTestMode = import.meta.env.VITE_TEST_MODE === 'true';

      return {
        success: true,
        ...status,
        isTestMode,
        message: isTestMode
          ? `🧪 TEST MODE ACTIVE. Budget: $${status.dailyRemaining.toFixed(2)} remaining today (${status.tier} tier). Test operations capped at $5/day.`
          : `Budget: $${status.dailyRemaining.toFixed(2)}/day, $${status.monthlyRemaining.toFixed(2)}/month (${status.tier} tier).`,
      };
    } catch (err) {
      logger.error('[BillingTools] Status check failed', err);
      return {
        success: false,
        dailyUsed: 0,
        dailyRemaining: 0,
        monthlyUsed: 0,
        monthlyRemaining: 0,
        tier: 'free',
        isTestMode: false,
        message: '⚠️ Budget check unavailable. Cannot proceed with expensive operations (fail-secure).',
      };
    }
  },

  /**
   * Estimate cost for an operation before executing it.
   * Types: 'video' | 'image' | 'agent_stream'
   *
   * Returns: { estimatedCost, willFit, warning, message }
   * - willFit=true if operation fits in current budget
   * - warning message if operation is expensive or approaching limit
   */
  estimate_cost: async (params: {
    operation_type: 'video' | 'image' | 'agent_stream';
    duration_seconds?: number;
    model?: 'fast' | 'pro';
    image_count?: number;
  }): Promise<{
    success: boolean;
    estimatedCost: number;
    willFit: boolean;
    warning?: string;
    message: string;
  }> => {
    try {
      const userId = auth.currentUser?.uid || 'founder-demo-uid';
      const status = await CostControlService.getStatus(userId);

      let estimatedCost = 0;
      let warningText = '';

      switch (params.operation_type) {
        case 'video': {
          const duration = params.duration_seconds || 8;
          const modelRate = (params.model || 'fast') === 'fast' ? 0.1 : 0.4;
          estimatedCost = duration * modelRate;

          if (estimatedCost > 2.0) {
            warningText = `⚠️ Expensive video operation: $${estimatedCost.toFixed(2)} (${duration}s at ${modelRate * 100}¢/sec)`;
          }
          break;
        }

        case 'image': {
          const count = params.image_count || 1;
          estimatedCost = count * 0.04;

          if (count > 5) {
            warningText = `ℹ️ Generating ${count} images ($0.04 each). Consider using fewer for testing.`;
          }
          break;
        }

        case 'agent_stream': {
          estimatedCost = 0.001; // Negligible cost
          break;
        }
      }

      const willFit = estimatedCost <= status.dailyRemaining;

      if (!willFit) {
        warningText = `❌ BLOCKED: Operation costs $${estimatedCost.toFixed(2)} but only $${status.dailyRemaining.toFixed(2)} remaining today. Request user approval or wait until tomorrow.`;
      } else if (estimatedCost > status.dailyRemaining * 0.5) {
        warningText = `⚠️ Warning: Operation ($${estimatedCost.toFixed(2)}) exceeds 50% of remaining daily budget ($${status.dailyRemaining.toFixed(2)}).`;
      }

      return {
        success: willFit,
        estimatedCost,
        willFit,
        warning: warningText || undefined,
        message: `Cost estimate: $${estimatedCost.toFixed(2)} (${willFit ? '✓ fits budget' : '✗ exceeds budget'})`,
      };
    } catch (err) {
      logger.error('[BillingTools] Cost estimation failed', err);
      return {
        success: false,
        estimatedCost: 0,
        willFit: false,
        warning: '⚠️ Cost estimation unavailable. Blocking operation (fail-secure).',
        message: 'Cannot estimate cost. Operation blocked for safety.',
      };
    }
  },
};
