import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executeVideoJob: vi.fn(),
  claimQueuedGatewayVideoJob: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: vi.fn((_options, handler) => handler),
}));

vi.mock('firebase-functions/logger', () => ({
  info: mocks.loggerInfo,
  error: mocks.loggerError,
}));

vi.mock('./gateway', () => ({
  executeVideoJob: mocks.executeVideoJob,
}));

vi.mock('./videoJobAuthority', () => ({
  claimQueuedGatewayVideoJob: mocks.claimQueuedGatewayVideoJob,
}));

import { videoJobFirestoreOrchestrator } from './videoJobOrchestrator';

type OrchestratorEvent = {
  params: { jobId: string };
  data: {
    after: {
      data: () => Record<string, unknown>;
      ref: { firestore: Record<string, never> };
    };
  };
};

const runOrchestrator = videoJobFirestoreOrchestrator as unknown as (
  event: OrchestratorEvent,
) => Promise<void>;

describe('videoJobFirestoreOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeVideoJob.mockResolvedValue({
      jobId: 'video-job-1',
      resultUri: 'gs://test-bucket/generated/owner-1/video.mp4',
    });
  });

  it('submits to the provider once when duplicate Firestore deliveries race', async () => {
    const claimedJob = {
      id: 'video-job-1',
      type: 'video',
      workerVersion: 'gateway-video-v3',
      status: 'processing',
      userId: 'owner-1',
      prompt: 'A stage performance',
      payload: { prompt: 'A stage performance' },
    };
    mocks.claimQueuedGatewayVideoJob
      .mockResolvedValueOnce(claimedJob)
      .mockResolvedValueOnce(null);
    const event: OrchestratorEvent = {
      params: { jobId: 'video-job-1' },
      data: {
        after: {
          data: () => ({
            id: 'video-job-1',
            type: 'video',
            workerVersion: 'gateway-video-v3',
            status: 'queued',
          }),
          ref: { firestore: {} },
        },
      },
    };

    await Promise.all([runOrchestrator(event), runOrchestrator(event)]);

    expect(mocks.claimQueuedGatewayVideoJob).toHaveBeenCalledTimes(2);
    expect(mocks.executeVideoJob).toHaveBeenCalledTimes(1);
    expect(mocks.executeVideoJob).toHaveBeenCalledWith('video-job-1', claimedJob);
  });

  it('ignores non-queued and non-video writes before attempting a claim', async () => {
    const baseEvent: OrchestratorEvent = {
      params: { jobId: 'video-job-1' },
      data: {
        after: {
          data: () => ({ type: 'video', status: 'completed' }),
          ref: { firestore: {} },
        },
      },
    };

    await runOrchestrator(baseEvent);
    await runOrchestrator({
      ...baseEvent,
      data: {
        after: {
          ...baseEvent.data.after,
          data: () => ({ type: 'image', status: 'queued' }),
        },
      },
    });

    expect(mocks.claimQueuedGatewayVideoJob).not.toHaveBeenCalled();
    expect(mocks.executeVideoJob).not.toHaveBeenCalled();
  });
});
