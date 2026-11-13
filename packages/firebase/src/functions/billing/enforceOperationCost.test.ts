import { beforeEach, describe, expect, it, vi } from 'vitest';
import firestoreIndexes from '../../../firestore.indexes.json';

const mocks = vi.hoisted(() => ({
  firestore: vi.fn(),
  fromMillis: vi.fn((millis: number) => ({ toMillis: () => millis })),
  onCall: vi.fn((_options, handler) => handler),
  onSchedule: vi.fn((_options, handler) => handler),
  validateAppCheck: vi.fn(),
  requireEntitlement: vi.fn(),
  entitlementTierToBudgetTier: vi.fn(),
  arcjetProtect: vi.fn(),
  arcjetPolicyForEntitlement: vi.fn(),
}));

vi.mock('firebase-functions/v2', () => ({
  https: {
    onCall: mocks.onCall,
    HttpsError: class HttpsError extends Error {
      constructor(public code: string, message: string, public details?: unknown) {
        super(message);
      }
    },
  },
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: mocks.onSchedule,
}));

vi.mock('firebase-admin', () => ({
  firestore: Object.assign(mocks.firestore, {
    Timestamp: { fromMillis: mocks.fromMillis },
  }),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: vi.fn((value: number) => ({ __increment: value })),
    serverTimestamp: vi.fn(() => '__server_timestamp__'),
  },
}));

vi.mock('../../middleware/appCheck', () => ({
  validateAppCheckV2: mocks.validateAppCheck,
}));

vi.mock('../auth/entitlements', () => ({
  requireVerifiedServerEntitlement: mocks.requireEntitlement,
  entitlementTierToBudgetTier: mocks.entitlementTierToBudgetTier,
}));

vi.mock('../security/arcjet', () => ({
  protectAuthenticatedApiRequest: mocks.arcjetProtect,
  policyClassForServerEntitlement: mocks.arcjetPolicyForEntitlement,
}));

vi.mock('../../config/secrets', () => ({
  arcjetKey: { name: 'ARCJET_KEY' },
}));

import {
  buildBoardroomDispatchPlan,
  claimOperationReservation,
  checkOperationBudget,
  completeBoardroomDispatchLease,
  enforceOperationCost,
  expireStaleOperationReservations,
  finalizeAgentStreamReservationTerminal,
  finalizeOperationReservation,
  getOperationCostHistoryPage,
  recordAgentStreamReservationLifecycle,
  reconcileStaleClaimedVideoReservations,
  reconcileStaleClaimedAgentStreamReservations,
  serializeCostOperationHistoryItem,
  voidAgentStreamCostReservation,
} from './enforceOperationCost';

const callEnforceOperationCost = enforceOperationCost as unknown as (request: {
  auth?: { uid: string; token?: Record<string, unknown> };
  data: Record<string, unknown>;
  rawRequest?: Record<string, unknown>;
}) => Promise<unknown>;
const callVoidAgentStreamCostReservation = voidAgentStreamCostReservation as unknown as (request: {
  auth?: { uid: string; token?: Record<string, unknown> };
  data: Record<string, unknown>;
  rawRequest?: Record<string, unknown>;
}) => Promise<unknown>;

function timestamp(millis: number) {
  return { toMillis: () => millis };
}

function createQuery(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.where = vi.fn(() => query);
  query.orderBy = vi.fn(() => query);
  query.startAfter = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.get = vi.fn(async () => ({ docs }));
  return query;
}

