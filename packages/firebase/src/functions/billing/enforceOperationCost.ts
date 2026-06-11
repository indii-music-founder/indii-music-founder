import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

type OperationType = 'video' | 'image' | 'agent_stream';

interface CostEnforcementRequest {
  operationType: OperationType;
  userId: string;
  estimatedCost: number;
  metadata?: Record<string, unknown>;
  forceBypass?: boolean;
}

interface CostEnforcementResponse {
  allowed: boolean;
  requiresConfirmation?: boolean;
  reason?: string;
  remainingBudget?: number;
  dailyUsed?: number;
  monthlyUsed?: number;
  operationId?: string;
}

/** Parameters for the reusable budget-check helper. */
export interface CheckOperationBudgetParams {
  userId: string;
  estimatedCost: number;
  operationType: OperationType;
  metadata?: Record<string, unknown>;
  forceBypass?: boolean;
}

const RUNAWAY_LIMIT = 500; // Global kill-switch: no account can exceed $500/month
const TEST_MODE_DAILY_LIMIT = 5; // Testing should never cost more than $5/day total
const USER_CONFIRMATION_THRESHOLD = 20; // $20
const TEST_CONFIRMATION_THRESHOLD = 2; // $2
const BUDGET_LIMITS: Record<string, { daily: number; monthly: number; hourly: number }> = {
  free: { daily: 5, monthly: 50, hourly: 1 },
  pro: { daily: 25, monthly: 250, hourly: 5 },
  enterprise: { daily: 100, monthly: 1000, hourly: 20 },
};

/**
 * Core budget-check logic (transport-agnostic).
 *
 * Extracted from the `enforceOperationCost` onCall wrapper so that background
 * triggers (e.g. Firestore onCreate functions like `processRelayCommand`)
 * can reuse the exact same daily/monthly ledger reads, user-tier lookup, the
 * RUNAWAY_LIMIT ($500/month) global kill-switch, and the daily/monthly limit
 * checks — without going through the HTTPS callable layer.
 *
 * Fail-secure: any error reading the ledger or user tier results in the
 * operation being blocked, never allowed.
 */
