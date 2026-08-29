import { describe, it, expect, vi } from 'vitest';
import type { CompletedRenderReceipt, IndiiVideoProject } from '@indii/shared';
import {
    buildStillMotionProject,
    renderStillMotion,
    STILL_MOTION_RESOLUTIONS,
    STILL_MOTION_FPS
} from '../StillMotionRenderer';

describe('buildStillMotionProject', () => {
    it('builds a single-clip deterministic project with the move serialized', () => {
        const { project, move } = buildStillMotionProject({
            stillUrl: 'https://cdn.test/still.png',
            preset: 'dolly-in',
            resolution: '9:16'
        });

        expect(move.kind).toBe('dolly-in');
        expect(project.fps).toBe(STILL_MOTION_FPS);
        expect(project.durationInFrames).toBe(4 * STILL_MOTION_FPS);
        expect(project.width).toBe(1080);
        expect(project.height).toBe(1920);
        expect(project.clips).toHaveLength(1);
        const clip = project.clips[0]!;
        expect(clip.type).toBe('image');
        expect(clip.src).toBe('https://cdn.test/still.png');
        expect(JSON.parse(clip.name.replace(/^still:/, ''))).toEqual(move);
    });

    it('supports all three output resolutions', () => {
        for (const resolution of Object.keys(STILL_MOTION_RESOLUTIONS) as Array<keyof typeof STILL_MOTION_RESOLUTIONS>) {
            const { project } = buildStillMotionProject({ stillUrl: 'x.png', resolution });
            expect(project.width).toBe(STILL_MOTION_RESOLUTIONS[resolution].width);
            expect(project.height).toBe(STILL_MOTION_RESOLUTIONS[resolution].height);
        }
    });

    it('applies intensity/duration overrides with validation', () => {
        const { move } = buildStillMotionProject({
            stillUrl: 'x.png', preset: 'pan-left', intensity: 0.8, durationSec: 6
        });
        expect(move.intensity).toBe(0.8);
        expect(move.durationSec).toBe(6);

        expect(() => buildStillMotionProject({ stillUrl: 'x.png', preset: 'pan-left', intensity: 1.5 }))
            .toThrow(/between 0 and 1/);
        expect(() => buildStillMotionProject({ stillUrl: '', preset: 'pan-left' })).toThrow(/stillUrl/);
    });
});

describe('renderStillMotion through the render contract (E1.3 — 24-frame smoke)', () => {
    it('renders a 24-frame clip via LocalVideoProjectRenderer and records the receipt', async () => {
        const render = vi.fn(async (_config: { compositionId: string; inputProps: { project: IndiiVideoProject } }) => '/managed/still_motion.mp4');
        const recordArtifact = vi.fn(async () => undefined);

        const receipt: CompletedRenderReceipt = await renderStillMotion(
            { stillUrl: 'file:///tmp/still.png', preset: 'dolly-in', durationSec: 24 / STILL_MOTION_FPS, resolution: '9:16' },
            { outputName: 'still_motion.mp4' },
            {
                videoApi: { getDefaultPath: vi.fn(async () => '/managed/still_motion.mp4'), render },
                now: () => 77,
                createRenderId: () => 'render-e1',
                recordArtifact
            }
        );

        expect(receipt.status).toBe('completed');
        expect(receipt.renderId).toBe('render-e1');
        expect(receipt.asset.mimeType).toBe('video/mp4');

        const call = render.mock.calls[0]![0];
        const project = call.inputProps.project;
        expect(project.durationInFrames).toBe(24);
        expect(project.clips[0]!.type).toBe('image');
        // The per-frame moveTransform spec travels with the project.
        expect(JSON.parse(project.clips[0]!.name.replace(/^still:/, ''))).toEqual({
            kind: 'dolly-in', intensity: 0.35, durationSec: 0.8
        });
        expect(recordArtifact).toHaveBeenCalledWith(receipt, project, undefined);
    });
});
