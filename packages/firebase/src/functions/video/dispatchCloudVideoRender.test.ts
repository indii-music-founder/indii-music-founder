import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    firestore: vi.fn(),
    onDocumentCreated: vi.fn((_options: unknown, handler: unknown) => handler),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    renderWorkerUrl: { value: vi.fn() },
    renderWorkerSecret: { value: vi.fn() },
    fetch: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
    getFirestore: mocks.firestore,
    FieldValue: { serverTimestamp: () => '__ts__' },
}));

vi.mock('firebase-functions/v2/firestore', () => ({
    onDocumentCreated: mocks.onDocumentCreated,
}));

vi.mock('firebase-functions', () => ({
    logger: mocks.logger,
}));

vi.mock('../../config/cloudRender', () => ({
    renderWorkerUrl: mocks.renderWorkerUrl,
    renderWorkerSecret: mocks.renderWorkerSecret,
}));

vi.stubGlobal('fetch', mocks.fetch);

import { dispatchCloudVideoRender } from './dispatchCloudVideoRender';

const handler = dispatchCloudVideoRender as unknown as (event: {
    params: { userId: string; jobId: string };
    data?: { data: () => Record<string, unknown> | undefined };
}) => Promise<void>;

describe('dispatchCloudVideoRender', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.renderWorkerUrl.value.mockReturnValue('https://worker.example');
        mocks.renderWorkerSecret.value.mockReturnValue('secret');
        mocks.fetch.mockResolvedValue({ ok: true, status: 200 });
    });

    it('POSTs a queued job to the worker with the shared secret', async () => {
        await handler({
            params: { userId: 'user-1', jobId: 'job-1' },
            data: { data: () => ({ status: 'queued' }) },
        });

        expect(mocks.fetch).toHaveBeenCalledWith(
            'https://worker.example/v1/render',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ authorization: 'Bearer secret' }),
                body: JSON.stringify({ jobPath: 'users/user-1/videoRenderJobs/job-1' }),
            }),
        );
    });

    it('skips non-queued jobs without calling the worker', async () => {
        await handler({
            params: { userId: 'user-1', jobId: 'job-1' },
            data: { data: () => ({ status: 'running' }) },
        });
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it('leaves the job queued with a dispatchError when the worker URL is not provisioned', async () => {
        mocks.renderWorkerUrl.value.mockReturnValue('');
        await handler({
            params: { userId: 'user-1', jobId: 'job-1' },
            data: { data: () => ({ status: 'queued' }) },
        });
        expect(mocks.fetch).not.toHaveBeenCalled();
        expect(mocks.logger.warn).toHaveBeenCalled();
    });

    it('records a dispatchError but never a fake terminal state when the worker rejects', async () => {
        const update = vi.fn(async () => undefined);
        mocks.firestore.mockReturnValue({ doc: vi.fn(() => ({ update })) });
        mocks.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

        await handler({
            params: { userId: 'user-1', jobId: 'job-1' },
            data: { data: () => ({ status: 'queued' }) },
        });

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({ dispatchError: expect.stringContaining('boom') }),
        );
        expect(mocks.logger.error).toHaveBeenCalled();
    });
});
