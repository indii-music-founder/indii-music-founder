import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { entitlementTierToBudgetTier, requireVerifiedServerEntitlement, type BudgetTier } from '../auth/entitlements';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { arcjetKey } from '../../config/secrets';
import { policyClassForServerEntitlement, protectAuthenticatedApiRequest } from '../security/arcjet';

type OperationType = 'video' | 'image' | 'audio' | 'agent_stream';

export type AgentStreamLifecycleState =
  | 'CLAIMED_NOT_SUBMITTED'
  | 'PROVIDER_SUBMITTING'
  | 'PRE_SUBMISSION_FAILED'
  | 'PRE_SUBMISSION_CANCELLED'
  | 'PROVIDER_FAILED'
  | 'PROVIDER_CANCELLED'
  | 'COMPLETED';

export type AgentStreamTerminalState = Exclude<
  AgentStreamLifecycleState,
  'CLAIMED_NOT_SUBMITTED' | 'PROVIDER_SUBMITTING'
>;

export interface BoardroomDispatchPlan {
  type: 'BOARDROOM_DISPATCH_PLAN';
  code: 'BOARDROOM_DISPATCH_READY' | 'BOARDROOM_DISPATCH_BUDGET_EXHAUSTED' | 'BOARDROOM_DISPATCH_ACTIVE_TURN';
  executedAgentIds: string[];
  deferredAgentIds: string[];
  maxIterationsPerAgent: number;
  hourlyOperationsUsed: number;
  hourlyOperationLimit: number | null;
  continuationReserve: number;
  nextContinuationAgentId: string | null;
  leaseId: string | null;
  leaseExpiresAtMs: number | null;
  sideEffectOwnerAgentId: string | null;
}

interface CostEnforcementRequest {
  operationType: OperationType;
  estimatedCost: number;
  metadata?: Record<string, unknown>;
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

type CallableAuth = {
  uid?: unknown;
  token?: Record<string, unknown>;
} | null | undefined;

/**
 * Creative work consumes a paid backend resource. Authentication alone is not
 * enough: disposable inboxes otherwise become a way to obtain allowances.
 * Firebase's email-verification claim is authoritative; profile data and
 * client-provided flags are never accepted as a substitute.
 */
export function requireVerifiedCreativeUser(auth: CallableAuth): string {
  if (!auth || typeof auth.uid !== 'string' || !auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }
  if (auth.token?.email_verified !== true) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Verify your email before using creative generation.',
    );
  }
  return auth.uid;
}

function parseCostEnforcementRequest(value: unknown): CostEnforcementRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new functions.https.HttpsError('invalid-argument', 'A cost reservation payload is required.');
  }
  const data = value as Record<string, unknown>;
  const operationType = data.operationType;
  if (!['video', 'image', 'audio', 'agent_stream'].includes(String(operationType))) {
    throw new functions.https.HttpsError('invalid-argument', 'operationType is invalid.');
  }
  const estimatedCost = data.estimatedCost;
  if (typeof estimatedCost !== 'number' || !Number.isFinite(estimatedCost) || estimatedCost <= 0 || estimatedCost > RUNAWAY_LIMIT) {
    throw new functions.https.HttpsError('invalid-argument', 'estimatedCost is invalid.');
  }
  const metadataValue = data.metadata;
  if (metadataValue === undefined) {
    return { operationType: operationType as OperationType, estimatedCost };
  }
  if (!metadataValue || typeof metadataValue !== 'object' || Array.isArray(metadataValue)) {
    throw new functions.https.HttpsError('invalid-argument', 'metadata must be a flat object.');
  }
  const metadataEntries = Object.entries(metadataValue as Record<string, unknown>);
  if (metadataEntries.length > 20 || metadataEntries.some(([key, item]) => (
    !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)
    || (typeof item === 'string' && item.length > 512)
    || (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean' && item !== null)
    || (typeof item === 'number' && !Number.isFinite(item))
  ))) {
    throw new functions.https.HttpsError('invalid-argument', 'metadata contains an unsupported value.');
  }
  return {
    operationType: operationType as OperationType,
    estimatedCost,
    metadata: Object.fromEntries(metadataEntries),
  };
}

function parseOperationReservationId(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new functions.https.HttpsError('invalid-argument', 'A cost reservation payload is required.');
  }
  const operationId = (value as Record<string, unknown>).operationId;
  if (typeof operationId !== 'string' || !operationId.trim() || operationId.length > 256) {
    throw new functions.https.HttpsError('invalid-argument', 'operationId is invalid.');
  }
  return operationId;
}

async function requireCostCallableAdmission(
  request: functions.https.CallableRequest<unknown>,
  operation: string,
): Promise<{ userId: string; entitlement: Awaited<ReturnType<typeof requireVerifiedServerEntitlement>> }> {
  validateAppCheckV2(request);
  const userId = requireVerifiedCreativeUser(request.auth);
  const entitlement = await requireVerifiedServerEntitlement(userId);
  const protection = await protectAuthenticatedApiRequest(request.rawRequest, {
    userId,
    policy: policyClassForServerEntitlement({
      tier: entitlement.tier,
      isAdmin: request.auth?.token.admin === true,
    }),
    operationId: `${operation}:${crypto.randomUUID()}`,
  });
  if (!protection.allowed) {
    const code = protection.status === 429
      ? 'resource-exhausted'
      : protection.status === 403
        ? 'permission-denied'
        : 'unavailable';
    throw new functions.https.HttpsError(code, protection.message, {
      code: protection.code,
      ...(protection.retryAfterSeconds ? { retryAfterSeconds: protection.retryAfterSeconds } : {}),
    });
  }
  return { userId, entitlement };
}

