/**
 * Cost Control Service — Universal Workflow for All Agents
 *
 * MANDATORY: Call this before ANY expensive operation:
 * - Video generation (Vertex Autonomous Veo)
 * - Image generation (Imagen)
 * - Agent streaming (Gemini)
 *
 * This prevents runaway costs by enforcing hard budgets at the client level.
 * Server-side enforcement in enforceOperationCost Cloud Function provides the kill-switch.
 */

import { db, auth, functions } from '@/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';
import { isAnonymousOrDemoUser, isDemoUserId } from '@/utils/authGuards';

export type OperationType = 'video' | 'image' | 'agent_stream';
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

interface BudgetLimits {
  daily: number;
  monthly: number;
  hourly: number;
}

const BUDGET_LIMITS: Record<UserTier, BudgetLimits> = {
  free: { daily: 5, monthly: 50, hourly: 1 },
  pro: { daily: 25, monthly: 250, hourly: 5 },
  enterprise: { daily: 100, monthly: 1000, hourly: 20 },
};

type ServerCostCheckResponse = Partial<CostCheckResponse> & {
  allowed: boolean;
};

export class CostControlService {
  private static get isE2EMode(): boolean {
    return isFirebaseE2EMockEnabled();
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
  }> {
    try {
      const isoString = new Date().toISOString();
      const today = (isoString.split('T')[0] as string) || isoString;
      const month = today.slice(0, 7);

      const dailyRef = doc(db, 'costLedger', `daily-${today}`);
      const monthlyRef = doc(db, 'costLedger', `monthly-${month}`);
      const userRef = doc(db, 'users', userId);

      const [dailySnap, monthlySnap, userSnap] = await Promise.all([
        getDoc(dailyRef),
        getDoc(monthlyRef),
        getDoc(userRef),
      ]);

      const dailyUsed = dailySnap.exists() ? (dailySnap.data()?.totalCost || 0) : 0;
      const monthlyUsed = monthlySnap.exists() ? (monthlySnap.data()?.totalCost || 0) : 0;
      const tier: UserTier = userSnap.exists() ? (userSnap.data()?.tier || 'free') : 'free';

      const limits = BUDGET_LIMITS[tier];

      return {
        dailyUsed,
        monthlyUsed,
        dailyRemaining: limits.daily - dailyUsed,
        monthlyRemaining: limits.monthly - monthlyUsed,
        tier,
      };
    } catch (err) {
      logger.error('[CostControl] Status fetch failed', err);
      return {
        dailyUsed: 0,
        monthlyUsed: 0,
        dailyRemaining: 0,
        monthlyRemaining: 0,
        tier: 'free',
      };
    }
  }
}
