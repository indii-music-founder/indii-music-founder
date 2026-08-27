import { describe, expect, it, vi } from 'vitest';

import type { IndiiVideoProject } from '@indii/shared';

import { processNextRelayJob } from './DesktopRenderRelayService';

const project: IndiiVideoProject = {
    id: 'proj-1', name: 'Relay', fps: 30, width: 1920, height: 1080, durationInFrames: 60,
    tracks: [{ id: 't1', name: 'V1', type: 'video' }],
    clips: [{ id: 'c1', type: 'video', src: 'a.mp4', name: 'one', startFrame: 0, durationInFrames: 60, trackId: 't1' }],
};

describe('DesktopRenderRelayService.processNextRelayJob', () => {
    it('claims, renders, uploads, and completes a queued job', async () => {
        const listQueuedJobs = vi.fn(async () => [
            { jobId: 'job-1', projectId: 'proj-1', outputName: 'final.mp4', status: 'queued' as const },
        ]);
        const claim = vi.fn(async () => undefined);
        const loadProject = vi.fn(async () => project);
        const render = vi.fn(async () => '/managed/final.mp4');
        const readArtifact = vi.fn(async () => 'data:video/mp4;base64,AAAA');
        const upload = vi.fn(async () => 'https://storage.example/job-1.mp4?sig=x');
        const complete = vi.fn(async () => undefined);
        const fail = vi.fn(async () => undefined);

        const url = await processNextRelayJob({
            listQueuedJobs, claim, loadProject, render, readArtifact, upload, complete, fail,
            hasDesktopApi: () => true,
        });

        expect(url).toBe('https://storage.example/job-1.mp4?sig=x');
        expect(claim).toHaveBeenCalledWith('job-1');
        expect(render).toHaveBeenCalledWith(project, 'final.mp4');
        expect(upload).toHaveBeenCalledWith('data:video/mp4;base64,AAAA', 'job-1', 'job-1.mp4');
        expect(complete).toHaveBeenCalledWith('job-1', 'https://storage.example/job-1.mp4?sig=x');
        expect(fail).not.toHaveBeenCalled();
    });

    it('fails the job when the render throws and never claims completion', async () => {
        const fail = vi.fn(async () => undefined);
        const complete = vi.fn(async () => undefined);

        const url = await processNextRelayJob({
            listQueuedJobs: vi.fn(async () => [
                { jobId: 'job-2', projectId: 'proj-1', status: 'queued' as const },
            ]),
            claim: vi.fn(async () => undefined),
            loadProject: vi.fn(async () => project),
            render: vi.fn(async () => { throw new Error('chrome died'); }),
            readArtifact: vi.fn(),
            upload: vi.fn(),
            complete,
            fail,
            hasDesktopApi: () => true,
        });

        expect(url).toBeNull();
        expect(fail).toHaveBeenCalledWith('job-2', 'chrome died');
        expect(complete).not.toHaveBeenCalled();
    });

    it('does nothing when the desktop API is absent or the queue is empty', async () => {
        const claim = vi.fn();
        const url = await processNextRelayJob({
            listQueuedJobs: vi.fn(async () => [
                { jobId: 'job-3', projectId: 'proj-1', status: 'queued' as const },
            ]),
            claim,
            hasDesktopApi: () => false,
        });
        expect(url).toBeNull();
        expect(claim).not.toHaveBeenCalled();

        const empty = await processNextRelayJob({
            listQueuedJobs: vi.fn(async () => []),
            claim,
            hasDesktopApi: () => true,
        });
        expect(empty).toBeNull();
        expect(claim).not.toHaveBeenCalled();
    });
});
