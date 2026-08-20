import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  firestore: vi.fn(),
  serverTimestamp: vi.fn(() => '__server_timestamp__'),
  onSchedule: vi.fn((_options, handler) => handler),
  finalizeOperationReservation: vi.fn(),
  https: vi.fn(),
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: mocks.onSchedule,
}));

vi.mock('firebase-admin', () => ({
  firestore: Object.assign(mocks.firestore, {
    Timestamp: { fromMillis: vi.fn((millis: number) => ({ toMillis: () => millis })) },
  }),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: mocks.serverTimestamp },
}));

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string, public details?: unknown) {
      super(message);
    }
  },
}));

vi.mock('../billing/enforceOperationCost', () => ({
  finalizeOperationReservation: mocks.finalizeOperationReservation,
}));

import { reclaimStuckGatewayVideoJobs } from './reclaimStuckVideoJobs';
import { GATEWAY_VIDEO_WORKER_VERSION } from '../creative/videoJobAuthority';

interface MockJob {
  id: string;
  data: () => Record<string, unknown>;
  ref: { update: ReturnType<typeof vi.fn> };
}

function makeQuery(docs: MockJob[]) {
  const query = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: vi.fn(async () => ({ docs })),
  };
  return query;
}

const job = (id: string, overrides: Record<string, unknown>): MockJob => ({
  id,
  data: () => overrides,
  ref: { update: vi.fn().mockResolvedValue(undefined) },
});

describe('reclaimStuckGatewayVideoJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.finalizeOperationReservation.mockResolvedValue(undefined);
  });

  const wire = (processing: MockJob[], queued: MockJob[]) => {
    const processingQuery = makeQuery(processing);
    const queuedQuery = makeQuery(queued);
    mocks.firestore.mockReturnValue({
      collection: vi.fn(() => processingQuery),
    });
    // The reaper issues two queries on the same collection; route by the
    // first where() value.
    const collection = vi.fn(() => ({
      where: vi.fn((field: string, _op: string, value: unknown) => {
        if (field === 'status' && value === 'queued') return queuedQuery;
        return processingQuery;
      }),
    }));
    mocks.firestore.mockReturnValue({ collection });
  };

  it('re-queues a stuck processing job that never reached the provider', async () => {
    const stuck = job('j1', {
      type: 'video',
      workerVersion: GATEWAY_VIDEO_WORKER_VERSION,
      status: 'processing',
      providerSubmissionState: 'not_submitted',
      userId: 'u1',
      costReservationId: 'op-1',
    });
    wire([stuck], []);

    const result = await reclaimStuckGatewayVideoJobs(new Date('2026-08-20T12:00:00Z'));

    expect(result.requeued).toBe(1);
    expect(stuck.ref.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued', requeueCount: 1 }));
    expect(mocks.finalizeOperationReservation).not.toHaveBeenCalled();
  });

  it('fails a job that exhausted its re-queue budget and voids the un-submitted hold', async () => {
    const stuck = job('j1', {
      type: 'video',
      workerVersion: GATEWAY_VIDEO_WORKER_VERSION,
      status: 'processing',
      providerSubmissionState: 'not_submitted',
      requeueCount: 2,
      userId: 'u1',
      costReservationId: 'op-1',
    });
    wire([stuck], []);

    const result = await reclaimStuckGatewayVideoJobs(new Date('2026-08-20T12:00:00Z'));

    expect(result.failed).toBe(1);
    expect(stuck.ref.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(mocks.finalizeOperationReservation).toHaveBeenCalledWith({
      userId: 'u1',
      operationId: 'op-1',
      outcome: 'VOIDED',
      jobId: 'j1',
    });
  });

  it('never re-runs a job with an ambiguous provider outcome — it settles the hold instead', async () => {
    const stuck = job('j1', {
      type: 'video',
      workerVersion: GATEWAY_VIDEO_WORKER_VERSION,
      status: 'processing',
      providerSubmissionState: 'ambiguous_or_failed',
      userId: 'u1',
      costReservationId: 'op-1',
    });
    wire([stuck], []);

    const result = await reclaimStuckGatewayVideoJobs(new Date('2026-08-20T12:00:00Z'));

    expect(result.failed).toBe(1);
    expect(stuck.ref.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(mocks.finalizeOperationReservation).toHaveBeenCalledWith({
      userId: 'u1',
      operationId: 'op-1',
      outcome: 'SETTLED',
      jobId: 'j1',
    });
  });

  it('nudges never-claimed queued jobs so the orchestrator re-claims them', async () => {
    const stuck = job('j1', {
      type: 'video',
      workerVersion: GATEWAY_VIDEO_WORKER_VERSION,
      status: 'queued',
      userId: 'u1',
      costReservationId: 'op-1',
    });
    wire([], [stuck]);

    const result = await reclaimStuckGatewayVideoJobs(new Date('2026-08-20T12:00:00Z'));

    expect(result.queuedTouched).toBe(1);
    expect(stuck.ref.update).toHaveBeenCalledWith(expect.objectContaining({ requeueCount: 1 }));
  });

  it('ignores jobs that do not belong to the gateway worker', async () => {
    const foreign = job('j1', {
      type: 'video',
      workerVersion: 'some-other-worker',
      status: 'processing',
      providerSubmissionState: 'not_submitted',
    });
    wire([foreign], []);

    const result = await reclaimStuckGatewayVideoJobs(new Date('2026-08-20T12:00:00Z'));

    expect(result.requeued).toBe(0);
    expect(result.failed).toBe(0);
    expect(foreign.ref.update).not.toHaveBeenCalled();
  });
});
