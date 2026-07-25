import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

type OperationType = 'video' | 'image' | 'audio' | 'agent_stream';

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

export interface CostStatusResponse {
  dailyUsed: number;
  monthlyUsed: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  tier: string;
  pendingHoldCost: number;
  pendingHoldCount: number;
  settledCost: number;
  voidedCost: number;
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

/** Parameters for the reusable budget-check helper. */
export interface CheckOperationBudgetParams {
  userId: string;
  estimatedCost: number;
  operationType: OperationType;
  metadata?: Record<string, unknown>;
  forceBypass?: boolean;
  /** Server-derived identity for exactly-once background reservations. */
  operationId?: string;
}

const RUNAWAY_LIMIT = 500; // Global kill-switch: no account can exceed $500/month
const TEST_MODE_DAILY_LIMIT = 5; // Testing should never cost more than $5/day total
const USER_CONFIRMATION_THRESHOLD = 20; // $20
const TEST_CONFIRMATION_THRESHOLD = 2; // $2
const RESERVATION_TTL_MS = 15 * 60 * 1000;
const BUDGET_LIMITS: Record<string, { daily: number; monthly: number; hourly: number }> = {
  free: { daily: 5, monthly: 50, hourly: 1 },
  pro: { daily: 25, monthly: 250, hourly: 5 },
  enterprise: { daily: 100, monthly: 1000, hourly: 20 },
  founder: { daily: 1000, monthly: 10000, hourly: Number.POSITIVE_INFINITY },
};

function timestampMillis(value: unknown): number | null {
  let millis: number | null = null;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    millis = Number(value.toMillis());
  } else if (value instanceof Date) {
    millis = value.getTime();
  } else if (typeof value === 'string' || typeof value === 'number') {
    millis = typeof value === 'number' ? value : Date.parse(value);
  }
  if (millis === null || !Number.isFinite(millis)) return null;
  const normalized = new Date(millis).getTime();
  return Number.isFinite(normalized) ? normalized : null;
}

function isoTimestamp(value: unknown): string | null {
  const millis = timestampMillis(value);
  return millis === null ? null : new Date(millis).toISOString();
}

export function serializeCostOperationHistoryItem(
  documentId: string,
  data: Record<string, unknown>,
): CostOperationHistoryItem {
  const operationId = typeof data.operationId === 'string' ? data.operationId : documentId;
  const operationType = ['video', 'image', 'audio', 'agent_stream'].includes(String(data.type))
    ? data.type as OperationType
    : 'unknown';
  const status = ['APPROVED', 'SETTLED', 'VOIDED'].includes(String(data.status))
    ? data.status as 'APPROVED' | 'SETTLED' | 'VOIDED'
    : 'UNKNOWN';
  const estimatedCostValue = Number(data.estimatedCost);
  const estimatedCost = Number.isFinite(estimatedCostValue) && estimatedCostValue >= 0
    ? estimatedCostValue
    : 0;
  const createdAtMillis = timestampMillis(data.timestamp);

  return {
    operationId,
    operationType,
    status,
    estimatedCost,
    createdAt: createdAtMillis === null ? null : new Date(createdAtMillis).toISOString(),
    finalizedAt: isoTimestamp(data.finalizedAt),
    autoReleaseAt: status === 'APPROVED' && createdAtMillis !== null
      ? new Date(createdAtMillis + RESERVATION_TTL_MS).toISOString()
      : null,
    resolution: status === 'APPROVED'
      ? 'pending_auto_release'
      : status === 'SETTLED'
        ? 'settled'
        : status === 'VOIDED'
          ? 'refunded'
          : 'unknown',
  };
}

export async function getOperationCostHistoryPage(
  userId: string,
  options: { limit?: number; cursor?: CostOperationHistoryCursor | null } = {},
): Promise<CostOperationHistoryResponse> {
  const requestedLimit = Number(options.limit ?? 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(25, Math.max(1, Math.floor(requestedLimit)))
    : 10;
  const db = admin.firestore();
  let query: FirebaseFirestore.Query = db.collection('costLedger')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'desc')
    .orderBy('operationId', 'desc');

  const cursor = options.cursor;
  if (cursor && Number.isFinite(cursor.timestampMs) && cursor.timestampMs >= 0 && cursor.operationId) {
    query = query.startAfter(admin.firestore.Timestamp.fromMillis(cursor.timestampMs), cursor.operationId);
  }

  const snapshot = await query.limit(limit + 1).get();
  const hasMore = snapshot.docs.length > limit;
  const pageDocs = snapshot.docs.slice(0, limit);
  const operations = pageDocs.map(operation => serializeCostOperationHistoryItem(
    operation.id,
    operation.data() as Record<string, unknown>,
  ));
  const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : undefined;
  const lastData = lastDoc?.data() as Record<string, unknown> | undefined;
  const lastTimestamp = timestampMillis(lastData?.timestamp);
  const lastOperationId = lastData && typeof lastData.operationId === 'string'
    ? lastData.operationId
    : lastDoc?.id;

  return {
    operations,
    hasMore,
    nextCursor: hasMore && lastTimestamp !== null && lastOperationId
      ? { timestampMs: lastTimestamp, operationId: lastOperationId }
      : null,
  };
}

