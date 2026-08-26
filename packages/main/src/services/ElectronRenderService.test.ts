import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndiiVideoProject } from '@indii/shared';

const mocks = vi.hoisted(() => ({
    direct: vi.fn(async () => ({ hasVideo: true, hasAudio: true, durationUs: 1_000_000 })),
    compile: vi.fn(() => ({ html: '<html><script src="./gsap.min.js"></script></html>', compositionId: 'compiled', durationSeconds: 1 })),
    probe: vi.fn(async () => ({ hasVideo: true, hasAudio: true, durationUs: 1_000_000 })),
    adapterConstructed: vi.fn(),
    adapterRender: vi.fn(async (config: { outputLocation: string }) => ({
        status: 'completed',
        renderId: 'render-1',
        projectId: 'local',
        progress: 100,
        asset: {
            url: `file://${config.outputLocation}`,
            expiresAt: Date.now() + 60_000,
            generation: '1',
            mimeType: 'video/mp4',
        },
    })),
}));

vi.mock('electron-log', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
vi.mock('./media/MediaJobExecutor', () => ({ executeDirectMediaJob: mocks.direct }));
vi.mock('./media/MediaOps', () => ({ probeMedia: mocks.probe }));
vi.mock('@indii/video-compiler', () => ({ compileProjectToHyperFrames: mocks.compile }));
vi.mock('./video/HyperFramesAdapter', () => ({
    HyperFramesAdapter: class {
        constructor() { mocks.adapterConstructed(); }
        renderCompositionCloud = mocks.adapterRender;
    },
}));

import { electronRenderService } from './ElectronRenderService';

const project = (clips: IndiiVideoProject['clips']): IndiiVideoProject => ({
    id: 'project-1',
    name: 'Project',
    fps: 30,
    durationInFrames: 30,
    width: 640,
    height: 360,
    tracks: [{ id: 't1', name: 'V1', type: 'video' }],
    clips,
});

describe('ElectronRenderService routing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.INDII_GSAP_PATH = `${process.cwd()}/src/services/video/hyperframes/__fixtures__/gsap.min.js`;
    });

    it('executes a direct video with FFmpeg without loading a composition adapter', async () => {
        const outputLocation = '/tmp/indii-direct-test.mp4';
        const result = await electronRenderService.render({
            outputLocation,
            inputProps: {
                project: project([{
                    id: 'v1', type: 'video', src: 'file:///tmp/source.mp4', name: 'Source',
                    startFrame: 0, durationInFrames: 30, trackId: 't1',
                }]),
            },
        });

        expect(result).toBe(outputLocation);
        expect(mocks.direct).toHaveBeenCalledWith(
            expect.objectContaining({ route: 'direct_media', op: 'transcode' }),
            expect.objectContaining({ input: '/tmp/source.mp4', output: outputLocation }),
        );
        expect(mocks.adapterConstructed).not.toHaveBeenCalled();
        expect(mocks.compile).not.toHaveBeenCalled();
    });

    it('reads inputProps.project and uses compiler plus adapter for composed work', async () => {
        const outputLocation = '/tmp/indii-composed-test.mp4';
        const result = await electronRenderService.render({
            outputLocation,
            inputProps: {
                project: project([{
                    id: 'title', type: 'text', text: 'indii', name: 'Title',
                    startFrame: 0, durationInFrames: 30, trackId: 't1',
                }]),
            },
        });

        expect(result).toBe(outputLocation);
        expect(mocks.direct).not.toHaveBeenCalled();
        expect(mocks.compile).toHaveBeenCalledOnce();
        expect(mocks.adapterConstructed).toHaveBeenCalledOnce();
        expect(mocks.adapterRender).toHaveBeenCalledWith(expect.objectContaining({
            outputLocation,
            projectId: 'local',
            organizationId: 'local',
        }));
    });

    it('compiles the live preview with the bundled GSAP runtime inline', async () => {
        const html = await electronRenderService.compilePreview(project([{
            id: 'title', type: 'text', text: 'indii', name: 'Title',
            startFrame: 0, durationInFrames: 30, trackId: 't1',
        }]));

        expect(mocks.compile).toHaveBeenCalledOnce();
        expect(html).not.toContain('src="./gsap.min.js"');
        expect(html).toContain('<script>');
        expect(html.length).toBeGreaterThan(1_000);
    });
});
