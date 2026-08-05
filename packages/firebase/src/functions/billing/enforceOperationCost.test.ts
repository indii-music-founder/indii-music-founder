import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  claimOperationReservation,
  checkOperationBudget,
  enforceOperationCost,
  expireStaleOperationReservations,
  finalizeOperationReservation,
  getOperationCostHistoryPage,
  reconcileStaleClaimedVideoReservations,
  reconcileStaleClaimedAgentStreamReservations,
  serializeCostOperationHistoryItem,
  voidAgentStreamCostReservation,
  voidVideoCostReservation,
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
const callVoidVideoCostReservation = voidVideoCostReservation as unknown as (request: {
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
    expect(state).toMatchObject({ status: 'CLAIMED', claimedJobId: 'claim-1' });
    state.status = 'APPROVED';
    await expect(claimOperationReservation({ userId: 'user-2', operationId: 'op-1', operationType: 'agent_stream', claimId: 'claim-2' })).rejects.toThrow('owner mismatch');
    await expect(claimOperationReservation({ userId: 'user-1', operationId: 'op-1', operationType: 'video', claimId: 'claim-2' })).rejects.toThrow('type mismatch');
    state.status = 'VOIDED';
    await expect(claimOperationReservation({ userId: 'user-1', operationId: 'op-1', operationType: 'agent_stream', claimId: 'claim-2' })).rejects.toThrow('already VOIDED');
  });

  it('voids an owner-scoped unclaimed agent stream and reconciles stale claimed streams with their server claim', async () => {
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

    const query = createQuery([{ id: 'op-claimed', data: () => ({ userId: 'user-1', type: 'agent_stream', claimedJobId: 'claim-1' }) }]);
    mocks.firestore.mockReturnValue({ collection: vi.fn(() => query) });
    const finalize = vi.fn().mockResolvedValue(undefined);
    await expect(reconcileStaleClaimedAgentStreamReservations(new Date(), finalize)).resolves.toBe(1);
    expect(query.where).toHaveBeenCalledWith('type', '==', 'agent_stream');
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'op-claimed', outcome: 'VOIDED', jobId: 'claim-1', expectedType: 'agent_stream' }));
  });

  it('voids only the authenticated owner\'s unclaimed video reservation', async () => {
    mocks.validateAppCheck.mockReturnValue(undefined);
    mocks.requireEntitlement.mockResolvedValue({ tier: 'free' });
    mocks.entitlementTierToBudgetTier.mockReturnValue('free');
    mocks.arcjetPolicyForEntitlement.mockReturnValue('verified-free');
    mocks.arcjetProtect.mockResolvedValue({ allowed: true });
    const state: Record<string, unknown> = {
      userId: 'user-1', type: 'video', status: 'APPROVED', estimatedCost: 0.6,
      ledgerDocumentPaths: { daily: 'users/user-1/costLedger/daily-1' },
    };
    const transaction = {
      get: vi.fn(async () => ({ exists: true, data: () => ({ ...state }) })),
      update: vi.fn((_ref, value) => Object.assign(state, value)), set: vi.fn(),
    };
    mocks.firestore.mockReturnValue({ doc: vi.fn((path: string) => ({ path })), runTransaction: vi.fn((fn) => fn(transaction)) });
    await expect(callVoidVideoCostReservation({ auth: { uid: 'user-2', token: { email_verified: true } }, data: { operationId: 'op-video-1' }, rawRequest: {} })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(state.status).toBe('APPROVED');
    await expect(callVoidVideoCostReservation({ auth: { uid: 'user-1', token: { email_verified: true } }, data: { operationId: 'op-video-1' }, rawRequest: {} })).resolves.toEqual({ voided: true });
    expect(state.status).toBe('VOIDED');
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
});
