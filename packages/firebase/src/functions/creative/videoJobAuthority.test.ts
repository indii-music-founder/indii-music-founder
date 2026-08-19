import { describe, expect, it, vi } from 'vitest';

import {
  authorizeAndStageVideoInputs,
  claimQueuedGatewayVideoJob,
  createClaimedVideoJob,
  GATEWAY_VIDEO_WORKER_VERSION,
  type VideoInputStorage,
} from './videoJobAuthority';

const pngPrefix = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]);

function fakeStorage(): VideoInputStorage {
  return {
    bucketName: 'project-bucket',
    inspectExact: vi.fn().mockResolvedValue({
      generation: '42',
      sizeBytes: 1024,
      mimeType: 'image/png',
      prefix: pngPrefix,
      contentHash: 'a'.repeat(64),
    }),
    copyExact: vi.fn().mockResolvedValue({ generation: '84' }),
    deleteExact: vi.fn().mockResolvedValue(undefined),
  };
}

describe('video input authority', () => {
  it('generation-pins and stages an authenticated owner input', async () => {
    const storage = fakeStorage();
    const [result] = await authorizeAndStageVideoInputs('owner-1', 'job-1', [{
      role: 'first_frame',
      uri: 'gs://project-bucket/creative/owner-1/frames/start.png',
      kind: 'image',
    }], storage);
    expect(storage.copyExact).toHaveBeenCalledWith(
      'creative/owner-1/frames/start.png',
      '42',
      expect.stringMatching(/^generated\/owner-1\/video-inputs\/job-1\//),
    );
    expect(result).toMatchObject({
      sourceGeneration: '42',
      stagedGeneration: '84',
      sourceHash: 'a'.repeat(64),
      stagedUri: expect.stringMatching(/^gs:\/\/project-bucket\/generated\/owner-1\/video-inputs\/job-1\//),
    });
  });

  it.each([
    'gs://other-bucket/creative/owner-1/frames/start.png',
    'gs://project-bucket/creative/owner-2/frames/start.png',
  ])('rejects cross-authority input %s', async uri => {
    await expect(authorizeAndStageVideoInputs('owner-1', 'job-1', [{
      role: 'first_frame',
      uri,
      kind: 'image',
    }], fakeStorage())).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects MIME labels whose bytes do not match', async () => {
    const storage = fakeStorage();
    vi.mocked(storage.inspectExact).mockResolvedValue({
      generation: '42',
      sizeBytes: 1024,
      mimeType: 'image/png',
      prefix: Buffer.from('not-a-png-header'),
    });
    await expect(authorizeAndStageVideoInputs('owner-1', 'job-1', [{
      role: 'reference',
      uri: 'gs://project-bucket/creative/owner-1/reference.png',
      kind: 'image',
    }], storage)).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(storage.copyExact).not.toHaveBeenCalled();
  });

  it('removes earlier staged inputs when a later input cannot be verified', async () => {
    const storage = fakeStorage();
    vi.mocked(storage.inspectExact)
      .mockResolvedValueOnce({
        generation: '42',
        sizeBytes: 1024,
        mimeType: 'image/png',
        prefix: pngPrefix,
      })
      .mockResolvedValueOnce({
        generation: '43',
        sizeBytes: 1024,
        mimeType: 'image/png',
        prefix: Buffer.from('not-a-png-header'),
      });

    await expect(authorizeAndStageVideoInputs('owner-1', 'job-1', [
      {
        role: 'first_frame',
        uri: 'gs://project-bucket/creative/owner-1/frames/start.png',
        kind: 'image',
      },
      {
        role: 'last_frame',
        uri: 'gs://project-bucket/creative/owner-1/frames/end.png',
        kind: 'image',
      },
    ], storage)).rejects.toMatchObject({ code: 'invalid-argument' });

    expect(storage.deleteExact).toHaveBeenCalledWith(
      expect.stringMatching(/^generated\/owner-1\/video-inputs\/job-1\//),
      '84',
    );
  });
});

function firestoreHarness(input: { reservation?: Record<string, unknown>; job?: Record<string, unknown> }) {
  const reservationRef = { kind: 'reservation' };
  const jobRef = { kind: 'job' };
  const update = vi.fn();
  const create = vi.fn();
  const transaction = {
    get: vi.fn(async (reference: { kind: string }) => reference.kind === 'reservation'
      ? { exists: !!input.reservation, data: () => input.reservation }
      : { exists: !!input.job, data: () => input.job }),
    update,
    create,
  };
  const db = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn(() => name === 'costLedger' ? reservationRef : jobRef),
    })),
    runTransaction: vi.fn(async (handler: (value: typeof transaction) => Promise<unknown>) => handler(transaction)),
  };
  return { db, transaction, update, create };
}

describe('video job authority', () => {
  it('atomically claims one approved reservation and creates one authoritative job', async () => {
    const harness = firestoreHarness({
      reservation: { userId: 'owner-1', type: 'video', status: 'APPROVED', estimatedCost: 0.8 },
    });
    await createClaimedVideoJob(harness.db as never, {
      ownerUid: 'owner-1',
      reservationId: 'reservation-1',
      jobId: 'job-1',
      expectedCost: 0.8,
      jobRecord: { id: 'job-1' },
    });
    expect(harness.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: 'CLAIMED',
      claimedJobId: 'job-1',
    }));
    expect(harness.create).toHaveBeenCalledWith(expect.anything(), { id: 'job-1' });
  });

  it('strips undefined fields from the job record before the authoritative write (ISSUE-1380)', async () => {
    const harness = firestoreHarness({
      reservation: { userId: 'owner-1', type: 'video', status: 'APPROVED', estimatedCost: 0.8 },
    });
    await createClaimedVideoJob(harness.db as never, {
      ownerUid: 'owner-1',
      reservationId: 'reservation-1',
      jobId: 'job-1',
      expectedCost: 0.8,
      jobRecord: {
        id: 'job-1',
        negativePrompt: undefined,
        seed: undefined,
        payload: { cameraPhysics: undefined, prompt: 'x' },
      },
    });
    expect(harness.create).toHaveBeenCalledWith(expect.anything(), {
      id: 'job-1',
      payload: { prompt: 'x' },
    });
  });

  it('rejects reservation replay before creating another paid job', async () => {
    const harness = firestoreHarness({
      reservation: { userId: 'owner-1', type: 'video', status: 'CLAIMED', estimatedCost: 0.8, claimedJobId: 'job-0' },
    });
    await expect(createClaimedVideoJob(harness.db as never, {
      ownerUid: 'owner-1',
      reservationId: 'reservation-1',
      jobId: 'job-1',
      expectedCost: 0.8,
      jobRecord: { id: 'job-1' },
    })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(harness.create).not.toHaveBeenCalled();
  });

  it('claims a queued V3 job exactly once at the authoritative document', async () => {
    const first = firestoreHarness({
      job: { id: 'job-1', type: 'video', status: 'queued', workerVersion: GATEWAY_VIDEO_WORKER_VERSION },
    });
    await expect(claimQueuedGatewayVideoJob(first.db as never, 'job-1')).resolves.toMatchObject({ status: 'processing' });
    expect(first.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'processing' }));

    const replay = firestoreHarness({
      job: { id: 'job-1', type: 'video', status: 'processing', workerVersion: GATEWAY_VIDEO_WORKER_VERSION },
    });
    await expect(claimQueuedGatewayVideoJob(replay.db as never, 'job-1')).resolves.toBeNull();
    expect(replay.update).not.toHaveBeenCalled();
  });
});
