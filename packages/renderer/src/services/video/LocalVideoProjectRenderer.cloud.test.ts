import { describe, expect, it, vi } from 'vitest';
import type { IndiiVideoProject } from '@indii/shared';

import { renderVideoProjectLocally } from './LocalVideoProjectRenderer';
import { queueCloudRender, waitForCloudRender } from './CloudVideoRenderService';

const project = (): IndiiVideoProject => ({
    id: 'project-1',
    name: 'My Project',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 90,
    tracks: [{ id: 'track-1', type: 'video', name: 'Video' }],
    clips: [{
        id: 'clip-1',
        name: 'Source',
        type: 'video',
        trackId: 'track-1',
        src: 'https://cdn.example/source.mp4',
        startFrame: 0,
        durationInFrames: 90,
    }],
});

describe('renderVideoProjectLocally — web/cloud path', () => {
    it('queues through the cloud protocol and records the completed receipt', async () => {
        const queue = vi.fn(async () => ({ renderId: 'job-1' }));
        const readJob = vi.fn(async () => ({
            status: 'completed' as const,
            artifactUrl: 'https://storage.example/out.mp4?sig=x',
            artifactGeneration: '42',
            error: null,
        }));
        const uid = vi.fn(() => 'user-1');
        const sleep = vi.fn(async () => undefined);
        const recordArtifact = vi.fn(async () => undefined);

        const receipt = await renderVideoProjectLocally(
            project(),
            { outputName: 'final.mp4', organizationId: 'org-1' },
            {
                now: () => 1234,
                createRenderId: () => 'render-1',
                recordArtifact,
                cloud: { queue, readJob, uid, sleep, now: () => 1234 },
            },
        );

        expect(queue).toHaveBeenCalledWith('project-1', 'final.mp4');
        expect(receipt).toEqual({
            status: 'completed',
            renderId: 'job-1',
            projectId: 'project-1',
            progress: 100,
            asset: {
                url: 'https://storage.example/out.mp4?sig=x',
                expiresAt: 1234 + 24 * 60 * 60 * 1000,
                generation: '42',
                mimeType: 'video/mp4',
            },
        });
        expect(recordArtifact).toHaveBeenCalledWith(receipt, project(), 'org-1');
    });

    it('surfaces a failed cloud job as an error and records nothing', async () => {
        const queue = vi.fn(async () => ({ renderId: 'job-2' }));
        const readJob = vi.fn(async () => ({
            status: 'failed' as const,
            artifactUrl: null,
            artifactGeneration: null,
            error: 'chrome died',
        }));
        const recordArtifact = vi.fn(async () => undefined);

        await expect(renderVideoProjectLocally(
            project(),
            {},
            {
                now: () => 1234,
                createRenderId: () => 'render-1',
                recordArtifact,
                cloud: { queue, readJob, uid: () => 'user-1', sleep: vi.fn(), now: () => 1234 },
            },
        )).rejects.toThrow('chrome died');
        expect(recordArtifact).not.toHaveBeenCalled();
    });
});

describe('waitForCloudRender', () => {
    it('polls until the artifact lands, reporting each status change', async () => {
        const readJob = vi.fn()
            .mockResolvedValueOnce({ status: 'queued', artifactUrl: null, artifactGeneration: null, error: null })
            .mockResolvedValueOnce({ status: 'running', artifactUrl: null, artifactGeneration: null, error: null })
            .mockResolvedValueOnce({ status: 'completed', artifactUrl: 'https://x/y.mp4', artifactGeneration: '9', error: null });
        const statuses: string[] = [];

        const result = await waitForCloudRender('job-1', { onStatus: s => statuses.push(s) }, {
            uid: () => 'user-1',
            readJob,
            sleep: vi.fn(async () => undefined),
            now: () => 1000,
        });

        expect(result).toEqual({ url: 'https://x/y.mp4', generation: '9' });
        expect(statuses).toEqual(['queued', 'running', 'completed']);
        expect(readJob).toHaveBeenCalledWith('users/user-1/videoRenderJobs/job-1');
    });

    it('times out with a recoverable message that names the render id', async () => {
        const readJob = vi.fn(async () => ({
            status: 'running' as const, artifactUrl: null, artifactGeneration: null, error: null,
        }));
        const now = vi.fn()
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0)
            .mockReturnValue(21 * 60 * 1000);

        await expect(waitForCloudRender('job-9', { pollMs: 1 }, {
            uid: () => 'user-1',
            readJob,
            sleep: vi.fn(async () => undefined),
            now,
        })).rejects.toThrow(/Render id: job-9/);
    });

    it('requires a signed-in user before touching the queue', async () => {
        await expect(queueCloudRender('proj-1', undefined, {
            uid: () => null,
            queue: vi.fn(),
        })).rejects.toThrow(/Sign in/);
    });
});