describe('ISSUE-1006 operation cost receipts and expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['APPROVED', 'pending_auto_release', '2026-07-16T20:15:00.000Z'],
    ['SETTLED', 'settled', null],
    ['VOIDED', 'refunded', null],
  ] as const)('serializes %s receipts with an actionable resolution', (status, resolution, autoReleaseAt) => {
    const item = serializeCostOperationHistoryItem('op-1', {
      operationId: 'op-1',
      type: 'image',
      status,
      estimatedCost: 0.12,
      timestamp: timestamp(Date.parse('2026-07-16T20:00:00.000Z')),
      finalizedAt: status === 'APPROVED' ? null : timestamp(Date.parse('2026-07-16T20:01:00.000Z')),
    });

    expect(item).toEqual(expect.objectContaining({
      operationId: 'op-1',
      operationType: 'image',
      status,
      estimatedCost: 0.12,
      resolution,
      autoReleaseAt,
    }));
  });

  it('preserves audio as a first-class operation type in owner receipts', () => {
    expect(serializeCostOperationHistoryItem('audio-op-1', {
      type: 'audio',
      status: 'SETTLED',
      estimatedCost: 0.02,
    }).operationType).toBe('audio');
  });

  it('returns only the owner query as a stable cursor-paginated page', async () => {
    const firstTimestamp = Date.parse('2026-07-16T20:00:00.000Z');
    const secondTimestamp = Date.parse('2026-07-16T19:00:00.000Z');
    const query = createQuery([
      { id: 'op-new', data: () => ({ operationId: 'op-new', userId: 'user-1', type: 'image', status: 'SETTLED', estimatedCost: 0.12, timestamp: timestamp(firstTimestamp) }) },
      { id: 'op-old', data: () => ({ operationId: 'op-old', userId: 'user-1', type: 'video', status: 'VOIDED', estimatedCost: 0.5, timestamp: timestamp(secondTimestamp) }) },
      { id: 'op-extra', data: () => ({ operationId: 'op-extra', userId: 'user-1', type: 'image', status: 'APPROVED', estimatedCost: 0.08, timestamp: timestamp(secondTimestamp - 1) }) },
    ]);
    mocks.firestore.mockReturnValue({ collection: vi.fn(() => query) });

    const page = await getOperationCostHistoryPage('user-1', {
      limit: 2,
      cursor: { timestampMs: firstTimestamp + 1, operationId: 'op-cursor' },
    });

    expect(query.where).toHaveBeenCalledWith('userId', '==', 'user-1');
    expect(query.orderBy).toHaveBeenNthCalledWith(1, 'timestamp', 'desc');
    expect(query.orderBy).toHaveBeenNthCalledWith(2, 'operationId', 'desc');
    expect(query.startAfter).toHaveBeenCalledWith(expect.anything(), 'op-cursor');
    expect(query.limit).toHaveBeenCalledWith(3);
    expect(page.operations.map(operation => operation.operationId)).toEqual(['op-new', 'op-old']);
    expect(page).toEqual(expect.objectContaining({
      hasMore: true,
      nextCursor: { timestampMs: secondTimestamp, operationId: 'op-old' },
    }));
  });

  it('expires valid stale holds once while skipping malformed and raced reservations', async () => {
    const query = createQuery([
      { id: 'op-stale', data: () => ({ userId: 'user-1' }) },
      { id: 'op-malformed', data: () => ({}) },
      { id: 'op-raced', data: () => ({ userId: 'user-1' }) },
    ]);
    mocks.firestore.mockReturnValue({ collection: vi.fn(() => query) });
    const finalize = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('already SETTLED'));

    await expect(expireStaleOperationReservations(
      new Date('2026-07-16T20:30:00.000Z'),
      finalize,
    )).resolves.toBe(1);

    expect(finalize).toHaveBeenCalledTimes(2);
    expect(finalize).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      operationId: 'op-stale',
      outcome: 'VOIDED',
    });
    expect(finalize).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      operationId: 'op-raced',
      outcome: 'VOIDED',
    });
  });

  it('settles rather than refunds a stale hold when its durable creative job completed', async () => {
    const query = createQuery([
      {
        id: 'audio-op-1',
        data: () => ({ userId: 'user-1', metadata: { jobId: 'audio-job-1' } }),
      },
    ]);
    const db = {
      collection: vi.fn(() => query),
      doc: vi.fn(() => ({
        get: vi.fn(async () => ({ exists: true, data: () => ({ status: 'completed' }) })),
      })),
    };
    mocks.firestore.mockReturnValue(db);
    const finalize = vi.fn().mockResolvedValue(undefined);

    await expect(expireStaleOperationReservations(
      new Date('2026-07-16T20:30:00.000Z'),
      finalize,
    )).resolves.toBe(1);

    expect(finalize).toHaveBeenCalledWith({
      userId: 'user-1',
      operationId: 'audio-op-1',
      outcome: 'SETTLED',
    });
  });

  it('keeps a stale video hold while its durable session is active, then settles completion', async () => {
    const query = createQuery([
      {
        id: 'video-session-session-1',
        data: () => ({ userId: 'user-1', metadata: { videoSessionId: 'session-1' } }),
      },
    ]);
    let sessionStatus = 'processing';
    const db = {
      collection: vi.fn(() => query),
      doc: vi.fn(() => ({
        get: vi.fn(async () => ({
          exists: true,
          data: () => ({ status: sessionStatus }),
        })),
      })),
    };
    mocks.firestore.mockReturnValue(db);
    const finalize = vi.fn().mockResolvedValue(undefined);

    await expect(expireStaleOperationReservations(
      new Date('2026-07-16T20:30:00.000Z'),
      finalize,
    )).resolves.toBe(0);
    expect(finalize).not.toHaveBeenCalled();

    sessionStatus = 'completed';
    await expect(expireStaleOperationReservations(
      new Date('2026-07-16T20:31:00.000Z'),
      finalize,
    )).resolves.toBe(1);
    expect(finalize).toHaveBeenCalledWith({
      userId: 'user-1',
      operationId: 'video-session-session-1',
      outcome: 'SETTLED',
    });
  });

  it('settles a stale claimed video reservation only from matching durable output evidence', async () => {
    const query = createQuery([
      {
        id: 'video-op-1',
        data: () => ({ userId: 'user-1', type: 'video', claimedJobId: 'video-job-1' }),
      },
    ]);
    const db = {
      collection: vi.fn(() => query),
      doc: vi.fn(() => ({
        get: vi.fn(async () => ({
          exists: true,
          data: () => ({
            userId: 'user-1',
            costReservationId: 'video-op-1',
            workerVersion: 'gateway-video-v3',
            status: 'processing',
            providerSubmissionState: 'succeeded_pending_settlement',
            resultUri: 'gs://project.appspot.com/generated/user-1/video.mp4',
          }),
        })),
      })),
    };
    mocks.firestore.mockReturnValue(db);
    const finalize = vi.fn().mockResolvedValue(undefined);

    await expect(reconcileStaleClaimedVideoReservations(
      new Date('2026-07-16T20:30:00.000Z'),
      finalize,
    )).resolves.toBe(1);
    expect(query.where).toHaveBeenCalledWith('type', '==', 'video');
    expect(finalize).toHaveBeenCalledWith({
      userId: 'user-1',
      operationId: 'video-op-1',
      outcome: 'SETTLED',
      jobId: 'video-job-1',
    });
  });

  it('voids only explicit pre-provider failures and holds ambiguous claimed video work', async () => {
    const query = createQuery([
      {
        id: 'video-op-safe-void',
        data: () => ({ userId: 'user-1', type: 'video', claimedJobId: 'video-job-safe-void' }),
      },
      {
        id: 'video-op-ambiguous',
        data: () => ({ userId: 'user-1', type: 'video', claimedJobId: 'video-job-ambiguous' }),
      },
    ]);
    const db = {
      collection: vi.fn(() => query),
      doc: vi.fn((path: string) => ({
        get: vi.fn(async () => ({
          exists: true,
          data: () => path.endsWith('video-job-safe-void')
            ? {
                userId: 'user-1',
                costReservationId: 'video-op-safe-void',
                workerVersion: 'gateway-video-v3',
                status: 'failed',
                providerSubmissionState: 'not_submitted',
              }
            : {
                userId: 'user-1',
                costReservationId: 'video-op-ambiguous',
                workerVersion: 'gateway-video-v3',
                status: 'failed',
                providerSubmissionState: 'ambiguous_or_failed',
              },
        })),
      })),
    };
    mocks.firestore.mockReturnValue(db);
    const finalize = vi.fn().mockResolvedValue(undefined);

    await expect(reconcileStaleClaimedVideoReservations(
      new Date('2026-07-16T20:30:00.000Z'),
      finalize,
    )).resolves.toBe(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith({
      userId: 'user-1',
      operationId: 'video-op-safe-void',
      outcome: 'VOIDED',
      jobId: 'video-job-safe-void',
    });
  });

  it('reuses a deterministic video reservation without incrementing aggregate cost twice', async () => {
    const documents = new Map<string, Record<string, unknown>>();
    documents.set('users/user-1', { tier: 'free' });
    const set = vi.fn((
      reference: { path: string },
      values: Record<string, unknown>,
      _options?: { merge?: boolean },
    ) => {
      const current = { ...(documents.get(reference.path) || {}) };
      for (const [key, value] of Object.entries(values)) {
        if (value && typeof value === 'object' && '__increment' in value) {
          current[key] = Number(current[key] || 0) + Number((value as { __increment: number }).__increment);
        } else {
          current[key] = value;
        }
      }
      documents.set(reference.path, current);
    });
    const transaction = {
      get: vi.fn(async (reference: { path: string }) => {
        const data = documents.get(reference.path);
        return { exists: Boolean(data), data: () => data };
      }),
      set,
    };
    const db = {
      doc: vi.fn((path: string) => ({ path })),
      collection: vi.fn((name: string) => ({
        doc: vi.fn((id: string) => ({ path: `${name}/${id}` })),
      })),
      runTransaction: vi.fn(async (
        handler: (tx: typeof transaction) => Promise<unknown>,
      ) => handler(transaction)),
    };
    mocks.firestore.mockReturnValue(db);
    const request = {
      userId: 'user-1',
      entitlementTier: 'free' as const,
      estimatedCost: 0.25,
      operationType: 'video' as const,
      operationId: 'video-session-session-1',
      metadata: { videoSessionId: 'session-1' },
    };

    const first = await checkOperationBudget(request);
    const retry = await checkOperationBudget(request);

    expect(first).toEqual(expect.objectContaining({
      allowed: true,
      operationId: 'video-session-session-1',
    }));
    expect(retry).toEqual(expect.objectContaining({
      allowed: true,
      operationId: 'video-session-session-1',
    }));
    expect(set.mock.calls.filter(([reference]) =>
      (reference as { path: string }).path === 'costLedger/video-session-session-1',
    )).toHaveLength(1);
    const daily = [...documents.entries()].find(([path]) => path.includes('/daily-'))?.[1];
    expect(daily?.totalCost).toBe(0.25);
    expect(daily?.operationCount).toBe(1);
  });

  it('voids and refunds every aggregate exactly once', async () => {
    const state: Record<string, unknown> = {
      userId: 'user-1',
      status: 'APPROVED',
      estimatedCost: 0.5,
      ledgerDocumentPaths: {
        daily: 'users/user-1/costLedger/daily-2026-07-16',
        monthly: 'users/user-1/costLedger/monthly-2026-07',
        hourly: 'users/user-1/costLedger/hourly-2026-07-16T20',
      },
    };
    const update = vi.fn((_ref, values: Record<string, unknown>) => Object.assign(state, values));
    const set = vi.fn();
    const transaction = {
      get: vi.fn(async () => ({ exists: true, data: () => ({ ...state }) })),
      update,
      set,
    };
    const db = {
      doc: vi.fn((path: string) => ({ path })),
      runTransaction: vi.fn(async (handler: (tx: typeof transaction) => Promise<void>) => handler(transaction)),
    };
    mocks.firestore.mockReturnValue(db);

    await finalizeOperationReservation({ userId: 'user-1', operationId: 'op-1', outcome: 'VOIDED' });
    await finalizeOperationReservation({ userId: 'user-1', operationId: 'op-1', outcome: 'VOIDED' });

    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(3);
    for (const [, refund] of set.mock.calls) {
      expect(refund).toEqual(expect.objectContaining({
        totalCost: { __increment: -0.5 },
        operationCount: { __increment: -1 },
      }));
    }
  });

  it('requires the matching authoritative job to finalize a claimed reservation', async () => {
    const state: Record<string, unknown> = {
      userId: 'user-1',
      status: 'CLAIMED',
      claimedJobId: 'video-job-1',
      estimatedCost: 0.5,
      ledgerDocumentPaths: {
        daily: 'users/user-1/costLedger/daily-2026-07-16',
      },
    };
    const transaction = {
      get: vi.fn(async () => ({ exists: true, data: () => ({ ...state }) })),
      update: vi.fn((_ref, values: Record<string, unknown>) => Object.assign(state, values)),
      set: vi.fn(),
    };
    const db = {
      doc: vi.fn((path: string) => ({ path })),
      runTransaction: vi.fn(async (handler: (tx: typeof transaction) => Promise<void>) => handler(transaction)),
    };
    mocks.firestore.mockReturnValue(db);

    await expect(finalizeOperationReservation({
      userId: 'user-1',
      operationId: 'op-1',
      outcome: 'SETTLED',
      jobId: 'wrong-job',
    })).rejects.toThrow('claim does not match');
    await expect(finalizeOperationReservation({
      userId: 'user-1',
      operationId: 'op-1',
      outcome: 'SETTLED',
      jobId: 'video-job-1',
    })).resolves.toBeUndefined();
    expect(transaction.update).toHaveBeenCalledTimes(1);
  });

  it('claims only the authenticated owner\'s approved agent-stream reservation of the matching type', async () => {
    const state: Record<string, unknown> = { userId: 'user-1', type: 'agent_stream', status: 'APPROVED' };
    const transaction = {
      get: vi.fn(async () => ({ exists: true, data: () => ({ ...state }) })),
      update: vi.fn((_ref, value) => Object.assign(state, value)),
    };
    mocks.firestore.mockReturnValue({ doc: vi.fn((path: string) => ({ path })), runTransaction: vi.fn((fn) => fn(transaction)) });
    await claimOperationReservation({ userId: 'user-1', operationId: 'op-1', operationType: 'agent_stream', claimId: 'claim-1' });
    expect(state).toMatchObject({
      status: 'CLAIMED',
      claimedJobId: 'claim-1',
      agentStreamLifecycleState: 'CLAIMED_NOT_SUBMITTED',
    });
    state.status = 'APPROVED';
    await expect(claimOperationReservation({ userId: 'user-2', operationId: 'op-1', operationType: 'agent_stream', claimId: 'claim-2' })).rejects.toThrow('owner mismatch');
    await expect(claimOperationReservation({ userId: 'user-1', operationId: 'op-1', operationType: 'video', claimId: 'claim-2' })).rejects.toThrow('type mismatch');
    state.status = 'VOIDED';
    await expect(claimOperationReservation({ userId: 'user-1', operationId: 'op-1', operationType: 'agent_stream', claimId: 'claim-2' })).rejects.toThrow('already VOIDED');
  });

  it('voids an owner-scoped unclaimed agent stream', async () => {
    mocks.validateAppCheck.mockReturnValue(undefined);
    mocks.requireEntitlement.mockResolvedValue({ tier: 'free' });
    mocks.entitlementTierToBudgetTier.mockReturnValue('free');
    mocks.arcjetPolicyForEntitlement.mockReturnValue('verified-free');
    mocks.arcjetProtect.mockResolvedValue({ allowed: true });
    const state: Record<string, unknown> = {
      userId: 'user-1', type: 'agent_stream', status: 'APPROVED', estimatedCost: 0.01,
      ledgerDocumentPaths: { daily: 'users/user-1/costLedger/daily-1' },
    };
    const transaction = {
      get: vi.fn(async () => ({ exists: true, data: () => ({ ...state }) })),
      update: vi.fn((_ref, value) => Object.assign(state, value)), set: vi.fn(),
    };
    mocks.firestore.mockReturnValue({ doc: vi.fn((path: string) => ({ path })), runTransaction: vi.fn((fn) => fn(transaction)) });
    await expect(callVoidAgentStreamCostReservation({ auth: { uid: 'user-2', token: { email_verified: true } }, data: { operationId: 'op-1' }, rawRequest: {} })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(state.status).toBe('APPROVED');
    await expect(callVoidAgentStreamCostReservation({ auth: { uid: 'user-1', token: { email_verified: true } }, data: { operationId: 'op-1' }, rawRequest: {} })).resolves.toEqual({ voided: true });
    expect(state.status).toBe('VOIDED');
  });

  it('reconciles agent streams only from authoritative terminal lifecycle evidence', async () => {
    const query = createQuery([
      { id: 'op-completed', data: () => ({ userId: 'user-1', type: 'agent_stream', claimedJobId: 'claim-completed', agentStreamLifecycleState: 'COMPLETED' }) },
      { id: 'op-provider-failed', data: () => ({ userId: 'user-1', type: 'agent_stream', claimedJobId: 'claim-provider-failed', agentStreamLifecycleState: 'PROVIDER_FAILED' }) },
      { id: 'op-provider-cancelled', data: () => ({ userId: 'user-1', type: 'agent_stream', claimedJobId: 'claim-provider-cancelled', agentStreamLifecycleState: 'PROVIDER_CANCELLED' }) },
      { id: 'op-pre-failed', data: () => ({ userId: 'user-1', type: 'agent_stream', claimedJobId: 'claim-pre-failed', agentStreamLifecycleState: 'PRE_SUBMISSION_FAILED' }) },
      { id: 'op-pre-cancelled', data: () => ({ userId: 'user-1', type: 'agent_stream', claimedJobId: 'claim-pre-cancelled', agentStreamLifecycleState: 'PRE_SUBMISSION_CANCELLED' }) },
      { id: 'op-active', data: () => ({ userId: 'user-1', type: 'agent_stream', claimedJobId: 'claim-active', agentStreamLifecycleState: 'PROVIDER_SUBMITTING' }) },
      { id: 'op-admission', data: () => ({ userId: 'user-1', type: 'agent_stream', claimedJobId: 'claim-admission', agentStreamLifecycleState: 'CLAIMED_NOT_SUBMITTED' }) },
      { id: 'op-missing-evidence', data: () => ({ userId: 'user-1', type: 'agent_stream', claimedJobId: 'claim-missing' }) },
    ]);
    mocks.firestore.mockReturnValue({ collection: vi.fn(() => query) });
    const finalize = vi.fn().mockResolvedValue(undefined);
    await expect(reconcileStaleClaimedAgentStreamReservations(new Date(), finalize)).resolves.toBe(6);
    expect(query.where).toHaveBeenCalledWith('type', '==', 'agent_stream');
    expect(query.where).toHaveBeenCalledWith('claimedAt', '<=', expect.anything());
    expect(query.orderBy).toHaveBeenCalledWith('claimedAt', 'asc');
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'op-completed', outcome: 'SETTLED', jobId: 'claim-completed', expectedType: 'agent_stream' }));
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'op-provider-failed', outcome: 'SETTLED', jobId: 'claim-provider-failed', expectedType: 'agent_stream' }));
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'op-provider-cancelled', outcome: 'SETTLED', jobId: 'claim-provider-cancelled', expectedType: 'agent_stream' }));
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'op-pre-failed', outcome: 'VOIDED', jobId: 'claim-pre-failed', expectedType: 'agent_stream' }));
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'op-pre-cancelled', outcome: 'VOIDED', jobId: 'claim-pre-cancelled', expectedType: 'agent_stream' }));
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'op-admission', outcome: 'VOIDED', jobId: 'claim-admission', expectedType: 'agent_stream' }));
    expect(finalize).not.toHaveBeenCalledWith(expect.objectContaining({ operationId: 'op-active' }));
    expect(finalize).not.toHaveBeenCalledWith(expect.objectContaining({ operationId: 'op-missing-evidence' }));
  });

  it('replays completed reconciliation after a transient settlement failure without refunding it', async () => {
    const query = createQuery([
      { id: 'op-completed', data: () => ({ userId: 'user-1', type: 'agent_stream', claimedJobId: 'claim-1', agentStreamLifecycleState: 'COMPLETED' }) },
    ]);
    mocks.firestore.mockReturnValue({ collection: vi.fn(() => query) });
    const finalize = vi.fn()
      .mockRejectedValueOnce(new Error('transient Firestore failure'))
      .mockResolvedValueOnce(undefined);

    await expect(reconcileStaleClaimedAgentStreamReservations(new Date(), finalize)).resolves.toBe(0);
    await expect(reconcileStaleClaimedAgentStreamReservations(new Date(), finalize)).resolves.toBe(1);
    expect(finalize).toHaveBeenCalledTimes(2);
    expect(finalize).toHaveBeenNthCalledWith(2, expect.objectContaining({
      operationId: 'op-completed',
      outcome: 'SETTLED',
    }));
    expect(finalize).not.toHaveBeenCalledWith(expect.objectContaining({ outcome: 'VOIDED' }));
  });

  it('makes concurrent provider-submission intent replay idempotent', async () => {
    const state: Record<string, unknown> = {
      userId: 'user-1',
      type: 'agent_stream',
      status: 'CLAIMED',
      claimedJobId: 'claim-1',
      agentStreamLifecycleState: 'CLAIMED_NOT_SUBMITTED',
    };
    const update = vi.fn((_ref, value: Record<string, unknown>) => Object.assign(state, value));
    const transaction = {
      get: vi.fn(async () => ({ exists: true, data: () => ({ ...state }) })),
      update, set: vi.fn(),
    };
    let transactionTail = Promise.resolve();
    const runTransaction = vi.fn((fn: (tx: typeof transaction) => Promise<void>) => {
      const result = transactionTail.then(() => fn(transaction));
      transactionTail = result.catch(() => undefined);
      return result;
    });
    mocks.firestore.mockReturnValue({ doc: vi.fn((path: string) => ({ path })), runTransaction });
    const params = { userId: 'user-1', operationId: 'op-1', claimId: 'claim-1', state: 'PROVIDER_SUBMITTING' as const };

    await expect(Promise.all([
      recordAgentStreamReservationLifecycle(params),
      recordAgentStreamReservationLifecycle(params),
    ])).resolves.toEqual([undefined, undefined]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('makes concurrent identical atomic terminal outcomes idempotent', async () => {
    const state: Record<string, unknown> = {
      userId: 'user-1', type: 'agent_stream', status: 'CLAIMED', claimedJobId: 'claim-1',
      agentStreamLifecycleState: 'PROVIDER_SUBMITTING', estimatedCost: 0.01,
      ledgerDocumentPaths: { daily: 'users/user-1/costLedger/daily-1' },
    };
    const update = vi.fn((_ref, values: Record<string, unknown>) => Object.assign(state, values));
    const tx = {
      get: vi.fn(async () => ({ exists: true, data: () => ({ ...state }) })),
      update,
      set: vi.fn(),
    };
    let transactionTail = Promise.resolve();
    const runTransaction = vi.fn((fn: (transaction: typeof tx) => Promise<void>) => {
      const result = transactionTail.then(() => fn(tx));
      transactionTail = result.catch(() => undefined);
      return result;
    });
    mocks.firestore.mockReturnValue({ doc: vi.fn((path: string) => ({ path })), runTransaction });
    const terminal = {
      userId: 'user-1', operationId: 'op-1', claimId: 'claim-1', state: 'COMPLETED' as const,
    };

    await expect(Promise.all([
      finalizeAgentStreamReservationTerminal(terminal),
      finalizeAgentStreamReservationTerminal(terminal),
    ])).resolves.toEqual([undefined, undefined]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['PRE_SUBMISSION_FAILED', 'VOIDED'],
    ['PRE_SUBMISSION_CANCELLED', 'VOIDED'],
    ['PROVIDER_FAILED', 'SETTLED'],
    ['PROVIDER_CANCELLED', 'SETTLED'],
    ['COMPLETED', 'SETTLED'],
  ] as const)('atomically maps %s lifecycle evidence to %s', async (terminalState, expectedStatus) => {
    const state: Record<string, unknown> = {
      userId: 'user-1', type: 'agent_stream', status: 'CLAIMED', claimedJobId: 'claim-1',
      agentStreamLifecycleState: terminalState.startsWith('PRE_') ? 'CLAIMED_NOT_SUBMITTED' : 'PROVIDER_SUBMITTING',
      estimatedCost: 0.01,
      ledgerDocumentPaths: { daily: 'users/user-1/costLedger/daily-1' },
    };
    const tx = {
      get: vi.fn(async () => ({ exists: true, data: () => ({ ...state }) })),
      update: vi.fn((_ref, values: Record<string, unknown>) => Object.assign(state, values)),
      set: vi.fn(),
    };
    mocks.firestore.mockReturnValue({
      doc: vi.fn((path: string) => ({ path })),
      runTransaction: vi.fn((fn: (transaction: typeof tx) => Promise<void>) => fn(tx)),
    });

    await finalizeAgentStreamReservationTerminal({
      userId: 'user-1', operationId: 'op-1', claimId: 'claim-1', state: terminalState,
    });

    expect(state).toMatchObject({ status: expectedStatus, agentStreamLifecycleState: terminalState });
    const refundWrites = tx.set.mock.calls.filter(([ref]) => ref.path === 'users/user-1/costLedger/daily-1');
    expect(refundWrites).toHaveLength(expectedStatus === 'VOIDED' ? 1 : 0);
  });

  it('restores exactly one leased slot when an authoritative pre-submission terminal voids', async () => {
    const operationState: Record<string, unknown> = {
      userId: 'user-1', type: 'agent_stream', status: 'CLAIMED', claimedJobId: 'claim-1',
      agentStreamLifecycleState: 'CLAIMED_NOT_SUBMITTED', estimatedCost: 0.01,
      ledgerDocumentPaths: { daily: 'users/user-1/costLedger/daily-1' },
      metadata: {
        boardroomDispatchLeaseId: '88888888-8888-4888-8888-888888888888',
        boardroomAgentId: 'generalist',
      },
    };
    const boardroomState: Record<string, unknown> = {
      activeLease: {
        id: '88888888-8888-4888-8888-888888888888',
        remainingSlotsByAgent: { generalist: 1 },
        reservationIds: ['op-1'],
      },
    };
    const tx = {
      get: vi.fn(async (reference: { path: string }) => reference.path.startsWith('costLedger/')
        ? { exists: true, data: () => ({ ...operationState }) }
        : { exists: true, data: () => ({ ...boardroomState }) }),
      update: vi.fn((_ref, values: Record<string, unknown>) => Object.assign(operationState, values)),
      set: vi.fn((reference: { path: string }, values: Record<string, unknown>) => {
        if (reference.path.endsWith('/boardroomDispatchState/current')) Object.assign(boardroomState, values);
      }),
    };
    mocks.firestore.mockReturnValue({
      doc: vi.fn((path: string) => ({ path })),
      runTransaction: vi.fn((fn: (transaction: typeof tx) => Promise<void>) => fn(tx)),
    });

    await finalizeAgentStreamReservationTerminal({
      userId: 'user-1', operationId: 'op-1', claimId: 'claim-1', state: 'PRE_SUBMISSION_CANCELLED',
    });

    expect(operationState.status).toBe('VOIDED');
    expect(boardroomState.activeLease).toMatchObject({
      remainingSlotsByAgent: { generalist: 2 },
      reservationIds: [],
    });
  });

  it('removes a settled model reservation from the active lease without restoring its consumed slot', async () => {
    const operationState: Record<string, unknown> = {
      userId: 'user-1', type: 'agent_stream', status: 'CLAIMED', claimedJobId: 'claim-settled',
      agentStreamLifecycleState: 'PROVIDER_SUBMITTING', estimatedCost: 0.01,
      metadata: {
        boardroomDispatchLeaseId: '12121212-1212-4212-8212-121212121212',
        boardroomAgentId: 'generalist',
      },
    };
    const boardroomState: Record<string, unknown> = {
      activeLease: {
        id: '12121212-1212-4212-8212-121212121212',
        remainingSlotsByAgent: { generalist: 1 },
        reservationIds: ['op-settled'],
      },
    };
    const tx = {
      get: vi.fn(async (reference: { path: string }) => reference.path.startsWith('costLedger/')
        ? { exists: true, data: () => ({ ...operationState }) }
        : { exists: true, data: () => ({ ...boardroomState }) }),
      update: vi.fn((_ref, values: Record<string, unknown>) => Object.assign(operationState, values)),
      set: vi.fn((reference: { path: string }, values: Record<string, unknown>) => {
        if (reference.path.endsWith('/boardroomDispatchState/current')) Object.assign(boardroomState, values);
      }),
    };
    mocks.firestore.mockReturnValue({
      doc: vi.fn((path: string) => ({ path })),
      runTransaction: vi.fn((fn: (transaction: typeof tx) => Promise<void>) => fn(tx)),
    });

    await finalizeAgentStreamReservationTerminal({
      userId: 'user-1', operationId: 'op-settled', claimId: 'claim-settled', state: 'COMPLETED',
    });

    expect(operationState.status).toBe('SETTLED');
    expect(boardroomState.activeLease).toMatchObject({
      remainingSlotsByAgent: { generalist: 1 },
      reservationIds: [],
    });
  });

  it.each([
    ['free', 0, 2, ['generalist', 'marketing'], ['legal', 'finance'], 5, 1],
    ['pro', 0, 4, ['generalist', 'marketing', 'legal', 'finance'], [], 20, 2],
    ['pro', 18, 0, [], ['generalist', 'marketing', 'legal', 'finance'], 20, 2],
    ['founder', 999, 4, ['generalist', 'marketing', 'legal', 'finance'], [], null, 0],
  ] as const)(
    'builds a reservation-aware %s Boardroom plan at %s hourly operations',
    async (tier, hourlyOperationsUsed, expectedCount, executed, deferred, hourlyOperationLimit, continuationReserve) => {
      const tx = {
        get: vi.fn(async (reference: { path: string }) => reference.path.includes('/hourly-')
          ? { exists: true, data: () => ({ operationCount: hourlyOperationsUsed }) }
          : { exists: false, data: () => undefined }),
        set: vi.fn(),
      };
      mocks.firestore.mockReturnValue({
        doc: vi.fn((path: string) => ({ path })),
        runTransaction: vi.fn((fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)),
      });
      const plan = await buildBoardroomDispatchPlan({
        userId: 'user-1',
        entitlementTier: tier,
        agentIds: ['generalist', 'marketing', 'legal', 'finance'],
        now: new Date('2026-08-01T12:30:00.000Z'),
        leaseId: '11111111-1111-4111-8111-111111111111',
      });

      expect(plan.executedAgentIds).toEqual(executed);
      expect(plan.deferredAgentIds).toEqual(deferred);
      expect(plan.executedAgentIds).toHaveLength(expectedCount);
      expect(plan).toMatchObject({ hourlyOperationLimit, continuationReserve, maxIterationsPerAgent: 2 });
      expect(plan.leaseId).toBe(expectedCount > 0 ? '11111111-1111-4111-8111-111111111111' : null);
      expect(plan.nextContinuationAgentId).toBe(deferred[0] ?? null);
      expect(tx.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user-1/boardroomDispatchState/current' }),
        expect.objectContaining({ nextContinuationAgentId: deferred[0] ?? null }),
        { merge: true },
      );
    },
  );

  it('continues from the server-owned deferred agent before cycling the seated roster', async () => {
    const tx = {
      get: vi.fn(async (reference: { path: string }) => reference.path.includes('/hourly-')
        ? { exists: true, data: () => ({ operationCount: 0 }) }
        : { exists: true, data: () => ({ nextContinuationAgentId: 'legal' }) }),
      set: vi.fn(),
    };
    mocks.firestore.mockReturnValue({
      doc: vi.fn((path: string) => ({ path })),
      runTransaction: vi.fn((fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)),
    });

    const plan = await buildBoardroomDispatchPlan({
      userId: 'user-1',
      entitlementTier: 'free',
      agentIds: ['generalist', 'marketing', 'legal', 'finance'],
      now: new Date('2026-08-01T13:00:00.000Z'),
      leaseId: '22222222-2222-4222-8222-222222222222',
    });

    expect(plan.executedAgentIds).toEqual(['generalist', 'legal']);
    expect(plan.deferredAgentIds).toEqual(['finance', 'marketing']);
    expect(plan.nextContinuationAgentId).toBe('finance');
    expect(plan.sideEffectOwnerAgentId).toBe('generalist');
  });

  it('serializes concurrent Boardroom plans behind one active owner lease', async () => {
    const state: Record<string, unknown> = {};
    const tx = {
      get: vi.fn(async (reference: { path: string }) => reference.path.includes('/hourly-')
        ? { exists: true, data: () => ({ operationCount: 0 }) }
        : { exists: Object.keys(state).length > 0, data: () => ({ ...state }) }),
      set: vi.fn((reference: { path: string }, values: Record<string, unknown>) => {
        if (reference.path.endsWith('/boardroomDispatchState/current')) Object.assign(state, values);
      }),
    };
    let transactionTail = Promise.resolve();
    const runTransaction = vi.fn((fn: (transaction: typeof tx) => Promise<unknown>) => {
      const result = transactionTail.then(() => fn(tx));
      transactionTail = result.then(() => undefined, () => undefined);
      return result;
    });
    mocks.firestore.mockReturnValue({ doc: vi.fn((path: string) => ({ path })), runTransaction });

    const [first, second] = await Promise.all([
      buildBoardroomDispatchPlan({ userId: 'user-1', entitlementTier: 'pro', agentIds: ['generalist', 'legal'], now: new Date('2026-08-01T14:00:00Z'), leaseId: '33333333-3333-4333-8333-333333333333' }),
      buildBoardroomDispatchPlan({ userId: 'user-1', entitlementTier: 'pro', agentIds: ['generalist', 'legal'], now: new Date('2026-08-01T14:00:01Z'), leaseId: '44444444-4444-4444-8444-444444444444' }),
    ]);

    expect(first).toMatchObject({ code: 'BOARDROOM_DISPATCH_READY', leaseId: '33333333-3333-4333-8333-333333333333' });
    expect(second).toMatchObject({ code: 'BOARDROOM_DISPATCH_ACTIVE_TURN', executedAgentIds: [], leaseId: null });
  });

  it('atomically consumes an advertised agent slot when creating its agent-stream reservation', async () => {
    const currentHour = new Date().toISOString().slice(0, 13);
    const activeLease = {
      id: '77777777-7777-4777-8777-777777777777',
      hour: currentHour,
      executedAgentIds: ['generalist'],
      remainingSlotsByAgent: { generalist: 2 },
      reservationIds: [],
      expiresAtMs: Date.now() + 60_000,
    };
    const boardroomWrites: Record<string, unknown>[] = [];
    const tx = {
      get: vi.fn(async (reference: { path: string }) => {
        if (reference.path.endsWith('/boardroomDispatchState/current')) {
          return { exists: true, data: () => ({ activeLease }) };
        }
        return { exists: false, data: () => undefined };
      }),
      set: vi.fn((reference: { path: string }, values: Record<string, unknown>) => {
        if (reference.path.endsWith('/boardroomDispatchState/current')) boardroomWrites.push(values);
      }),
    };
    mocks.firestore.mockReturnValue({
      doc: vi.fn((path: string) => ({ path })),
      collection: vi.fn(() => ({ doc: vi.fn((id: string) => ({ path: `incidents/${id}` })) })),
      runTransaction: vi.fn((fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)),
    });

    const result = await checkOperationBudget({
      userId: 'user-1', operationType: 'agent_stream', estimatedCost: 0.001, entitlementTier: 'pro',
      operationId: 'op-boardroom-1',
      metadata: {
        boardroomDispatchLeaseId: '77777777-7777-4777-8777-777777777777',
        boardroomAgentId: 'generalist',
      },
    });

    expect(result).toMatchObject({ allowed: true, operationId: 'op-boardroom-1' });
    expect(boardroomWrites).toContainEqual(expect.objectContaining({
      activeLease: expect.objectContaining({
        remainingSlotsByAgent: { generalist: 1 },
        reservationIds: ['op-boardroom-1'],
      }),
    }));
  });

  it('serializes concurrent reservations so one advertised slot cannot be double-spent', async () => {
    const currentHour = new Date().toISOString().slice(0, 13);
    let activeLease: Record<string, unknown> = {
      id: '88888888-8888-4888-8888-888888888888',
      hour: currentHour,
      executedAgentIds: ['generalist'],
      remainingSlotsByAgent: { generalist: 1 },
      reservationIds: [],
      expiresAtMs: Date.now() + 60_000,
    };
    const tx = {
      get: vi.fn(async (reference: { path: string }) => {
        if (reference.path.endsWith('/boardroomDispatchState/current')) {
          return { exists: true, data: () => ({ activeLease }) };
        }
        return { exists: false, data: () => undefined };
      }),
      set: vi.fn((reference: { path: string }, values: Record<string, unknown>) => {
        if (reference.path.endsWith('/boardroomDispatchState/current')) {
          activeLease = values.activeLease as Record<string, unknown>;
        }
      }),
    };
    let transactionTail = Promise.resolve();
    const runTransaction = vi.fn((fn: (transaction: typeof tx) => Promise<unknown>) => {
      const result = transactionTail.then(() => fn(tx));
      transactionTail = result.then(() => undefined, () => undefined);
      return result;
    });
    mocks.firestore.mockReturnValue({
      doc: vi.fn((path: string) => ({ path })),
      collection: vi.fn(() => ({ doc: vi.fn((id: string) => ({ path: `incidents/${id}` })) })),
      runTransaction,
    });

    const reservation = (operationId: string) => checkOperationBudget({
      userId: 'user-1', operationType: 'agent_stream', estimatedCost: 0.001, entitlementTier: 'pro',
      operationId,
      metadata: {
        boardroomDispatchLeaseId: '88888888-8888-4888-8888-888888888888',
        boardroomAgentId: 'generalist',
      },
    });
    const [first, second] = await Promise.all([
      reservation('op-boardroom-concurrent-1'),
      reservation('op-boardroom-concurrent-2'),
    ]);

    expect(first).toMatchObject({ allowed: true, operationId: 'op-boardroom-concurrent-1' });
    expect(second).toMatchObject({
      allowed: false,
      reason: 'Boardroom dispatch lease is missing, expired, or has no slot for this agent.',
    });
    expect(activeLease).toMatchObject({
      remainingSlotsByAgent: { generalist: 0 },
      reservationIds: ['op-boardroom-concurrent-1'],
    });
  });

  it('reclaims an expired lease from its first unconsumed agent and supports explicit completion', async () => {
    const state: Record<string, unknown> = {
      nextContinuationAgentId: 'legal',
      activeLease: {
        id: '55555555-5555-4555-8555-555555555555', hour: '2026-08-01T14',
        executedAgentIds: ['generalist', 'marketing'],
        remainingSlotsByAgent: { generalist: 0, marketing: 1 },
        reservationIds: ['op-1'], expiresAtMs: Date.parse('2026-08-01T14:10:00Z'),
      },
    };
    const tx = {
      get: vi.fn(async (reference: { path: string }) => reference.path.includes('/hourly-')
        ? { exists: true, data: () => ({ operationCount: 1 }) }
        : { exists: true, data: () => ({ ...state }) }),
      set: vi.fn((_reference: { path: string }, values: Record<string, unknown>) => Object.assign(state, values)),
    };
    mocks.firestore.mockReturnValue({
      doc: vi.fn((path: string) => ({ path })),
      runTransaction: vi.fn((fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)),
    });

    const plan = await buildBoardroomDispatchPlan({
      userId: 'user-1', entitlementTier: 'free', agentIds: ['generalist', 'marketing', 'legal'],
      now: new Date('2026-08-01T14:16:00Z'), leaseId: '66666666-6666-4666-8666-666666666666',
    });
    expect(plan.executedAgentIds[0]).toBe('generalist');
    expect(plan.nextContinuationAgentId).toBe('marketing');

    await expect(completeBoardroomDispatchLease({
      userId: 'user-1', leaseId: '66666666-6666-4666-8666-666666666666',
    })).rejects.toThrow('before every planned agent starts');
    const activeLease = state.activeLease as Record<string, unknown>;
    activeLease.remainingSlotsByAgent = { generalist: 1, marketing: 1 };
    activeLease.reservationIds = [];
    await completeBoardroomDispatchLease({ userId: 'user-1', leaseId: '66666666-6666-4666-8666-666666666666' });
    expect(state.activeLease).toBeNull();
  });

  it('admits one Boardroom image reservation only for the server-selected side-effect owner', async () => {
    const currentHour = new Date().toISOString().slice(0, 13);
    let activeLease: Record<string, unknown> = {
      id: '99999999-9999-4999-8999-999999999999',
      hour: currentHour,
      executedAgentIds: ['generalist', 'creative'],
      remainingSlotsByAgent: { generalist: 1, creative: 1 },
      reservationIds: [],
      sideEffectOwnerAgentId: 'generalist',
      sideEffectReservationId: null,
      expiresAtMs: Date.now() + 60_000,
    };
    const tx = {
      get: vi.fn(async (reference: { path: string }) => reference.path.endsWith('/boardroomDispatchState/current')
        ? { exists: true, data: () => ({ activeLease }) }
        : { exists: false, data: () => undefined }),
      set: vi.fn((reference: { path: string }, values: Record<string, unknown>) => {
        if (reference.path.endsWith('/boardroomDispatchState/current')) {
          activeLease = values.activeLease as Record<string, unknown>;
        }
      }),
    };
    mocks.firestore.mockReturnValue({
      doc: vi.fn((path: string) => ({ path })),
      collection: vi.fn(() => ({ doc: vi.fn((id: string) => ({ path: `incidents/${id}` })) })),
      runTransaction: vi.fn((fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)),
    });

    const reserveImage = (operationId: string, boardroomAgentId: string) => checkOperationBudget({
      userId: 'user-1', operationType: 'image', estimatedCost: 0.04, entitlementTier: 'pro', operationId,
      metadata: {
        boardroomDispatchLeaseId: '99999999-9999-4999-8999-999999999999',
        boardroomAgentId,
      },
    });

    await expect(reserveImage('image-advisory', 'creative')).resolves.toMatchObject({ allowed: false });
    await expect(reserveImage('image-owner', 'generalist')).resolves.toMatchObject({ allowed: true });
    await expect(reserveImage('image-owner-second', 'generalist')).resolves.toMatchObject({ allowed: false });
    expect(activeLease).toMatchObject({
      sideEffectOwnerAgentId: 'generalist',
      sideEffectReservationId: 'image-owner',
      remainingSlotsByAgent: { generalist: 1, creative: 1 },
    });
  });

  it('preserves expiry indexes while adding claimedAt lifecycle reconciliation', () => {
    const costLedgerFields = firestoreIndexes.indexes
      .filter(index => index.collectionGroup === 'costLedger')
      .map(index => index.fields.map(field => field.fieldPath).join(','));

    expect(costLedgerFields).toContain('status,timestamp');
    expect(costLedgerFields).toContain('status,type,timestamp');
    expect(costLedgerFields).toContain('status,type,claimedAt');
  });
});

describe('creative cost admission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireEntitlement.mockResolvedValue({ tier: 'free' });
    mocks.entitlementTierToBudgetTier.mockReturnValue('free');
    mocks.arcjetPolicyForEntitlement.mockReturnValue('verified-free');
    mocks.arcjetProtect.mockResolvedValue({ allowed: true });
  });

  it('rejects an authenticated but unverified email before reading or reserving budget', async () => {
    await expect(callEnforceOperationCost({
      auth: { uid: 'user-1', token: { email_verified: false } },
      data: { operationType: 'image', estimatedCost: 0.04, forceBypass: true },
    })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Verify your email before using creative generation.',
    });
    expect(mocks.firestore).not.toHaveBeenCalled();
  });

  it('fails closed on an Arcjet denial before any cost ledger read or reservation', async () => {
    mocks.arcjetProtect.mockResolvedValue({
      allowed: false,
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
      retryAfterSeconds: 30,
    });

    await expect(callEnforceOperationCost({
      auth: { uid: 'user-1', token: { email_verified: true } },
      rawRequest: { method: 'POST', headers: {} },
      data: { operationType: 'image', estimatedCost: 0.04 },
    })).rejects.toMatchObject({
      code: 'resource-exhausted',
      details: { code: 'RATE_LIMITED', retryAfterSeconds: 30 },
    });

    expect(mocks.validateAppCheck).toHaveBeenCalledOnce();
    expect(mocks.firestore).not.toHaveBeenCalled();
  });

  it('does not let an admin claim bypass the authenticated tier daily limit', async () => {
    const tx = {
      get: vi.fn(async (reference: { path: string }) => {
        if (reference.path.includes('/daily-')) return { exists: true, data: () => ({ totalCost: 5 }) };
        if (reference.path.includes('/monthly-')) return { exists: true, data: () => ({ totalCost: 5 }) };
        if (reference.path.includes('/hourly-')) return { exists: true, data: () => ({ operationCount: 0 }) };
        return { exists: false, data: () => undefined };
      }),
      set: vi.fn(),
    };
    mocks.firestore.mockReturnValue({
      doc: vi.fn((path: string) => ({ path })),
      runTransaction: vi.fn((fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)),
    });

    await expect(callEnforceOperationCost({
      auth: { uid: 'user-1', token: { email_verified: true, admin: true } },
      rawRequest: { method: 'POST', headers: {} },
      data: { operationType: 'agent_stream', estimatedCost: 0.01 },
    })).resolves.toEqual(expect.objectContaining({
      allowed: false,
      reason: expect.stringContaining('Daily budget exceeded'),
    }));
    expect(tx.set).not.toHaveBeenCalled();
  });
});
