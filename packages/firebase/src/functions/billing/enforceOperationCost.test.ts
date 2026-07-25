import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  firestore: vi.fn(),
  fromMillis: vi.fn((millis: number) => ({ toMillis: () => millis })),
  onCall: vi.fn((_options, handler) => handler),
  onSchedule: vi.fn((_options, handler) => handler),
}));

vi.mock('firebase-functions/v2', () => ({
  https: {
    onCall: mocks.onCall,
    HttpsError: class HttpsError extends Error {
      constructor(public code: string, message: string) {
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

import {
  checkOperationBudget,
  expireStaleOperationReservations,
  finalizeOperationReservation,
  getOperationCostHistoryPage,
  serializeCostOperationHistoryItem,
} from './enforceOperationCost';

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
});