const costCallableSecurityOptions = {
  secrets: [arcjetKey],
  enforceAppCheck: false,
};

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
  status: 'APPROVED' | 'CLAIMED' | 'SETTLED' | 'VOIDED' | 'UNKNOWN';
  estimatedCost: number;
  createdAt: string | null;
  finalizedAt: string | null;
  autoReleaseAt: string | null;
  resolution: 'pending_auto_release' | 'claimed' | 'settled' | 'refunded' | 'unknown';
}

export interface CostOperationHistoryResponse {
  operations: CostOperationHistoryItem[];
  nextCursor: CostOperationHistoryCursor | null;
  hasMore: boolean;
}

/** Parameters for the reusable budget-check helper. */
export interface CheckOperationBudgetParams {
  userId: string;
  /** Server-resolved entitlement. Browser and profile values are never accepted. */
  entitlementTier: BudgetTier;
  estimatedCost: number;
  operationType: OperationType;
  metadata?: Record<string, unknown>;
  /** Server-derived identity for exactly-once background reservations. */
  operationId?: string;
}

const RUNAWAY_LIMIT = 500; // Global kill-switch: no account can exceed $500/month
const TEST_MODE_DAILY_LIMIT = 5; // Testing should never cost more than $5/day total
const USER_CONFIRMATION_THRESHOLD = 20; // $20
const TEST_CONFIRMATION_THRESHOLD = 2; // $2
const RESERVATION_TTL_MS = 15 * 60 * 1000;
const BOARDROOM_DISPATCH_LEASE_TTL_MS = 15 * 60 * 1000;
const MAX_BOARDROOM_AGENTS_PER_TURN = 9;
const BOARDROOM_MAX_ITERATIONS_PER_AGENT = 2;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUDGET_LIMITS: Record<string, { daily: number; monthly: number; hourly: number }> = {
  free: { daily: 5, monthly: 50, hourly: 1 },
  pro: { daily: 25, monthly: 250, hourly: 5 },
  enterprise: { daily: 100, monthly: 1000, hourly: 20 },
  founder: { daily: 1000, monthly: 10000, hourly: Number.POSITIVE_INFINITY },
};

function hourlyOperationLimitForTier(tier: BudgetTier): number {
  return tier === 'free' ? 5 : tier === 'pro' ? 20 : Number.POSITIVE_INFINITY;
}

function boardroomContinuationReserveForTier(tier: BudgetTier): number {
  return tier === 'free' ? 1 : tier === 'pro' ? 2 : 0;
}

function parseBoardroomDispatchAgentIds(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new functions.https.HttpsError('invalid-argument', 'A Boardroom dispatch payload is required.');
  }
  const agentIds = (value as Record<string, unknown>).agentIds;
  if (!Array.isArray(agentIds) || agentIds.length === 0 || agentIds.length > 64) {
    throw new functions.https.HttpsError('invalid-argument', 'agentIds must contain between 1 and 64 agents.');
  }
  const normalized = agentIds.map((agentId) => {
    if (typeof agentId !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(agentId)) {
      throw new functions.https.HttpsError('invalid-argument', 'agentIds contains an invalid agent id.');
    }
    return agentId;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new functions.https.HttpsError('invalid-argument', 'agentIds must be unique.');
  }
  return normalized;
}

