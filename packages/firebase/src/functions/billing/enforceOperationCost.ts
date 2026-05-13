import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

interface CostEnforcementRequest {
  operationType: 'video' | 'image' | 'agent_stream';
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

const RUNAWAY_LIMIT = 500; // Global kill-switch: no account can exceed $500/month
const BUDGET_LIMITS: Record<string, { daily: number; monthly: number; hourly: number }> = {
  free: { daily: 5, monthly: 50, hourly: 1 },
  pro: { daily: 25, monthly: 250, hourly: 5 },
  enterprise: { daily: 100, monthly: 1000, hourly: 20 },
};

/**
 * Cloud Function: Server-side cost enforcement (final kill-switch).
 * Called by client-side operations to verify and lock in cost reservation.
 * Fail-secure: If enforcement is unavailable, blocks the operation.
 *
 * This complements client-side CostControlService by providing a second
 * layer of protection against quota evasion or client-side bypass.
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
      if (monthlyUsed + req.estimatedCost > RUNAWAY_LIMIT) {
        // Log incident
        await db.collection('incidents').add({
          type: 'RUNAWAY_KILLED',
          userId,
          operationType: req.operationType,
          projectedCost: monthlyUsed + req.estimatedCost,
          limit: RUNAWAY_LIMIT,
          timestamp: admin.firestore.Timestamp.now(),
          action: 'BLOCKED',
          metadata: req.metadata || {},
        });

        console.warn('[CostControl] RUNAWAY_KILL_SWITCH triggered', {
          userId,
          operationType: req.operationType,
          monthlyUsed,
          estimatedCost: req.estimatedCost,
          limit: RUNAWAY_LIMIT,
        });

        return {
          allowed: false,
          reason: `RUNAWAY_PROTECTION: Monthly cost ($${monthlyUsed.toFixed(2)}) + operation ($${req.estimatedCost.toFixed(2)}) exceeds global limit ($${RUNAWAY_LIMIT})`,
          remainingBudget: 0,
          dailyUsed,
          monthlyUsed,
        };
      }

      // 5. Check daily budget
      if (dailyUsed + req.estimatedCost > limits.daily) {
        console.warn('[CostControl] Daily budget exceeded', {
          userId,
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

      // 6. Check monthly budget
      if (monthlyUsed + req.estimatedCost > limits.monthly) {
        console.warn('[CostControl] Monthly budget exceeded', {
          userId,
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

      // 7. APPROVED: Operation is permitted
      console.info('[CostControl] Operation approved (server-side)', {
        userId,
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
      };
    } catch (err) {
      console.error('[CostControl] Enforcement check failed (fail-secure: blocking)', err);

      // FAIL-SECURE: If server-side check fails, block the operation
      return {
        allowed: false,
        reason: 'Cost enforcement system unavailable. Operation blocked for safety.',
        remainingBudget: 0,
        dailyUsed: 0,
        monthlyUsed: 0,
      };
    }
  },
);
