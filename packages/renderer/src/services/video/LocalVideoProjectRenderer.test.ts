import { describe, expect, it, vi } from 'vitest';
import type { CompletedRenderReceipt, IndiiVideoProject } from '@indii/shared';

import { renderVideoProjectLocally } from './LocalVideoProjectRenderer';

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
        src: 'file:///tmp/source.mp4',
        startFrame: 0,
        durationInFrames: 90,
    }],
});

describe('renderVideoProjectLocally', () => {
    it('renders through Electron and records a contract receipt', async () => {
        const getDefaultPath = vi.fn(async () => '/managed/My_Project.mp4');
        const render = vi.fn(async () => '/managed/My_Project.mp4');
        const recordArtifact = vi.fn(async () => undefined);

        const receipt = await renderVideoProjectLocally(
            project(),
            { outputName: 'My Project.mp4', organizationId: 'org-1' },
            {
                videoApi: { getDefaultPath, render },
                now: () => 1234,
                createRenderId: () => 'render-1',
                recordArtifact,
            },
        );

        expect(getDefaultPath).toHaveBeenCalledWith('My_Project.mp4');
        expect(render).toHaveBeenCalledWith({
            compositionId: 'project-1',
            outputLocation: '/managed/My_Project.mp4',
            inputProps: { project: project() },
        });
        expect(receipt).toEqual({
            status: 'completed',
            renderId: 'render-1',
            projectId: 'project-1',
            progress: 100,
            asset: {
                url: 'file:///managed/My_Project.mp4',
                expiresAt: Number.MAX_SAFE_INTEGER,
                generation: 'local-1234',
                mimeType: 'video/mp4',
            },
        });
        expect(recordArtifact).toHaveBeenCalledWith(receipt, project(), 'org-1');
    });

    it('honors an editor-selected output path without asking for a default', async () => {
        const getDefaultPath = vi.fn(async () => '/unused');
        const render = vi.fn(async () => '/chosen/final.mp4');
        const recorded: CompletedRenderReceipt[] = [];

        await renderVideoProjectLocally(project(), { outputLocation: '/chosen/final.mp4' }, {
            videoApi: { getDefaultPath, render },
            now: () => 1,
            createRenderId: () => 'render-2',
            recordArtifact: async receipt => { recorded.push(receipt); },
        });

        expect(getDefaultPath).not.toHaveBeenCalled();
        expect(render).toHaveBeenCalledWith(expect.objectContaining({ outputLocation: '/chosen/final.mp4' }));
        expect(recorded[0]?.asset.url).toBe('file:///chosen/final.mp4');
    });

    it('fails before touching an executor when the project is empty', async () => {
        const empty = { ...project(), clips: [] };
        const render = vi.fn(async () => '/never.mp4');

        await expect(renderVideoProjectLocally(empty, {}, {
            videoApi: { getDefaultPath: vi.fn(async () => '/never.mp4'), render },
            now: () => 1,
            createRenderId: () => 'never',
            recordArtifact: vi.fn(async () => undefined),
        })).rejects.toThrow(/no clips/i);
        expect(render).not.toHaveBeenCalled();
    });
});
