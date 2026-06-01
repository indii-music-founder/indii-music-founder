import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

type OperationType = 'video' | 'image' | 'agent_stream';

interface CostEnforcementRequest {
  operationType: OperationType;
  userId: string;
  estimatedCost: number;
  metadata?: Record<string, unknown>;
}

interface CostEnforcementResponse {
  allowed: boolean;
  reason?: string;
  remainingBudget?: number;
  dailyUsed?: number;
  monthlyUsed?: number;
}

/** Parameters for the reusable budget-check helper. */
export interface CheckOperationBudgetParams {
  userId: string;
  estimatedCost: number;
  operationType: OperationType;
  metadata?: Record<string, unknown>;
}

const RUNAWAY_LIMIT = 500; // Global kill-switch: no account can exceed $500/month
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
  const { userId, estimatedCost, operationType, metadata } = params;
  const timestamp = new Date();
  const today = timestamp.toISOString().split('T')[0];
  const month = today.slice(0, 7);

  try {
    const db = admin.firestore();

    // 1. Fetch daily ledger
    const dailyRef = db.doc(`costLedger/daily-${today}`);
    const dailySnap = await dailyRef.get();
    const dailyUsed = dailySnap.exists
      ? (dailySnap.data()?.totalCost || 0)
      : 0;

    // 2. Fetch monthly ledger
    const monthlyRef = db.doc(`costLedger/monthly-${month}`);
    const monthlySnap = await monthlyRef.get();
    const monthlyUsed = monthlySnap.exists
      ? (monthlySnap.data()?.totalCost || 0)
      : 0;

    // 3. Fetch user tier
    const userRef = db.doc(`users/${userId}`);
    const userSnap = await userRef.get();
    const userTier = userSnap.exists ? (userSnap.data()?.tier || 'free') : 'free';
    const limits = BUDGET_LIMITS[userTier] || BUDGET_LIMITS.free;

    // 4. RUNAWAY KILL-SWITCH: Global $500/month hard limit
    if (monthlyUsed + estimatedCost > RUNAWAY_LIMIT) {
      // Log incident
      await db.collection('incidents').add({
        type: 'RUNAWAY_KILLED',
        userId,
        operationType,
        projectedCost: monthlyUsed + estimatedCost,
        limit: RUNAWAY_LIMIT,
        timestamp: admin.firestore.Timestamp.now(),
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

    // 5. Check daily budget
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

    // 6. Check monthly budget
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

    // 7. APPROVED: Operation is permitted
    console.info('[CostControl] Operation approved (server-side)', {
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
    };
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
  { region: 'us-east1', maxInstances: 10, timeoutSeconds: 30 },
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
    });
  },
);
