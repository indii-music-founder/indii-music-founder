/**
 * Cost Control Service — Universal Workflow for All Agents
 *
 * MANDATORY: Call this before ANY expensive operation:
 * - Video generation (Vertex Autonomous Veo)
 * - Image generation (Imagen)
 * - Audio generation (Gemini TTS)
 * - Agent streaming (Gemini)
 *
 * This prevents runaway costs by enforcing hard budgets at the client level.
 * Server-side enforcement in enforceOperationCost Cloud Function provides the kill-switch.
 */

import { auth, functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { logger } from '@/utils/logger';
import { isTestHarnessRuntime } from '@/utils/e2eMode';
import { isAnonymousOrDemoUser, isDemoUserId } from '@/utils/authGuards';

export type OperationType = 'video' | 'image' | 'audio' | 'agent_stream';
export type UserTier = 'free' | 'pro' | 'enterprise';

export interface CostCheckRequest {
  operationType: OperationType;
  estimatedCost: number;
  userId: string;
  metadata?: Record<string, unknown>;
  forceBypass?: boolean;
}

export interface CostCheckResponse {
  allowed: boolean;
  requiresConfirmation?: boolean;
  reason?: string;
  remainingBudget: number;
  dailyUsed: number;
  monthlyUsed: number;
  operationId?: string;
}

export interface CostOperationHistoryCursor {
  timestampMs: number;
  operationId: string;
}

export interface CostOperationHistoryItem {
  operationId: string;
  operationType: OperationType | 'unknown';
  status: 'APPROVED' | 'SETTLED' | 'VOIDED' | 'UNKNOWN';
  estimatedCost: number;
  createdAt: string | null;
  finalizedAt: string | null;
  autoReleaseAt: string | null;
  resolution: 'pending_auto_release' | 'settled' | 'refunded' | 'unknown';
}

export interface CostOperationHistoryResponse {
  operations: CostOperationHistoryItem[];
  nextCursor: CostOperationHistoryCursor | null;
  hasMore: boolean;
}

const finiteNumberOrZero = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

type ServerCostCheckResponse = Partial<CostCheckResponse> & {
  allowed: boolean;
};

export class CostControlService {
  private static get isE2EMode(): boolean {
    return isTestHarnessRuntime();
  }

  /**
   * Check if an operation is allowed under current budget.
   * MUST be called before any expensive API operation.
   *
   * Returns { allowed: true } if within budget.
   * Returns { allowed: false, reason: "..." } if operation would exceed limit.
   *
   * Fail-secure: If ledger is unavailable, blocks the operation.
   */
  static async checkAndReserve(req: CostCheckRequest): Promise<CostCheckResponse> {
    // E2E BYPASS: Allow E2E mock runs to proceed without checking/writing to Firestore ledgers
    if (this.isE2EMode) {
      if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') {
        logger.error('[CostControl] CRITICAL: E2E Bypass attempted in production mode. Failing closed.');
        return {
          allowed: false,
          reason: 'E2E Cost Bypass is strictly blocked in production.',
          remainingBudget: 0,
          dailyUsed: 0,
          monthlyUsed: 0,
        };
      }
      return {
        allowed: true,
        remainingBudget: 1000,
        dailyUsed: 0,
        monthlyUsed: 0,
        operationId: `e2e-${Date.now()}`
      };
    }

    if (import.meta.env.VITE_INTELLIGENCE_MOCK_MODE === 'true') {
      return {
        allowed: false,
        reason: 'VITE_INTELLIGENCE_MOCK_MODE=true is no longer supported. Configure live billing/cost ledgers.',
        remainingBudget: 0,
        dailyUsed: 0,
        monthlyUsed: 0,
      };
    }

    const user = auth.currentUser;
    const isGuestSession = isAnonymousOrDemoUser(user) || isDemoUserId(req.userId);
    if (isGuestSession) {
      logger.warn('[CostControl] Guest / unauthenticated session blocked. Cost ledger requires a real authenticated user.');
      return {
        allowed: false,
        reason: 'Authenticated user is required for cost-controlled operations.',
        remainingBudget: 0,
        dailyUsed: 0,
        monthlyUsed: 0,
      };
    }

    try {
      if (!functions) {
        throw new Error('Firebase Functions us-central1 client is unavailable.');
      }
      const enforceOperationCost = httpsCallable<CostCheckRequest, ServerCostCheckResponse>(
        functions,
        'enforceOperationCost',
      );
      const result = await enforceOperationCost({
        ...req,
        userId: user?.uid || req.userId,
        metadata: {
          ...(req.metadata || {}),
          isTest: req.metadata?.isTest === true || import.meta.env.VITE_TEST_MODE === 'true',
        },
      });
      const data = result.data;

      logger.info('[CostControl] Server reservation completed', {
        userId: req.userId,
        operationType: req.operationType,
        estimatedCost: req.estimatedCost,
        allowed: data.allowed,
        operationId: data.operationId,
      });

      return {
        allowed: data.allowed,
        requiresConfirmation: data.requiresConfirmation,
        reason: data.reason,
        remainingBudget: data.remainingBudget ?? 0,
        dailyUsed: data.dailyUsed ?? 0,
        monthlyUsed: data.monthlyUsed ?? 0,
        operationId: data.operationId,
      };
    } catch (err) {
      logger.error('[CostControl] Check failed', err);

      // Permission/auth failures block the operation so spend is never untracked.
      const errMsg = err instanceof Error ? err.message : String(err);
      const lowerMsg = errMsg.toLowerCase();
      const isPermissionError = lowerMsg.includes('permission') || 
                                lowerMsg.includes('unauthorized') ||
                                lowerMsg.includes('unauthenticated') ||
                                lowerMsg.includes('forbidden') ||
                                lowerMsg.includes('appcheck') ||
                                lowerMsg.includes('app-check') ||
                                lowerMsg.includes('auth');

      if (isPermissionError) {
        logger.warn('[CostControl] Permission/Auth error on server cost reservation. Blocking operation.', err);
        return {
          allowed: false,
          reason: 'Cost ledger permission/auth check failed. Operation blocked to prevent untracked spend.',
          remainingBudget: 0,
          dailyUsed: 0,
          monthlyUsed: 0,
        };
      }

      // Fail-closed in every runtime. Local development must use the E2E harness
      // or a real cost ledger so spend is never silently untracked.
      if (import.meta.env.DEV) {
        // ALLOW bypass only in explicit E2E environments.
        if (import.meta.env.VITE_E2E_MOCK === 'true' || import.meta.env.VITE_PLAYWRIGHT_E2E === 'true') {
          logger.warn('[CostControl] Local dev cost ledger unavailable. Bypassing because E2E mock mode is present.');
          return {
            allowed: true,
            reason: 'Bypassed cost control: E2E environment detected.',
            remainingBudget: 999999,
            dailyUsed: 0,
            monthlyUsed: 0,
          };
        }

        logger.warn('[CostControl] Local dev cost ledger unavailable. Blocking operation.');
        return {
          allowed: false,
          reason: 'Cost control ledger unavailable. Run an explicit VITE_E2E test harness or configure Firestore.',
          remainingBudget: 0,
          dailyUsed: 0,
          monthlyUsed: 0,
        };
      }

      // FAIL-SECURE in production: If ledger is unavailable, block the operation
      // This prevents cost overruns if Firestore is down
      logger.error('[CostControl] Fail-secure triggered: blocking operation.');
      return {
        allowed: false,
        reason: 'Cost control system unavailable. Operation blocked for safety.',
        remainingBudget: 0,
        dailyUsed: 0,
        monthlyUsed: 0,
      };
    }
  }

  static async finalize(operationId: string, outcome: 'SETTLED' | 'VOIDED'): Promise<void> {
    if (this.isE2EMode) return;
    if (!functions) throw new Error('Firebase Functions us-central1 client is unavailable.');
    const finalizeOperationCost = httpsCallable<
      { operationId: string; outcome: 'SETTLED' | 'VOIDED' },
      { success: boolean }
    >(functions, 'finalizeOperationCost');
    await finalizeOperationCost({ operationId, outcome });
  }

  /**
   * Get current cost status (read-only, no reservation).
   * Useful for UI to show remaining budget.
   */
  static async getStatus(userId: string): Promise<{
    dailyUsed: number;
    monthlyUsed: number;
    dailyRemaining: number;
    monthlyRemaining: number;
    tier: UserTier;
    pendingHoldCost: number;
    pendingHoldCount: number;
    settledCost: number;
    voidedCost: number;
  }> {
    try {
      if (!functions || auth.currentUser?.uid !== userId) throw new Error('Authenticated owner is required for cost status');
      const getOperationCostStatus = httpsCallable<undefined, {
        dailyUsed: number; monthlyUsed: number; dailyRemaining: number; monthlyRemaining: number;
        tier: UserTier; pendingHoldCost: number; pendingHoldCount: number; settledCost: number; voidedCost: number;
      }>(functions, 'getOperationCostStatus');
      const result = await getOperationCostStatus();
      const data = result.data as Partial<typeof result.data>;
      return {
        dailyUsed: finiteNumberOrZero(data.dailyUsed),
        monthlyUsed: finiteNumberOrZero(data.monthlyUsed),
        dailyRemaining: finiteNumberOrZero(data.dailyRemaining),
        monthlyRemaining: finiteNumberOrZero(data.monthlyRemaining),
        tier: data.tier === 'pro' || data.tier === 'enterprise' ? data.tier : 'free',
        pendingHoldCost: finiteNumberOrZero(data.pendingHoldCost),
        pendingHoldCount: finiteNumberOrZero(data.pendingHoldCount),
        settledCost: finiteNumberOrZero(data.settledCost),
        voidedCost: finiteNumberOrZero(data.voidedCost),
      };
    } catch (err) {
      logger.error('[CostControl] Status fetch failed', err);
      return {
        dailyUsed: 0,
        monthlyUsed: 0,
        dailyRemaining: 0,
        monthlyRemaining: 0,
        tier: 'free',
        pendingHoldCost: 0,
        pendingHoldCount: 0,
        settledCost: 0,
        voidedCost: 0,
      };
    }
  }

  static async getHistory(
    userId: string,
    cursor: CostOperationHistoryCursor | null = null,
    limit = 5,
  ): Promise<CostOperationHistoryResponse> {
    try {
      if (!functions || auth.currentUser?.uid !== userId) {
        throw new Error('Authenticated owner is required for cost history');
      }
      const getOperationCostHistory = httpsCallable<
        { cursor: CostOperationHistoryCursor | null; limit: number },
        CostOperationHistoryResponse
      >(functions, 'getOperationCostHistory');
      const result = await getOperationCostHistory({ cursor, limit });
      const data = result.data as Partial<CostOperationHistoryResponse>;
      return {
        operations: Array.isArray(data.operations) ? data.operations : [],
        nextCursor: data.nextCursor ?? null,
        hasMore: data.hasMore === true,
      };
    } catch (err) {
      logger.error('[CostControl] History fetch failed', err);
      return { operations: [], nextCursor: null, hasMore: false };
    }
  }
}