function userLedgerDocument(userId: string, id: string): string {
  return `users/${userId}/costLedger/${id}`;
}

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
    const dailyRef = db.doc(userLedgerDocument(userId, `daily-${today}`));
    const monthlyRef = db.doc(userLedgerDocument(userId, `monthly-${month}`));
    const hourlyRef = db.doc(userLedgerDocument(userId, `hourly-${hour}`));
    const userRef = db.doc(`users/${userId}`);
    const testLedgerRef = db.doc(userLedgerDocument(userId, `test-${today}`));
    const requestedOperationId = params.operationId?.trim();
    if (params.operationId !== undefined && !requestedOperationId) {
      return {
        allowed: false,
        reason: 'Invalid operation id.',
        remainingBudget: 0,
        dailyUsed: 0,
        monthlyUsed: 0,
      };
    }
    const operationId = requestedOperationId
      || `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const operationRef = db.doc(`costLedger/${operationId}`);

    return await db.runTransaction(async (tx) => {
      const [dailySnap, monthlySnap, hourlySnap, userSnap, testSnap, operationSnap] = await Promise.all([
        tx.get(dailyRef),
        tx.get(monthlyRef),
        tx.get(hourlyRef),
        tx.get(userRef),
        isTestMode ? tx.get(testLedgerRef) : Promise.resolve(undefined),
        tx.get(operationRef),
      ]);

      const dailyUsed = dailySnap.exists ? (dailySnap.data()?.totalCost || 0) : 0;
      const monthlyUsed = monthlySnap.exists ? (monthlySnap.data()?.totalCost || 0) : 0;
      const hourlyOps = hourlySnap.exists ? (hourlySnap.data()?.operationCount || 0) : 0;
      const testDailyUsed = testSnap?.exists ? (testSnap.data()?.totalCost || 0) : 0;
      const userTier = userSnap.exists ? (userSnap.data()?.tier || 'free') : 'free';
      const limits = BUDGET_LIMITS[userTier] || BUDGET_LIMITS.free;

      if (operationSnap.exists) {
        const existing = operationSnap.data() || {};
        const sameReservation = existing.userId === userId
          && existing.type === operationType
          && Number(existing.estimatedCost) === estimatedCost;
        if (!sameReservation) {
          return {
            allowed: false,
            reason: 'The operation id is already bound to a different cost reservation.',
            remainingBudget: Math.max(0, limits.daily - dailyUsed),
            dailyUsed,
            monthlyUsed,
          };
        }
        if (existing.status === 'APPROVED' || existing.status === 'SETTLED') {
          return {
            allowed: true,
            remainingBudget: Math.max(0, limits.daily - dailyUsed),
            dailyUsed,
            monthlyUsed,
            operationId,
          };
        }
        return {
          allowed: false,
          reason: `The cost reservation is already ${String(existing.status || 'invalid')}.`,
          remainingBudget: Math.max(0, limits.daily - dailyUsed),
          dailyUsed,
          monthlyUsed,
        };
      }

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
          timestamp: FieldValue.serverTimestamp(),
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

      const increment = FieldValue.increment;
      const now = FieldValue.serverTimestamp();

      tx.set(dailyRef, {
        userId,
        date: today,
        totalCost: increment(estimatedCost),
        operationCount: increment(1),
        videoSeconds: dailySnap.exists ? dailySnap.data()?.videoSeconds || 0 : 0,
        imageCount: dailySnap.exists ? dailySnap.data()?.imageCount || 0 : 0,
        lastUpdated: now,
      }, { merge: true });

      tx.set(monthlyRef, {
        userId,
        month,
        totalCost: increment(estimatedCost),
        operationCount: increment(1),
        status: monthlySnap.exists ? monthlySnap.data()?.status || 'ACTIVE' : 'ACTIVE',
        lastUpdated: now,
      }, { merge: true });

      tx.set(hourlyRef, {
        userId,
        hour,
        totalCost: increment(estimatedCost),
        operationCount: increment(1),
        lastUpdated: now,
      }, { merge: true });

      if (isTestMode) {
        tx.set(testLedgerRef, {
          userId,
          date: today,
          totalCost: increment(estimatedCost),
          operationCount: increment(1),
          lastUpdated: now,
        }, { merge: true });
      }

      tx.set(operationRef, {
        operationId,
        type: operationType,
        userId,
        userTier,
        estimatedCost,
        status: 'APPROVED',
        isTest: isTestMode,
        timestamp: now,
        metadata: metadata || {},
        ledgerDocumentIds: {
          daily: `daily-${today}`,
          monthly: `monthly-${month}`,
          hourly: `hourly-${hour}`,
          ...(isTestMode ? { test: `test-${today}` } : {}),
        },
        // Paths make refund/finalization unambiguous now aggregates are
        // owner-scoped. Retain IDs for legacy reservations already in flight.
        ledgerDocumentPaths: {
          daily: dailyRef.path,
          monthly: monthlyRef.path,
          hourly: hourlyRef.path,
          ...(isTestMode ? { test: testLedgerRef.path } : {}),
        },
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

export async function finalizeOperationReservation(params: {
  userId: string;
  operationId: string;
  outcome: 'SETTLED' | 'VOIDED';
}): Promise<void> {
  const db = admin.firestore();
  const operationRef = db.doc(`costLedger/${params.operationId}`);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(operationRef);
    if (!snapshot.exists) throw new Error(`Missing cost reservation ${params.operationId}`);
    const data = snapshot.data() || {};
    if (data.userId !== params.userId) throw new Error('Cost reservation owner mismatch');
    if (data.status === params.outcome) return;
    if (data.status !== 'APPROVED') throw new Error(`Cost reservation is already ${data.status}`);

    tx.update(operationRef, {
      status: params.outcome,
      finalizedAt: FieldValue.serverTimestamp(),
    });
    if (params.outcome !== 'VOIDED') return;

    const cost = Number(data.estimatedCost);
    const ledgerPaths = data.ledgerDocumentPaths as Record<string, string> | undefined;
    const legacyLedgerIds = data.ledgerDocumentIds as Record<string, string> | undefined;
    const paths = ledgerPaths
      ? Object.values(ledgerPaths)
      : legacyLedgerIds ? Object.values(legacyLedgerIds).map(id => `costLedger/${id}`) : [];
    if (!Number.isFinite(cost) || cost < 0 || paths.length === 0) {
      throw new Error('Cost reservation cannot be safely released');
    }
    for (const path of paths) {
      tx.set(db.doc(path), {
        totalCost: FieldValue.increment(-cost),
        operationCount: FieldValue.increment(-1),
        lastUpdated: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
}

/**
 * Reconciles abandoned provisional holds. A gateway settlement/void is still
 * authoritative; this is only the bounded recovery path for clients that die
 * after reserving but before submitting a job.
 */
export async function expireStaleOperationReservations(
  now = new Date(),
  finalize: typeof finalizeOperationReservation = finalizeOperationReservation,
): Promise<number> {
  const db = admin.firestore();
  const cutoff = admin.firestore.Timestamp.fromMillis(now.getTime() - RESERVATION_TTL_MS);
  const stale = await db.collection('costLedger')
    .where('status', '==', 'APPROVED')
    .where('timestamp', '<=', cutoff)
    .orderBy('timestamp', 'asc')
    .limit(100)
    .get();

  let expired = 0;
  for (const operation of stale.docs) {
    const data = operation.data();
    const userId = typeof data.userId === 'string' ? data.userId : null;
    if (!userId) {
      console.error('[CostControl] Cannot expire malformed reservation', operation.id);
      continue;
    }
    try {
      const metadata = data.metadata && typeof data.metadata === 'object'
        ? data.metadata as Record<string, unknown>
        : undefined;
      const jobId = typeof metadata?.jobId === 'string' ? metadata.jobId : undefined;
      const videoSessionId = typeof metadata?.videoSessionId === 'string'
        ? metadata.videoSessionId
        : undefined;
      let outcome: 'SETTLED' | 'VOIDED' = 'VOIDED';
      if (videoSessionId) {
        const sessionSnapshot = await db.doc(`videoSessions/${videoSessionId}`).get();
        const status = sessionSnapshot.exists ? sessionSnapshot.data()?.status : undefined;
        if (status === 'completed') {
          outcome = 'SETTLED';
        } else if (status !== 'failed' && status !== 'cancelled' && sessionSnapshot.exists) {
          // Long uploads and proxy work can legitimately outlive the generic
          // 15-minute hold TTL. Their durable session plus retention cleanup
          // is the authoritative lifecycle, so do not refund active work.
          continue;
        }
      } else if (jobId) {
        const jobSnapshot = await db.doc(`creative_jobs/${jobId}`).get();
        if (jobSnapshot.exists && jobSnapshot.data()?.status === 'completed') {
          outcome = 'SETTLED';
        }
      }
      await finalize({ userId, operationId: operation.id, outcome });
      expired += 1;
    } catch (error) {
      // Another gateway/scheduler may have finalized it first. The transactional
      // finalizer is idempotent for an identical outcome and prevents double refunds.
      console.warn('[CostControl] Reservation expiry reconciliation skipped', operation.id, error);
    }
  }
  return expired;
}

export const expireStaleOperationCostReservations = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Etc/UTC', region: 'us-central1' },
  async () => {
    const expired = await expireStaleOperationReservations();
    console.info('[CostControl] Expired stale reservations', { expired });
  },
);

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

export const finalizeOperationCost = functions.https.onCall(
  { region: 'us-central1', maxInstances: 20, timeoutSeconds: 30 },
  async (request: functions.https.CallableRequest<unknown>): Promise<{ success: true }> => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const data = request.data as { operationId?: unknown; outcome?: unknown };
    if (typeof data.operationId !== 'string' || !['SETTLED', 'VOIDED'].includes(String(data.outcome))) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid operationId and outcome are required');
    }
    await finalizeOperationReservation({
      userId: request.auth.uid,
      operationId: data.operationId,
      outcome: data.outcome as 'SETTLED' | 'VOIDED',
    });
    return { success: true };
  },
);

/**
 * Owner-scoped billing receipt for UI. Aggregate ledgers include approved
 * holds, so the pending breakdown is returned explicitly rather than making
 * a renderer guess from mutable client state.
 */
export const getOperationCostStatus = functions.https.onCall(
  { region: 'us-central1', maxInstances: 20, timeoutSeconds: 30 },
  async (request: functions.https.CallableRequest<unknown>): Promise<CostStatusResponse> => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const userId = request.auth.uid;
    const timestamp = new Date();
    const today = timestamp.toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const db = admin.firestore();
    const [dailySnap, monthlySnap, userSnap, pendingSnap, settledSnap, voidedSnap] = await Promise.all([
      db.doc(userLedgerDocument(userId, `daily-${today}`)).get(),
      db.doc(userLedgerDocument(userId, `monthly-${month}`)).get(),
      db.doc(`users/${userId}`).get(),
      db.collection('costLedger')
        .where('userId', '==', userId)
        .where('status', '==', 'APPROVED')
        .limit(100)
        .get(),
      db.collection('costLedger').where('userId', '==', userId).where('status', '==', 'SETTLED').limit(100).get(),
      db.collection('costLedger').where('userId', '==', userId).where('status', '==', 'VOIDED').limit(100).get(),
    ]);
    const tier = String(userSnap.data()?.tier || 'free');
    const limits = BUDGET_LIMITS[tier] || BUDGET_LIMITS.free;
    const dailyUsed = Number(dailySnap.data()?.totalCost || 0);
    const monthlyUsed = Number(monthlySnap.data()?.totalCost || 0);
    const pendingHoldCost = pendingSnap.docs.reduce((sum, operation) => {
      const value = Number(operation.data().estimatedCost || 0);
      return Number.isFinite(value) && value > 0 ? sum + value : sum;
    }, 0);
    const sumCost = (snapshot: FirebaseFirestore.QuerySnapshot) => snapshot.docs.reduce((sum, operation) => {
      const value = Number(operation.data().estimatedCost || 0);
      return Number.isFinite(value) && value > 0 ? sum + value : sum;
    }, 0);
    return {
      dailyUsed,
      monthlyUsed,
      dailyRemaining: Math.max(0, limits.daily - dailyUsed),
      monthlyRemaining: Math.max(0, limits.monthly - monthlyUsed),
      tier,
      pendingHoldCost,
      pendingHoldCount: pendingSnap.size,
      settledCost: sumCost(settledSnap),
      voidedCost: sumCost(voidedSnap),
    };
  },
);

/**
 * Owner-scoped, cursor-paginated operation receipts for Creative Studio.
 * Pending holds expose their automatic release deadline; settled and voided
 * entries expose finalization state without leaking prompts or metadata.
 */
export const getOperationCostHistory = functions.https.onCall(
  { region: 'us-central1', maxInstances: 20, timeoutSeconds: 30 },
  async (request: functions.https.CallableRequest<unknown>): Promise<CostOperationHistoryResponse> => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const data = (request.data || {}) as {
      limit?: unknown;
      cursor?: { timestampMs?: unknown; operationId?: unknown } | null;
    };
    const limit = typeof data.limit === 'number' ? data.limit : 10;
    const cursor = data.cursor
      && typeof data.cursor.timestampMs === 'number'
      && typeof data.cursor.operationId === 'string'
      ? { timestampMs: data.cursor.timestampMs, operationId: data.cursor.operationId }
      : null;
    return getOperationCostHistoryPage(request.auth.uid, { limit, cursor });
  },
);