export async function checkOperationBudget(
  params: CheckOperationBudgetParams,
): Promise<CostEnforcementResponse> {
  const { userId, estimatedCost, operationType, metadata, forceBypass } = params;
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) {
    return {
      allowed: false,
      reason: 'Invalid estimated cost.',
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
  const isTestMode = metadata?.isTest === true;

  try {
    const db = admin.firestore();
    const dailyRef = db.doc(`costLedger/daily-${today}`);
    const monthlyRef = db.doc(`costLedger/monthly-${month}`);
    const hourlyRef = db.doc(`costLedger/hourly-${hour}`);
    const userRef = db.doc(`users/${userId}`);
    const testLedgerRef = db.doc(`costLedger/test-${today}`);

    return await db.runTransaction(async (tx) => {
      const [dailySnap, monthlySnap, hourlySnap, userSnap, testSnap] = await Promise.all([
        tx.get(dailyRef),
        tx.get(monthlyRef),
        tx.get(hourlyRef),
        tx.get(userRef),
        isTestMode ? tx.get(testLedgerRef) : Promise.resolve(undefined),
      ]);

      const dailyUsed = dailySnap.exists ? (dailySnap.data()?.totalCost || 0) : 0;
      const monthlyUsed = monthlySnap.exists ? (monthlySnap.data()?.totalCost || 0) : 0;
      const hourlyOps = hourlySnap.exists ? (hourlySnap.data()?.operationCount || 0) : 0;
      const testDailyUsed = testSnap?.exists ? (testSnap.data()?.totalCost || 0) : 0;
      const userTier = userSnap.exists ? (userSnap.data()?.tier || 'free') : 'free';
      const limits = BUDGET_LIMITS[userTier] || BUDGET_LIMITS.free;

      if (isTestMode && testDailyUsed + estimatedCost > TEST_MODE_DAILY_LIMIT && !forceBypass) {
        console.warn('[CostControl] TEST_MODE budget exceeded', {
          userId,
          operationType,
          testDailyUsed,
          estimatedCost,
          limit: TEST_MODE_DAILY_LIMIT,
        });

        return {
          allowed: false,
          requiresConfirmation: true,
          reason: `Testing budget exceeded ($${TEST_MODE_DAILY_LIMIT}/day). Used: $${testDailyUsed.toFixed(2)}, requested: $${estimatedCost.toFixed(2)}. Do you want to proceed and bypass this safety limit?`,
          remainingBudget: Math.max(0, TEST_MODE_DAILY_LIMIT - testDailyUsed),
          dailyUsed: testDailyUsed,
          monthlyUsed,
        };
      }

      if (monthlyUsed + estimatedCost > RUNAWAY_LIMIT) {
        const incidentRef = db.collection('incidents').doc(`runaway-${Date.now()}`);
        tx.set(incidentRef, {
          type: 'RUNAWAY_KILLED',
          userId,
          operationType,
          projectedCost: monthlyUsed + estimatedCost,
          limit: RUNAWAY_LIMIT,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          action: 'BLOCKED',
          metadata: metadata || {},
        });

        console.warn('[CostControl] RUNAWAY_KILL_SWITCH triggered', {
          userId,
          operationType,
          monthlyUsed,
          estimatedCost,
          limit: RUNAWAY_LIMIT,
        });

        return {
          allowed: false,
          reason: `RUNAWAY_PROTECTION: Monthly cost ($${monthlyUsed.toFixed(2)}) + operation ($${estimatedCost.toFixed(2)}) exceeds global limit ($${RUNAWAY_LIMIT})`,
          remainingBudget: 0,
          dailyUsed,
          monthlyUsed,
        };
      }

      if (dailyUsed + estimatedCost > limits.daily) {
        console.warn('[CostControl] Daily budget exceeded', {
          userId,
          operationType,
          dailyUsed,
          estimatedCost,
          limit: limits.daily,
        });

        return {
          allowed: false,
          reason: `Daily budget exceeded. Used: $${dailyUsed.toFixed(2)}/${limits.daily}, requested: $${estimatedCost.toFixed(2)}`,
          remainingBudget: Math.max(0, limits.daily - dailyUsed),
          dailyUsed,
          monthlyUsed,
        };
      }

      if (monthlyUsed + estimatedCost > limits.monthly) {
        console.warn('[CostControl] Monthly budget exceeded', {
          userId,
          operationType,
          monthlyUsed,
          estimatedCost,
          limit: limits.monthly,
        });

        return {
          allowed: false,
          reason: `Monthly budget exceeded. Used: $${monthlyUsed.toFixed(2)}/${limits.monthly}, requested: $${estimatedCost.toFixed(2)}`,
          remainingBudget: Math.max(0, limits.monthly - monthlyUsed),
          dailyUsed,
          monthlyUsed,
        };
      }

      const hourlyLimit = userTier === 'free' ? 5 : userTier === 'pro' ? 20 : Number.POSITIVE_INFINITY;
      if (hourlyOps >= hourlyLimit) {
        console.warn('[CostControl] Hourly rate limit exceeded', {
          userId,
          operationType,
          hourlyOps,
          limit: hourlyLimit,
        });

        return {
          allowed: false,
          reason: `Hourly rate limit (${hourlyLimit}/hour) exceeded for ${userTier} tier`,
          remainingBudget: Math.max(0, limits.daily - dailyUsed),
          dailyUsed,
          monthlyUsed,
        };
      }

      const threshold = isTestMode ? TEST_CONFIRMATION_THRESHOLD : USER_CONFIRMATION_THRESHOLD;
      if (estimatedCost >= threshold && !forceBypass) {
        console.warn(`[CostControl] High cost operation detected ($${estimatedCost}), requesting confirmation`);
        return {
          allowed: false,
          requiresConfirmation: true,
          reason: `This operation will cost $${estimatedCost.toFixed(2)}, which exceeds the automatic approval threshold of $${threshold.toFixed(2)}.`,
          remainingBudget: Math.max(0, limits.daily - dailyUsed),
          dailyUsed,
          monthlyUsed,
        };
      }

      const operationId = `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const increment = admin.firestore.FieldValue.increment;
      const now = admin.firestore.FieldValue.serverTimestamp();

      tx.set(dailyRef, {
        date: today,
        totalCost: increment(estimatedCost),
        operationCount: increment(1),
        videoSeconds: dailySnap.exists ? dailySnap.data()?.videoSeconds || 0 : 0,
        imageCount: dailySnap.exists ? dailySnap.data()?.imageCount || 0 : 0,
        lastUpdated: now,
      }, { merge: true });

      tx.set(monthlyRef, {
        month,
        totalCost: increment(estimatedCost),
        operationCount: increment(1),
        status: monthlySnap.exists ? monthlySnap.data()?.status || 'ACTIVE' : 'ACTIVE',
        lastUpdated: now,
      }, { merge: true });

      tx.set(hourlyRef, {
        hour,
        totalCost: increment(estimatedCost),
        operationCount: increment(1),
        lastUpdated: now,
      }, { merge: true });

      if (isTestMode) {
        tx.set(testLedgerRef, {
          date: today,
          totalCost: increment(estimatedCost),
          operationCount: increment(1),
          lastUpdated: now,
        }, { merge: true });
      }

      tx.set(db.doc(`costLedger/${operationId}`), {
        operationId,
        type: operationType,
        userId,
        userTier,
        estimatedCost,
        status: 'APPROVED',
        isTest: isTestMode,
        timestamp: now,
        metadata: metadata || {},
      });

      console.info('[CostControl] Operation approved and reserved (server-side)', {
        operationId,
        userId,
        operationType,
        estimatedCost,
        remainingDaily: limits.daily - (dailyUsed + estimatedCost),
        remainingMonthly: limits.monthly - (monthlyUsed + estimatedCost),
      });

      return {
        allowed: true,
        remainingBudget: limits.daily - (dailyUsed + estimatedCost),
        dailyUsed: dailyUsed + estimatedCost,
        monthlyUsed: monthlyUsed + estimatedCost,
        operationId,
      };
    });
  } catch (err) {
    console.error('[CostControl] Enforcement check failed (fail-secure: blocking)', err);

    // FAIL-SECURE: If the budget check fails, block the operation
    return {
      allowed: false,
      reason: 'Cost enforcement system unavailable. Operation blocked for safety.',
      remainingBudget: 0,
      dailyUsed: 0,
      monthlyUsed: 0,
    };
  }
}

/**
 * Cloud Function: Server-side cost enforcement (final kill-switch).
 * Called by client-side operations to verify and lock in cost reservation.
 * Fail-secure: If enforcement is unavailable, blocks the operation.
 *
 * This complements client-side CostControlService by providing a second
 * layer of protection against quota evasion or client-side bypass.
 *
 * The actual budget logic lives in `checkOperationBudget` so it can be shared
 * with background triggers; this wrapper only handles auth + transport.
 */
export const enforceOperationCost = functions.https.onCall(
  { region: 'us-central1', maxInstances: 10, timeoutSeconds: 30 },
  async (
    request: functions.https.CallableRequest<unknown>,
  ): Promise<CostEnforcementResponse> => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be signed in',
      );
    }

    const req = request.data as CostEnforcementRequest;
    const userId = request.auth.uid;

    return checkOperationBudget({
      userId,
      estimatedCost: req.estimatedCost,
      operationType: req.operationType,
      metadata: req.metadata,
      forceBypass: req.forceBypass,
    });
  },
);