function parseBoardroomDispatchLeaseId(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new functions.https.HttpsError('invalid-argument', 'A Boardroom lease payload is required.');
  }
  const leaseId = (value as Record<string, unknown>).leaseId;
  if (typeof leaseId !== 'string' || !UUID_PATTERN.test(leaseId)) {
    throw new functions.https.HttpsError('invalid-argument', 'leaseId is invalid.');
  }
  return leaseId;
}

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
  const status = ['APPROVED', 'CLAIMED', 'SETTLED', 'VOIDED'].includes(String(data.status))
    ? data.status as 'APPROVED' | 'CLAIMED' | 'SETTLED' | 'VOIDED'
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
      : status === 'CLAIMED'
        ? 'claimed'
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
  const { userId, entitlementTier, estimatedCost, operationType, metadata } = params;
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
    const testLedgerRef = db.doc(userLedgerDocument(userId, `test-${today}`));
    const boardroomLeaseId = typeof metadata?.boardroomDispatchLeaseId === 'string'
      ? metadata.boardroomDispatchLeaseId
      : undefined;
    const boardroomAgentId = typeof metadata?.boardroomAgentId === 'string'
      ? metadata.boardroomAgentId
      : undefined;
    if ((boardroomLeaseId && !boardroomAgentId) || (!boardroomLeaseId && boardroomAgentId)) {
      return {
        allowed: false,
        reason: 'Boardroom reservations require both lease and agent identity.',
        remainingBudget: 0,
        dailyUsed: 0,
        monthlyUsed: 0,
      };
    }
    const boardroomStateRef = boardroomLeaseId
      ? db.doc(`users/${userId}/boardroomDispatchState/current`)
      : undefined;
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
      const [dailySnap, monthlySnap, hourlySnap, testSnap, operationSnap, boardroomStateSnap] = await Promise.all([
        tx.get(dailyRef),
        tx.get(monthlyRef),
        tx.get(hourlyRef),
        isTestMode ? tx.get(testLedgerRef) : Promise.resolve(undefined),
        tx.get(operationRef),
        boardroomStateRef ? tx.get(boardroomStateRef) : Promise.resolve(undefined),
      ]);

      const dailyUsed = dailySnap.exists ? (dailySnap.data()?.totalCost || 0) : 0;
      const monthlyUsed = monthlySnap.exists ? (monthlySnap.data()?.totalCost || 0) : 0;
      const hourlyOps = hourlySnap.exists ? (hourlySnap.data()?.operationCount || 0) : 0;
      const testDailyUsed = testSnap?.exists ? (testSnap.data()?.totalCost || 0) : 0;
      const userTier = entitlementTier;
      const limits = BUDGET_LIMITS[userTier];

      const boardroomState = boardroomStateSnap?.exists ? boardroomStateSnap.data() || {} : {};
      const activeLease = boardroomState.activeLease && typeof boardroomState.activeLease === 'object'
        ? boardroomState.activeLease as Record<string, unknown>
        : undefined;
      const activeLeaseSlots = activeLease?.remainingSlotsByAgent
        && typeof activeLease.remainingSlotsByAgent === 'object'
        ? activeLease.remainingSlotsByAgent as Record<string, unknown>
        : undefined;
      if (boardroomLeaseId) {
        const leaseExpiresAtMs = Number(activeLease?.expiresAtMs);
        const remainingForAgent = Number(activeLeaseSlots?.[boardroomAgentId as string]);
        const sideEffectOwnerAgentId = typeof activeLease?.sideEffectOwnerAgentId === 'string'
          ? activeLease.sideEffectOwnerAgentId
          : undefined;
        const sideEffectReservationId = typeof activeLease?.sideEffectReservationId === 'string'
          ? activeLease.sideEffectReservationId
          : undefined;
        const isBoardroomAgentStream = operationType === 'agent_stream';
        const isBoardroomImage = operationType === 'image';
        if (
          activeLease?.id !== boardroomLeaseId
          || activeLease?.hour !== hour
          || !Number.isFinite(leaseExpiresAtMs)
          || leaseExpiresAtMs <= timestamp.getTime()
          || (!isBoardroomAgentStream && !isBoardroomImage)
          || (isBoardroomAgentStream && (!Number.isInteger(remainingForAgent) || remainingForAgent <= 0))
          || (isBoardroomImage && sideEffectOwnerAgentId !== boardroomAgentId)
          || (isBoardroomImage && sideEffectReservationId && sideEffectReservationId !== operationId)
        ) {
          return {
            allowed: false,
            reason: 'Boardroom dispatch lease is missing, expired, or has no slot for this agent.',
            remainingBudget: Math.max(0, limits.daily - dailyUsed),
            dailyUsed,
            monthlyUsed,
          };
        }
      }

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

      if (isTestMode && testDailyUsed + estimatedCost > TEST_MODE_DAILY_LIMIT) {
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

      const hourlyLimit = hourlyOperationLimitForTier(userTier);
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
      if (estimatedCost >= threshold) {
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

      if (boardroomLeaseId && boardroomStateRef && activeLease && activeLeaseSlots && boardroomAgentId) {
        const reservationIds = Array.isArray(activeLease.reservationIds)
          ? activeLease.reservationIds.filter((id): id is string => typeof id === 'string')
          : [];
        const isBoardroomImage = operationType === 'image';
        const remainingSlotsByAgent = { ...activeLeaseSlots };
        if (!isBoardroomImage) {
          remainingSlotsByAgent[boardroomAgentId] = Number(remainingSlotsByAgent[boardroomAgentId]) - 1;
        }
        tx.set(boardroomStateRef, {
          activeLease: {
            ...activeLease,
            remainingSlotsByAgent,
            reservationIds: isBoardroomImage ? reservationIds : [...reservationIds, operationId],
            ...(isBoardroomImage ? { sideEffectReservationId: operationId } : {}),
            expiresAtMs: timestamp.getTime() + BOARDROOM_DISPATCH_LEASE_TTL_MS,
          },
          updatedAt: now,
        }, { merge: true });
      }

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
  jobId?: string;
  expectedType?: OperationType;
}): Promise<void> {
  const db = admin.firestore();
  const operationRef = db.doc(`costLedger/${params.operationId}`);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(operationRef);
    if (!snapshot.exists) throw new Error(`Missing cost reservation ${params.operationId}`);
    const data = snapshot.data() || {};
    if (data.userId !== params.userId) throw new Error('Cost reservation owner mismatch');
    if (params.expectedType && data.type !== params.expectedType) {
      throw new Error(`Cost reservation type mismatch: expected ${params.expectedType}`);
    }
    if (data.status === params.outcome) return;
    if (data.status !== 'APPROVED' && data.status !== 'CLAIMED') {
      throw new Error(`Cost reservation is already ${data.status}`);
    }
    if (data.status === 'CLAIMED') {
      if (typeof data.claimedJobId !== 'string' || !params.jobId || data.claimedJobId !== params.jobId) {
        throw new Error('Cost reservation claim does not match the finalizing job');
      }
    }

    const metadata = data.metadata && typeof data.metadata === 'object'
      ? data.metadata as Record<string, unknown>
      : undefined;
    const leaseId = typeof metadata?.boardroomDispatchLeaseId === 'string'
      ? metadata.boardroomDispatchLeaseId
      : undefined;
    const boardroomAgentId = typeof metadata?.boardroomAgentId === 'string'
      ? metadata.boardroomAgentId
      : undefined;
    const boardroomStateRef = leaseId && boardroomAgentId
      ? db.doc(`users/${params.userId}/boardroomDispatchState/current`)
      : undefined;
    const boardroomStateSnapshot = boardroomStateRef ? await tx.get(boardroomStateRef) : undefined;

    tx.update(operationRef, {
      status: params.outcome,
      finalizedAt: FieldValue.serverTimestamp(),
      ...(params.jobId ? { finalizedJobId: params.jobId } : {}),
    });
    if (params.outcome === 'VOIDED') {
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
    }
    if (boardroomStateRef && boardroomStateSnapshot?.exists && leaseId && boardroomAgentId) {
      const state = boardroomStateSnapshot.data() || {};
      const activeLease = state.activeLease && typeof state.activeLease === 'object'
        ? state.activeLease as Record<string, unknown>
        : undefined;
      const slots = activeLease?.remainingSlotsByAgent && typeof activeLease.remainingSlotsByAgent === 'object'
        ? activeLease.remainingSlotsByAgent as Record<string, unknown>
        : undefined;
      const reservationIds = Array.isArray(activeLease?.reservationIds)
        ? activeLease.reservationIds.filter((id): id is string => typeof id === 'string')
        : [];
      if (activeLease?.id === leaseId && slots && reservationIds.includes(params.operationId)) {
        tx.set(boardroomStateRef, {
          activeLease: {
            ...activeLease,
            remainingSlotsByAgent: {
              ...slots,
              [boardroomAgentId]: Number(slots[boardroomAgentId] || 0) + (params.outcome === 'VOIDED' ? 1 : 0),
            },
            reservationIds: reservationIds.filter(id => id !== params.operationId),
          },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  });
}

export async function claimOperationReservation(params: {
  userId: string;
  operationId: string;
  operationType: OperationType;
  claimId: string;
}): Promise<void> {
  if (!params.operationId.trim() || params.operationId.length > 256) throw new Error('Cost reservation id is invalid');
  if (!params.claimId.trim() || params.claimId.length > 256) throw new Error('Cost reservation claim id is invalid');

  const db = admin.firestore();
  const operationRef = db.doc(`costLedger/${params.operationId}`);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(operationRef);
    if (!snapshot.exists) throw new Error(`Missing cost reservation ${params.operationId}`);
    const data = snapshot.data() || {};
    if (data.userId !== params.userId) throw new Error('Cost reservation owner mismatch');
    if (data.type !== params.operationType) throw new Error(`Cost reservation type mismatch: expected ${params.operationType}`);
    if (data.status !== 'APPROVED') throw new Error(`Cost reservation is already ${String(data.status || 'invalid')}`);
    tx.update(operationRef, {
      status: 'CLAIMED',
      claimedJobId: params.claimId,
      claimedAt: FieldValue.serverTimestamp(),
      ...(params.operationType === 'agent_stream' ? {
        agentStreamLifecycleState: 'CLAIMED_NOT_SUBMITTED' satisfies AgentStreamLifecycleState,
        agentStreamLifecycleUpdatedAt: FieldValue.serverTimestamp(),
      } : {}),
    });
  });
}

