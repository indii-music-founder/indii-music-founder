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

import { db, auth } from '@/services/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { isFirebaseE2EMockEnabled } from '@/utils/e2eMode';

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

const RUNAWAY_LIMIT = 500; // Global kill-switch: no account can exceed $500/month
const TEST_MODE_DAILY_LIMIT = 5; // Testing should never cost more than $5/day total

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
    const isGuestSession = !user || user.uid === 'founder-demo-uid' || user.isAnonymous || req.userId === 'founder-demo-uid';
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

    const timestamp = new Date();
    const isoString = timestamp.toISOString();
    const today = (isoString.split('T')[0] as string) || isoString;
    const month = today.slice(0, 7);
    const hour = isoString.slice(0, 13);

    try {
      // 1. Fetch daily ledger (create if missing)
      const dailyRef = doc(db, 'costLedger', `daily-${today}`);
      const dailySnap = await getDoc(dailyRef);

      let dailyUsed = 0;
      if (dailySnap.exists()) {
        dailyUsed = dailySnap.data()?.totalCost || 0;
      } else {
        // Initialize daily ledger
        await setDoc(dailyRef, {
          date: today,
          totalCost: 0,
          operationCount: 0,
          videoSeconds: 0,
          imageCount: 0,
          lastUpdated: Timestamp.now(),
        });
      }

      // 2. Fetch monthly ledger (create if missing)
      const monthlyRef = doc(db, 'costLedger', `monthly-${month}`);
      const monthlySnap = await getDoc(monthlyRef);

      let monthlyUsed = 0;
      if (monthlySnap.exists()) {
        monthlyUsed = monthlySnap.data()?.totalCost || 0;
      } else {
        // Initialize monthly ledger
        await setDoc(monthlyRef, {
          month,
          totalCost: 0,
          operationCount: 0,
          status: 'ACTIVE',
          lastUpdated: Timestamp.now(),
        });
      }

      // 3. Fetch hourly ledger (for rate limiting)
      const hourlyRef = doc(db, 'costLedger', `hourly-${hour}`);
      const hourlySnap = await getDoc(hourlyRef);
      let hourlyUsed = 0;
      if (hourlySnap.exists()) {
        hourlyUsed = hourlySnap.data()?.totalCost || 0;
      }

      // 4. Fetch user tier
      const userRef = doc(db, 'users', req.userId);
      const userSnap = await getDoc(userRef);
      const userTier: UserTier = userSnap.exists()
        ? (userSnap.data()?.tier || 'free')
        : 'free';

      const limits = BUDGET_LIMITS[userTier];

      // 4.5 TEST MODE CHECK: Enforce strict testing budget
      // Testing should never cost more than $5/day total to prevent accidental expensive tests
      const isTestMode = req.metadata?.isTest === true || import.meta.env.VITE_TEST_MODE === 'true';
      if (isTestMode) {
        const testLedgerRef = doc(db, 'costLedger', `test-${today}`);
        const testSnap = await getDoc(testLedgerRef);
        const testDailyUsed = testSnap.exists() ? (testSnap.data()?.totalCost || 0) : 0;

        if (testDailyUsed + req.estimatedCost > TEST_MODE_DAILY_LIMIT) {
          logger.warn('[CostControl] TEST_MODE budget exceeded', {
            userId: req.userId,
            operationType: req.operationType,
            testDailyUsed,
            estimatedCost: req.estimatedCost,
            limit: TEST_MODE_DAILY_LIMIT,
          });

          if (!req.forceBypass) {
            return {
              allowed: false,
              requiresConfirmation: true,
              reason: `Testing budget exceeded ($${TEST_MODE_DAILY_LIMIT}/day). Used: $${testDailyUsed.toFixed(2)}, requested: $${req.estimatedCost.toFixed(2)}. Do you want to proceed and bypass this safety limit?`,
              remainingBudget: Math.max(0, TEST_MODE_DAILY_LIMIT - testDailyUsed),
              dailyUsed: testDailyUsed,
              monthlyUsed: 0,
            };
          }
        }
      }

      // 5. RUNAWAY KILL-SWITCH: Global $500/month hard limit
      if (monthlyUsed + req.estimatedCost > RUNAWAY_LIMIT) {
        logger.warn('[CostControl] RUNAWAY_KILL_SWITCH triggered', {
          userId: req.userId,
          operationType: req.operationType,
          monthlyUsed,
          estimatedCost: req.estimatedCost,
          limit: RUNAWAY_LIMIT,
        });

        // Log incident
        const incidentRef = doc(db, 'incidents', `runaway-${Date.now()}`);
        await setDoc(incidentRef, {
          type: 'RUNAWAY_KILLED',
          userId: req.userId,
          operationType: req.operationType,
          projectedCost: monthlyUsed + req.estimatedCost,
          limit: RUNAWAY_LIMIT,
          timestamp: Timestamp.now(),
          action: 'BLOCKED',
          metadata: req.metadata,
        });

        return {
          allowed: false,
          reason: `RUNAWAY_PROTECTION: Monthly cost ($${monthlyUsed.toFixed(2)}) + operation ($${req.estimatedCost.toFixed(2)}) exceeds global limit ($${RUNAWAY_LIMIT})`,
          remainingBudget: 0,
          dailyUsed,
          monthlyUsed,
        };
      }

      // 6. Check daily budget
      if (dailyUsed + req.estimatedCost > limits.daily) {
        logger.warn('[CostControl] Daily budget exceeded', {
          userId: req.userId,
          operationType: req.operationType,
          dailyUsed,
          estimatedCost: req.estimatedCost,
          limit: limits.daily,
        });

        return {
          allowed: false,
          reason: `Daily budget exceeded. Used: $${dailyUsed.toFixed(2)}/${limits.daily}, requested: $${req.estimatedCost.toFixed(2)}`,
          remainingBudget: Math.max(0, limits.daily - dailyUsed),
          dailyUsed,
          monthlyUsed,
        };
      }

      // 7. Check monthly budget
      if (monthlyUsed + req.estimatedCost > limits.monthly) {
        logger.warn('[CostControl] Monthly budget exceeded', {
          userId: req.userId,
          operationType: req.operationType,
          monthlyUsed,
          estimatedCost: req.estimatedCost,
          limit: limits.monthly,
        });

        return {
          allowed: false,
          reason: `Monthly budget exceeded. Used: $${monthlyUsed.toFixed(2)}/${limits.monthly}, requested: $${req.estimatedCost.toFixed(2)}`,
          remainingBudget: Math.max(0, limits.monthly - monthlyUsed),
          dailyUsed,
          monthlyUsed,
        };
      }

      // 8. Check hourly rate limit (5 ops per hour for free tier, no limit for pro/enterprise)
      const hourlyLimit = userTier === 'free' ? 5 : userTier === 'pro' ? 20 : Infinity;
      if (hourlySnap.exists() && hourlySnap.data()?.operationCount >= hourlyLimit) {
        logger.warn('[CostControl] Hourly rate limit exceeded', {
          userId: req.userId,
          operationType: req.operationType,
          hourlyOps: hourlySnap.data()?.operationCount,
          limit: hourlyLimit,
        });

        return {
          allowed: false,
          reason: `Hourly rate limit (${hourlyLimit}/hour) exceeded for ${userTier} tier`,
          remainingBudget: limits.daily - dailyUsed,
          dailyUsed,
          monthlyUsed,
        };
      }

      // 8.5 UI CONFIRMATION & HIGH COST SAFEGUARD
      const USER_CONFIRMATION_THRESHOLD = 20; // $20
      const TEST_CONFIRMATION_THRESHOLD = 2; // $2
      const threshold = isTestMode ? TEST_CONFIRMATION_THRESHOLD : USER_CONFIRMATION_THRESHOLD;

      if (req.estimatedCost >= threshold && !req.forceBypass) {
        logger.warn(`[CostControl] High cost operation detected ($${req.estimatedCost}), requesting confirmation`);
        return {
          allowed: false,
          requiresConfirmation: true,
          reason: `This operation will cost $${req.estimatedCost.toFixed(2)}, which exceeds the automatic approval threshold of $${threshold.toFixed(2)}.`,
          remainingBudget: limits.daily - dailyUsed,
          dailyUsed,
          monthlyUsed,
        };
      }

      // 9. APPROVED: Update ledgers atomically
      const operationId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Update daily ledger
      await updateDoc(dailyRef, {
        totalCost: increment(req.estimatedCost),
        operationCount: increment(1),
        lastUpdated: Timestamp.now(),
      });

      // Update monthly ledger
      await updateDoc(monthlyRef, {
        totalCost: increment(req.estimatedCost),
        operationCount: increment(1),
        lastUpdated: Timestamp.now(),
      });

      // Update hourly ledger
      if (hourlySnap.exists()) {
        await updateDoc(hourlyRef, {
          totalCost: increment(req.estimatedCost),
          operationCount: increment(1),
          lastUpdated: Timestamp.now(),
        });
      } else {
        await setDoc(hourlyRef, {
          hour,
          totalCost: req.estimatedCost,
          operationCount: 1,
          lastUpdated: Timestamp.now(),
        });
      }

      // Track test spending separately if in test mode
      if (isTestMode) {
        const testLedgerRef = doc(db, 'costLedger', `test-${today}`);
        const testLedgerSnap = await getDoc(testLedgerRef);
        if (testLedgerSnap.exists()) {
          await updateDoc(testLedgerRef, {
            totalCost: increment(req.estimatedCost),
            operationCount: increment(1),
            lastUpdated: Timestamp.now(),
          });
        } else {
          await setDoc(testLedgerRef, {
            date: today,
            totalCost: req.estimatedCost,
            operationCount: 1,
            lastUpdated: Timestamp.now(),
          });
        }
      }

      // Log operation
      const opRef = doc(db, 'costLedger', operationId);
      await setDoc(opRef, {
        operationId,
        type: req.operationType,
        userId: req.userId,
        userTier,
        estimatedCost: req.estimatedCost,
        status: 'APPROVED',
        isTest: isTestMode,
        timestamp: Timestamp.now(),
        metadata: req.metadata || {},
      });

      logger.info('[CostControl] Operation approved', {
        operationId,
        userId: req.userId,
        operationType: req.operationType,
        estimatedCost: req.estimatedCost,
        remainingDaily: limits.daily - (dailyUsed + req.estimatedCost),
        remainingMonthly: limits.monthly - (monthlyUsed + req.estimatedCost),
      });

      return {
        allowed: true,
        remainingBudget: limits.daily - (dailyUsed + req.estimatedCost),
        dailyUsed: dailyUsed + req.estimatedCost,
        monthlyUsed: monthlyUsed + req.estimatedCost,
        operationId,
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
        logger.warn('[CostControl] Permission/Auth error on costLedger read/write. Blocking operation.', err);
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
