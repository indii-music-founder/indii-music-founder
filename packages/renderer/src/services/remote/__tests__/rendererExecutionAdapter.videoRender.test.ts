import { describe, expect, it, vi } from 'vitest';

import type { CompletedRenderReceipt, IndiiVideoProject } from '@indii/shared';

import { executeVideoRenderDispatch } from '../rendererExecutionAdapter';

const project: IndiiVideoProject = {
    id: 'project-1', name: 'Project', width: 1920, height: 1080, fps: 30,
    durationInFrames: 30,
    tracks: [{ id: 'track-1', name: 'Video', type: 'video' }],
    clips: [{
        id: 'clip-1', name: 'Source', type: 'video', trackId: 'track-1',
        src: 'file:///tmp/source.mp4', startFrame: 0, durationInFrames: 30,
    }],
};

const receipt: CompletedRenderReceipt = {
    status: 'completed', renderId: 'render-1', projectId: 'project-1', progress: 100,
    asset: {
        url: 'file:///managed/final.mp4', expiresAt: Number.MAX_SAFE_INTEGER,
        generation: 'local-1', mimeType: 'video/mp4',
    },
};

describe('executeVideoRenderDispatch', () => {
    it('loads the owned project and completes with the real local render receipt', async () => {
        const loadProject = vi.fn(async () => ({ status: 'found' as const, project, token: {} as never }));
        const renderProject = vi.fn(async () => receipt);
        const complete = vi.fn(async () => undefined);

        await executeVideoRenderDispatch({
            id: 'dispatch-1', type: 'video_render', status: 'processing',
            createdAt: {} as never,
            payload: { projectId: 'project-1', outputName: 'final.mp4' },
        }, {
            hasDesktopVideo: () => true,
            currentUid: () => 'user-1',
            organizationId: () => 'org-1',
            loadProject,
            renderProject,
            complete,
        });

        expect(loadProject).toHaveBeenCalledWith('project-1', 'user-1');
        expect(renderProject).toHaveBeenCalledWith(project, {
            outputName: 'final.mp4', organizationId: 'org-1',
        });
        expect(complete).toHaveBeenCalledWith('dispatch-1', 'completed', undefined, {
            assetUrl: receipt.asset.url, renderId: 'render-1', projectId: 'project-1',
        });
    });

    it('refuses execution without an authenticated desktop', async () => {
        const base = {
            organizationId: () => undefined,
            loadProject: vi.fn(), renderProject: vi.fn(), complete: vi.fn(),
        };
        await expect(executeVideoRenderDispatch({
            type: 'video_render', status: 'pending', createdAt: {} as never, payload: { projectId: 'project-1' },
        }, { ...base, hasDesktopVideo: () => false, currentUid: () => 'user-1' }))
            .rejects.toThrow(/desktop app/i);
        await expect(executeVideoRenderDispatch({
            type: 'video_render', status: 'pending', createdAt: {} as never, payload: { projectId: 'project-1' },
        }, { ...base, hasDesktopVideo: () => true, currentUid: () => undefined }))
            .rejects.toThrow(/authenticated/i);
    });
});