const AGENT_STREAM_TRANSITIONS: Record<AgentStreamLifecycleState, ReadonlySet<AgentStreamLifecycleState>> = {
  CLAIMED_NOT_SUBMITTED: new Set(['PROVIDER_SUBMITTING', 'PRE_SUBMISSION_FAILED', 'PRE_SUBMISSION_CANCELLED']),
  PROVIDER_SUBMITTING: new Set(['COMPLETED', 'PROVIDER_FAILED', 'PROVIDER_CANCELLED', 'PRE_SUBMISSION_FAILED', 'PRE_SUBMISSION_CANCELLED']),
  PRE_SUBMISSION_FAILED: new Set(),
  PRE_SUBMISSION_CANCELLED: new Set(),
  PROVIDER_FAILED: new Set(),
  PROVIDER_CANCELLED: new Set(),
  COMPLETED: new Set(),
};

/**
 * Records only the durable provider-submission intent. Terminal lifecycle
 * states are deliberately unavailable here; they must use the atomic terminal
 * helper that couples lifecycle evidence to its financial outcome.
 */
export async function recordAgentStreamReservationLifecycle(params: {
  userId: string;
  operationId: string;
  claimId: string;
  state: 'PROVIDER_SUBMITTING';
}): Promise<void> {
  const db = admin.firestore();
  const operationRef = db.doc(`costLedger/${params.operationId}`);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(operationRef);
    if (!snapshot.exists) throw new Error(`Missing cost reservation ${params.operationId}`);
    const data = snapshot.data() || {};
    if (data.userId !== params.userId) throw new Error('Cost reservation owner mismatch');
    if (data.type !== 'agent_stream') throw new Error('Cost reservation type mismatch: expected agent_stream');
    if (data.status !== 'CLAIMED') throw new Error(`Cost reservation is already ${String(data.status || 'invalid')}`);
    if (data.claimedJobId !== params.claimId) throw new Error('Cost reservation claim does not match the lifecycle writer');

    const current = data.agentStreamLifecycleState as AgentStreamLifecycleState | undefined;
    if (current === params.state) return;
    if (!current || !AGENT_STREAM_TRANSITIONS[current]?.has(params.state)) {
      throw new Error(`Invalid agent-stream lifecycle transition ${String(current || 'missing')} -> ${params.state}`);
    }

    tx.update(operationRef, {
      agentStreamLifecycleState: params.state,
      agentStreamLifecycleUpdatedAt: FieldValue.serverTimestamp(),
    });
  });
}

function agentStreamFinancialOutcome(state: AgentStreamTerminalState): 'SETTLED' | 'VOIDED' {
  return state === 'PRE_SUBMISSION_FAILED' || state === 'PRE_SUBMISSION_CANCELLED'
    ? 'VOIDED'
    : 'SETTLED';
}

/**
 * Atomically persists the authoritative terminal provider state and its only
 * valid financial outcome. Callers cannot independently choose SETTLED versus
 * VOIDED, so a submitted/possibly-billed request can never be refunded by a
 * generic error path.
 */
