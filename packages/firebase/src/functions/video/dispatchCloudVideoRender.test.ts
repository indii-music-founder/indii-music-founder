import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    firestore: vi.fn(),
    onDocumentCreated: vi.fn((_options: unknown, handler: unknown) => handler),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    renderWorkerUrl: { value: vi.fn() },
    renderWorkerSecret: { value: vi.fn() },
    queuePath: vi.fn((project: string, region: string, queue: string) => `projects/${project}/locations/${region}/queues/${queue}`),
    createTask: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({ getFirestore: mocks.firestore, FieldValue: { serverTimestamp: () => '__ts__', delete: () => '__delete__' } }));
vi.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: mocks.onDocumentCreated }));
vi.mock('firebase-functions', () => ({ logger: mocks.logger }));
vi.mock('@google-cloud/tasks', () => ({ CloudTasksClient: class { queuePath = mocks.queuePath; createTask = mocks.createTask; } }));
vi.mock('../../config/cloudRender', () => ({ renderWorkerUrl: mocks.renderWorkerUrl, renderWorkerSecret: mocks.renderWorkerSecret }));

import { dispatchCloudVideoRender, enqueueCloudRenderTask } from './dispatchCloudVideoRender';
const handlerOptions = mocks.onDocumentCreated.mock.calls[0]?.[0];

const handler = dispatchCloudVideoRender as unknown as (event: {
    params: { userId: string; jobId: string };
    data?: { data: () => Record<string, unknown> | undefined };
}) => Promise<void>;
const event = (status = 'queued', userId = 'user-1') => ({
    params: { userId: 'user-1', jobId: 'job-1' },
    data: { data: () => ({ status, userId, jobId: 'job-1' }) },
});

describe('durable cloud render dispatch', () => {
    const update = vi.fn(async () => undefined);
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.GCLOUD_PROJECT = 'project-1';
        mocks.renderWorkerUrl.value.mockReturnValue('https://worker.example');
        mocks.renderWorkerSecret.value.mockReturnValue('secret');
        mocks.createTask.mockResolvedValue([{}]);
        mocks.firestore.mockReturnValue({ doc: vi.fn(() => ({ update })) });
    });

    it('creates one named task before recording dispatch success', async () => {
        await handler(event());
        const request = mocks.createTask.mock.calls[0]![0];
        expect(request.task.name).toMatch(/^projects\/project-1\/locations\/us-central1\/queues\/video-render-jobs\/tasks\/render-[a-f0-9]{64}$/);
        expect(request.task.dispatchDeadline.seconds).toBe(1800);
        expect(request.task.httpRequest.url).toBe('https://worker.example/v1/render');
        expect(JSON.parse(Buffer.from(request.task.httpRequest.body, 'base64').toString())).toEqual({ jobPath: 'users/user-1/videoRenderJobs/job-1' });
        expect(request.task.httpRequest.headers.Authorization).toBe('Bearer secret');
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ dispatchTaskName: request.task.name }));
        expect(handlerOptions).toMatchObject({ retry: true });
    });

    it('treats a duplicate named task as already durably queued', async () => {
        mocks.createTask.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 6 }));
        await handler(event());
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ dispatchTaskName: expect.stringContaining('/tasks/render-') }));
    });

    it('rejects cross-owner jobs and unsafe worker targets', async () => {
        await handler(event('queued', 'other-user'));
        expect(mocks.createTask).not.toHaveBeenCalled();
        await expect(enqueueCloudRenderTask('users/user-1/videoRenderJobs/job-1', { project: 'project-1', workerUrl: 'http://127.0.0.1', workerSecret: 'secret' }, { queuePath: mocks.queuePath, createTask: mocks.createTask })).rejects.toThrow(/configuration/);
    });

    it('propagates enqueue failure so the trigger retries and the job stays queued', async () => {
        mocks.createTask.mockRejectedValueOnce(new Error('queue unavailable'));
        await expect(handler(event())).rejects.toThrow('queue unavailable');
        expect(update).toHaveBeenCalledWith(expect.objectContaining({ dispatchError: 'queue unavailable' }));
    });
});