export async function finalizeAgentStreamReservationTerminal(params: {
  userId: string;
  operationId: string;
  claimId: string;
  state: AgentStreamTerminalState;
}): Promise<void> {
  const outcome = agentStreamFinancialOutcome(params.state);
  const db = admin.firestore();
  const operationRef = db.doc(`costLedger/${params.operationId}`);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(operationRef);
    if (!snapshot.exists) throw new Error(`Missing cost reservation ${params.operationId}`);
    const data = snapshot.data() || {};
    if (data.userId !== params.userId) throw new Error('Cost reservation owner mismatch');
    if (data.type !== 'agent_stream') throw new Error('Cost reservation type mismatch: expected agent_stream');
    if (data.claimedJobId !== params.claimId) throw new Error('Cost reservation claim does not match the finalizing job');
    if (data.status === outcome && data.agentStreamLifecycleState === params.state) return;
    if (data.status !== 'CLAIMED') throw new Error(`Cost reservation is already ${String(data.status || 'invalid')}`);

    const current = data.agentStreamLifecycleState as AgentStreamLifecycleState | undefined;
    if (current !== params.state && (!current || !AGENT_STREAM_TRANSITIONS[current]?.has(params.state))) {
      throw new Error(`Invalid agent-stream lifecycle transition ${String(current || 'missing')} -> ${params.state}`);
    }

    const metadata = data.metadata && typeof data.metadata === 'object'
      ? data.metadata as Record<string, unknown>
      : undefined;
    const leaseId = typeof metadata?.boardroomDispatchLeaseId === 'string'
      ? metadata.boardroomDispatchLeaseId
      : undefined;
    const boardroomAgentId = typeof metadata?.boardroomAgentId === 'string'
      ? metadata.boardroomAgentId
      : undefined;
    const boardroomStateRef = leaseId && boardroomAgentId
      ? db.doc(`users/${params.userId}/boardroomDispatchState/current`)
      : undefined;
    const boardroomStateSnapshot = boardroomStateRef ? await tx.get(boardroomStateRef) : undefined;

    tx.update(operationRef, {
      status: outcome,
      agentStreamLifecycleState: params.state,
      agentStreamLifecycleUpdatedAt: FieldValue.serverTimestamp(),
      finalizedAt: FieldValue.serverTimestamp(),
      finalizedJobId: params.claimId,
    });
    if (outcome === 'VOIDED') {
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
    }
    if (boardroomStateRef && boardroomStateSnapshot?.exists && leaseId && boardroomAgentId) {
      const state = boardroomStateSnapshot.data() || {};
      const activeLease = state.activeLease && typeof state.activeLease === 'object'
        ? state.activeLease as Record<string, unknown>
        : undefined;
      const slots = activeLease?.remainingSlotsByAgent && typeof activeLease.remainingSlotsByAgent === 'object'
        ? activeLease.remainingSlotsByAgent as Record<string, unknown>
        : undefined;
      const reservationIds = Array.isArray(activeLease?.reservationIds)
        ? activeLease.reservationIds.filter((id): id is string => typeof id === 'string')
        : [];
      if (activeLease?.id === leaseId && slots && reservationIds.includes(params.operationId)) {
        tx.set(boardroomStateRef, {
          activeLease: {
            ...activeLease,
            remainingSlotsByAgent: {
              ...slots,
              [boardroomAgentId]: Number(slots[boardroomAgentId] || 0) + (outcome === 'VOIDED' ? 1 : 0),
            },
            reservationIds: reservationIds.filter(id => id !== params.operationId),
          },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
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

/**
 * Reconciles stale video reservations that have already been atomically claimed
 * by an authoritative job. Claimed work is never refunded merely because it is
 * old: only durable evidence that the provider was not called permits a void.
 */
export async function reconcileStaleClaimedVideoReservations(
  now = new Date(),
  finalize: typeof finalizeOperationReservation = finalizeOperationReservation,
): Promise<number> {
  const db = admin.firestore();
  const cutoff = admin.firestore.Timestamp.fromMillis(now.getTime() - RESERVATION_TTL_MS);
  const stale = await db.collection('costLedger')
    .where('status', '==', 'CLAIMED')
    .where('type', '==', 'video')
    .where('timestamp', '<=', cutoff)
    .orderBy('timestamp', 'asc')
    .limit(100)
    .get();

  let reconciled = 0;
  for (const operation of stale.docs) {
    const data = operation.data();
    const userId = typeof data.userId === 'string' ? data.userId : null;
    const jobId = typeof data.claimedJobId === 'string' ? data.claimedJobId : null;
    if (!userId || !jobId) {
      console.error('[CostControl] Cannot reconcile malformed claimed video reservation', operation.id);
      continue;
    }

    try {
      const jobSnapshot = await db.doc(`videoJobs/${jobId}`).get();
      if (!jobSnapshot.exists) {
        // A claim without its transactionally-created job is inconsistent and
        // requires operator review. Never turn absence of evidence into a refund.
        console.error('[CostControl] Claimed video reservation has no authoritative job', operation.id, jobId);
        continue;
      }
      const job = jobSnapshot.data() || {};
      if (
        job.userId !== userId
        || job.costReservationId !== operation.id
        || job.workerVersion !== 'gateway-video-v3'
      ) {
        console.error('[CostControl] Claimed video reservation does not match its authoritative job', operation.id, jobId);
        continue;
      }

      const hasDurableResult = typeof job.resultUri === 'string' && job.resultUri.startsWith('gs://');
      if (
        job.status === 'completed'
        || (job.providerSubmissionState === 'succeeded_pending_settlement' && hasDurableResult)
      ) {
        await finalize({ userId, operationId: operation.id, outcome: 'SETTLED', jobId });
        reconciled += 1;
        continue;
      }

      if (
        (job.status === 'failed' || job.status === 'cancelled')
        && job.providerSubmissionState === 'not_submitted'
      ) {
        await finalize({ userId, operationId: operation.id, outcome: 'VOIDED', jobId });
        reconciled += 1;
      }
      // queued, processing, or ambiguous provider outcomes remain CLAIMED.
      // A later scheduler pass can settle them when durable evidence appears.
    } catch (error) {
      console.warn('[CostControl] Claimed video reservation reconciliation skipped', operation.id, error);
    }
  }
  return reconciled;
}

export async function reconcileStaleClaimedAgentStreamReservations(
  now = new Date(),
  finalize: typeof finalizeOperationReservation = finalizeOperationReservation,
): Promise<number> {
  const db = admin.firestore();
  const cutoff = admin.firestore.Timestamp.fromMillis(now.getTime() - RESERVATION_TTL_MS);
  const stale = await db.collection('costLedger')
    .where('status', '==', 'CLAIMED')
    .where('type', '==', 'agent_stream')
    .where('claimedAt', '<=', cutoff)
    .orderBy('claimedAt', 'asc')
    .limit(100)
    .get();
  let reconciled = 0;
  for (const operation of stale.docs) {
    const data = operation.data();
    const userId = typeof data.userId === 'string' ? data.userId : null;
    const claimId = typeof data.claimedJobId === 'string' ? data.claimedJobId : null;
    if (!userId || !claimId) {
      console.error('[CostControl] Cannot reconcile malformed claimed agent-stream reservation', operation.id);
      continue;
    }
    try {
      const lifecycleState = data.agentStreamLifecycleState as AgentStreamLifecycleState | undefined;
      if (
        lifecycleState === 'COMPLETED'
        || lifecycleState === 'PROVIDER_FAILED'
        || lifecycleState === 'PROVIDER_CANCELLED'
      ) {
        await finalize({ userId, operationId: operation.id, outcome: 'SETTLED', jobId: claimId, expectedType: 'agent_stream' });
        reconciled += 1;
      } else if (
        lifecycleState === 'CLAIMED_NOT_SUBMITTED'
        || lifecycleState === 'PRE_SUBMISSION_FAILED'
        || lifecycleState === 'PRE_SUBMISSION_CANCELLED'
      ) {
        await finalize({ userId, operationId: operation.id, outcome: 'VOIDED', jobId: claimId, expectedType: 'agent_stream' });
        reconciled += 1;
      } else if (lifecycleState !== 'PROVIDER_SUBMITTING') {
        console.error('[CostControl] Claimed agent-stream reservation lacks authoritative lifecycle evidence', operation.id);
      }
      // PROVIDER_SUBMITTING may represent paid work. Age alone is never
      // evidence for a refund. CLAIMED_NOT_SUBMITTED is safe only because the
      // gateway records it transactionally before any provider call and this
      // query's 15-minute cutoff exceeds the gateway's five-minute lifetime.
    } catch (error) {
      console.warn('[CostControl] Claimed agent-stream reconciliation skipped', operation.id, error);
    }
  }
  return reconciled;
}

export async function buildBoardroomDispatchPlan(params: {
  userId: string;
  entitlementTier: BudgetTier;
  agentIds: string[];
  now?: Date;
  leaseId?: string;
}): Promise<BoardroomDispatchPlan> {
  const timestamp = params.now ?? new Date();
  const leaseId = params.leaseId ?? randomUUID();
  const hour = timestamp.toISOString().slice(0, 13);
  const hourlyLimit = hourlyOperationLimitForTier(params.entitlementTier);
  const continuationReserve = boardroomContinuationReserveForTier(params.entitlementTier);
  const db = admin.firestore();
  const hourlyRef = db.doc(userLedgerDocument(params.userId, `hourly-${hour}`));
  const continuationRef = db.doc(`users/${params.userId}/boardroomDispatchState/current`);
  return db.runTransaction(async (tx) => {
    const [hourlySnapshot, continuationSnapshot] = await Promise.all([
      tx.get(hourlyRef),
      tx.get(continuationRef),
    ]);
    const hourlyOperationsUsed = hourlySnapshot.exists
      ? Math.max(0, Number(hourlySnapshot.data()?.operationCount) || 0)
      : 0;
    const continuationData = continuationSnapshot.exists ? continuationSnapshot.data() || {} : {};
    const activeLease = continuationData.activeLease && typeof continuationData.activeLease === 'object'
      ? continuationData.activeLease as Record<string, unknown>
      : undefined;
    const activeLeaseExpiresAtMs = Number(activeLease?.expiresAtMs);
    const activeLeaseSlots = activeLease?.remainingSlotsByAgent
      && typeof activeLease.remainingSlotsByAgent === 'object'
      ? activeLease.remainingSlotsByAgent as Record<string, unknown>
      : {};
    const activeLeaseStillOwnsCapacity = typeof activeLease?.id === 'string'
      && Number.isFinite(activeLeaseExpiresAtMs)
      && activeLeaseExpiresAtMs > timestamp.getTime();
    if (activeLeaseStillOwnsCapacity) {
      const activeContinuationId = typeof continuationData.nextContinuationAgentId === 'string'
        ? continuationData.nextContinuationAgentId
        : undefined;
      const activeContinuationIndex = activeContinuationId
        ? params.agentIds.indexOf(activeContinuationId)
        : -1;
      const deferredAgentIds = activeContinuationIndex > 0
        ? [...params.agentIds.slice(activeContinuationIndex), ...params.agentIds.slice(0, activeContinuationIndex)]
        : [...params.agentIds];
      const nextContinuationAgentId = deferredAgentIds[0] ?? null;
      return {
        type: 'BOARDROOM_DISPATCH_PLAN',
        code: 'BOARDROOM_DISPATCH_ACTIVE_TURN',
        executedAgentIds: [],
        deferredAgentIds,
        maxIterationsPerAgent: BOARDROOM_MAX_ITERATIONS_PER_AGENT,
        hourlyOperationsUsed,
        hourlyOperationLimit: Number.isFinite(hourlyLimit) ? hourlyLimit : null,
        continuationReserve,
        nextContinuationAgentId,
        leaseId: null,
        leaseExpiresAtMs: activeLeaseExpiresAtMs,
        sideEffectOwnerAgentId: null,
      };
    }

    const expiredLeaseAgentId = Array.isArray(activeLease?.executedAgentIds)
      ? activeLease.executedAgentIds.find(agentId => (
        typeof agentId === 'string'
        && params.agentIds.includes(agentId)
        && Number(activeLeaseSlots[agentId]) > 0
      ))
      : undefined;
    const continuationAgentId = expiredLeaseAgentId
      || continuationData.nextContinuationAgentId;
    const continuationIndex = typeof continuationAgentId === 'string'
      ? params.agentIds.indexOf(continuationAgentId)
      : -1;
    const continuationOrderedAgentIds = continuationIndex > 0
      ? [...params.agentIds.slice(continuationIndex), ...params.agentIds.slice(0, continuationIndex)]
      : [...params.agentIds];
    const preferredOwnerAgentId = params.agentIds.includes('generalist')
      ? 'generalist'
      : continuationOrderedAgentIds[0];
    const orderedAgentIds = preferredOwnerAgentId
      ? [preferredOwnerAgentId, ...continuationOrderedAgentIds.filter(agentId => agentId !== preferredOwnerAgentId)]
      : continuationOrderedAgentIds;
    const availableCalls = Number.isFinite(hourlyLimit)
      ? Math.max(0, hourlyLimit - hourlyOperationsUsed - continuationReserve)
      : Number.POSITIVE_INFINITY;
    const affordableAgents = Number.isFinite(availableCalls)
      ? Math.floor(availableCalls / BOARDROOM_MAX_ITERATIONS_PER_AGENT)
      : MAX_BOARDROOM_AGENTS_PER_TURN;
    const executeCount = Math.min(
      orderedAgentIds.length,
      MAX_BOARDROOM_AGENTS_PER_TURN,
      affordableAgents,
    );
    const executedAgentIds = orderedAgentIds.slice(0, executeCount);
    const deferredAgentIds = orderedAgentIds.slice(executeCount);
    const nextContinuationAgentId = deferredAgentIds[0] ?? null;
    const leaseExpiresAtMs = executedAgentIds.length > 0
      ? timestamp.getTime() + BOARDROOM_DISPATCH_LEASE_TTL_MS
      : null;
    tx.set(continuationRef, {
      userId: params.userId,
      nextContinuationAgentId,
      lastPlannedHour: hour,
      activeLease: executedAgentIds.length > 0 ? {
        id: leaseId,
        hour,
        executedAgentIds,
        remainingSlotsByAgent: Object.fromEntries(
          executedAgentIds.map(agentId => [agentId, BOARDROOM_MAX_ITERATIONS_PER_AGENT]),
        ),
        reservationIds: [],
        sideEffectOwnerAgentId: executedAgentIds[0] ?? null,
        sideEffectReservationId: null,
        createdAtMs: timestamp.getTime(),
        expiresAtMs: leaseExpiresAtMs,
      } : null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return {
      type: 'BOARDROOM_DISPATCH_PLAN',
      code: executedAgentIds.length > 0
        ? 'BOARDROOM_DISPATCH_READY'
        : 'BOARDROOM_DISPATCH_BUDGET_EXHAUSTED',
      executedAgentIds,
      deferredAgentIds,
      maxIterationsPerAgent: BOARDROOM_MAX_ITERATIONS_PER_AGENT,
      hourlyOperationsUsed,
      hourlyOperationLimit: Number.isFinite(hourlyLimit) ? hourlyLimit : null,
      continuationReserve,
      nextContinuationAgentId,
      leaseId: executedAgentIds.length > 0 ? leaseId : null,
      leaseExpiresAtMs,
      sideEffectOwnerAgentId: executedAgentIds[0] ?? null,
    };
  });
}

export async function completeBoardroomDispatchLease(params: {
  userId: string;
  leaseId: string;
}): Promise<void> {
  const db = admin.firestore();
  const stateRef = db.doc(`users/${params.userId}/boardroomDispatchState/current`);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(stateRef);
    if (!snapshot.exists) return;
    const data = snapshot.data() || {};
    const activeLease = data.activeLease && typeof data.activeLease === 'object'
      ? data.activeLease as Record<string, unknown>
      : undefined;
    if (!activeLease) return;
    if (activeLease.id !== params.leaseId) {
      throw new Error('Boardroom dispatch lease does not match the active owner lease.');
    }
    const reservationIds = Array.isArray(activeLease.reservationIds)
      ? activeLease.reservationIds.filter((id): id is string => typeof id === 'string')
      : [];
    if (reservationIds.length > 0) {
      throw new Error('Boardroom dispatch still has active model work.');
    }
    const executedAgentIds = Array.isArray(activeLease.executedAgentIds)
      ? activeLease.executedAgentIds.filter((id): id is string => typeof id === 'string')
      : [];
    const remainingSlotsByAgent = activeLease.remainingSlotsByAgent
      && typeof activeLease.remainingSlotsByAgent === 'object'
      ? activeLease.remainingSlotsByAgent as Record<string, unknown>
      : {};
    if (executedAgentIds.some(agentId => Number(remainingSlotsByAgent[agentId]) >= BOARDROOM_MAX_ITERATIONS_PER_AGENT)) {
      throw new Error('Boardroom dispatch cannot complete before every planned agent starts.');
    }
    const sideEffectReservationId = typeof activeLease.sideEffectReservationId === 'string'
      ? activeLease.sideEffectReservationId
      : undefined;
    if (sideEffectReservationId) {
      const sideEffectReservation = await tx.get(db.doc(`costLedger/${sideEffectReservationId}`));
      const status = sideEffectReservation.exists ? sideEffectReservation.data()?.status : undefined;
      if (status !== 'SETTLED' && status !== 'VOIDED') {
        throw new Error('Boardroom generation work is not terminal.');
      }
    }
    tx.set(stateRef, {
      activeLease: null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export const expireStaleOperationCostReservations = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Etc/UTC', region: 'us-central1' },
  async () => {
    const [expired, reconciledVideoClaims, reconciledAgentStreamClaims] = await Promise.all([
      expireStaleOperationReservations(),
      reconcileStaleClaimedVideoReservations(),
      reconcileStaleClaimedAgentStreamReservations(),
    ]);
    console.info('[CostControl] Reconciled stale reservations', { expired, reconciledVideoClaims, reconciledAgentStreamClaims });
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
  { ...costCallableSecurityOptions, region: 'us-central1', maxInstances: 10, timeoutSeconds: 30 },
  async (
    request: functions.https.CallableRequest<unknown>,
  ): Promise<CostEnforcementResponse> => {
    const { userId, entitlement } = await requireCostCallableAdmission(request, 'reserve-cost');
    const req = parseCostEnforcementRequest(request.data);

    return checkOperationBudget({
      userId,
      entitlementTier: entitlementTierToBudgetTier(entitlement.tier),
      estimatedCost: req.estimatedCost,
      operationType: req.operationType,
      metadata: req.metadata,
    });
  },
);

/**
 * Returns the server-owned execution/defer plan for one Boardroom turn.
 * Aggregate operationCount includes active holds and settled work; VOIDED
 * reservations decrement it. The per-call reservation transaction remains the
 * hard boundary if another turn races this advisory allocation.
 */
export const planBoardroomAgentStreamDispatch = functions.https.onCall(
  { ...costCallableSecurityOptions, region: 'us-central1', maxInstances: 10, timeoutSeconds: 30 },
  async (request: functions.https.CallableRequest<unknown>): Promise<BoardroomDispatchPlan> => {
    const { userId, entitlement } = await requireCostCallableAdmission(request, 'plan-boardroom-agent-stream');
    const agentIds = parseBoardroomDispatchAgentIds(request.data);
    return buildBoardroomDispatchPlan({
      userId,
      entitlementTier: entitlementTierToBudgetTier(entitlement.tier),
      agentIds,
    });
  },
);

export const completeBoardroomAgentStreamDispatch = functions.https.onCall(
  { ...costCallableSecurityOptions, region: 'us-central1', maxInstances: 10, timeoutSeconds: 30 },
  async (request: functions.https.CallableRequest<unknown>): Promise<{ completed: true }> => {
    const { userId } = await requireCostCallableAdmission(request, 'complete-boardroom-agent-stream');
    await completeBoardroomDispatchLease({
      userId,
      leaseId: parseBoardroomDispatchLeaseId(request.data),
    });
    return { completed: true };
  },
);

export const voidAgentStreamCostReservation = functions.https.onCall(
  { ...costCallableSecurityOptions, region: 'us-central1', maxInstances: 10, timeoutSeconds: 30 },
  async (request: functions.https.CallableRequest<unknown>): Promise<{ voided: true }> => {
    const { userId } = await requireCostCallableAdmission(request, 'void-agent-stream-cost');
    const operationId = parseOperationReservationId(request.data);
    try {
      await finalizeOperationReservation({ userId, operationId, outcome: 'VOIDED', expectedType: 'agent_stream' });
      return { voided: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = message.includes('owner mismatch') ? 'permission-denied'
        : message.startsWith('Missing cost reservation') ? 'not-found' : 'failed-precondition';
      throw new functions.https.HttpsError(code, code === 'permission-denied'
        ? 'Cost reservation does not belong to the authenticated user.' : message);
    }
  },
);

/**
 * Owner-scoped billing receipt for UI. Aggregate ledgers include approved
 * holds, so the pending breakdown is returned explicitly rather than making
 * a renderer guess from mutable client state.
 */
export const getOperationCostStatus = functions.https.onCall(
  { ...costCallableSecurityOptions, region: 'us-central1', maxInstances: 20, timeoutSeconds: 30 },
  async (request: functions.https.CallableRequest<unknown>): Promise<CostStatusResponse> => {
    const { userId, entitlement } = await requireCostCallableAdmission(request, 'read-cost-status');
    const timestamp = new Date();
    const today = timestamp.toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const db = admin.firestore();
    const [dailySnap, monthlySnap, pendingSnap, settledSnap, voidedSnap] = await Promise.all([
      db.doc(userLedgerDocument(userId, `daily-${today}`)).get(),
      db.doc(userLedgerDocument(userId, `monthly-${month}`)).get(),
      db.collection('costLedger')
        .where('userId', '==', userId)
        .where('status', '==', 'APPROVED')
        .limit(100)
        .get(),
      db.collection('costLedger').where('userId', '==', userId).where('status', '==', 'SETTLED').limit(100).get(),
      db.collection('costLedger').where('userId', '==', userId).where('status', '==', 'VOIDED').limit(100).get(),
    ]);
    const tier = entitlementTierToBudgetTier(entitlement.tier);
    const limits = BUDGET_LIMITS[tier];
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
  { ...costCallableSecurityOptions, region: 'us-central1', maxInstances: 20, timeoutSeconds: 30 },
  async (request: functions.https.CallableRequest<unknown>): Promise<CostOperationHistoryResponse> => {
    const { userId } = await requireCostCallableAdmission(request, 'read-cost-history');
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
    return getOperationCostHistoryPage(userId, { limit, cursor });
  },
);
