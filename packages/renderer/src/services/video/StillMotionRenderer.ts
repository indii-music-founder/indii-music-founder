/**
 * StillMotionRenderer.ts
 *
 * Builds and renders a deterministic single-still camera-move video
 * (Workstream E1 — docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §10).
 *
 * The project follows the shared IndiiVideoProject contract (one image clip),
 * so it renders through the existing LocalVideoProjectRenderer entry point —
 * desktop via Electron, web via the durable cloud render protocol. The
 * per-frame transform is the pure `moveTransform` contract from
 * MotionPresets, serialized with the project so the render worker applies it
 * per frame; nothing here mutates during a render.
 *
 * Supported outputs: 1080×1920, 1920×1080, 1080×1350.
 */

import type { IndiiVideoProject } from '@indii/shared';
import { renderVideoProjectLocally, type LocalVideoRenderOptions, type LocalVideoRenderDependencies } from './LocalVideoProjectRenderer';
import { MOTION_PRESETS, type CameraMove } from './MotionPresets';

export const STILL_MOTION_RESOLUTIONS = {
    '9:16': { width: 1080, height: 1920 },
    '16:9': { width: 1920, height: 1080 },
    '4:5': { width: 1080, height: 1350 }
} as const;

export type StillMotionResolution = keyof typeof STILL_MOTION_RESOLUTIONS;

export const STILL_MOTION_FPS = 30;

export interface StillMotionRequest {
    stillUrl: string;
    /** Preset id from MOTION_PRESETS, or a fully-specified move. */
    preset?: string;
    move?: CameraMove;
    /** Overrides move.durationSec when provided. */
    durationSec?: number;
    intensity?: number;
    resolution?: StillMotionResolution;
    name?: string;
}

export function resolveMove(req: Pick<StillMotionRequest, 'preset' | 'move' | 'intensity' | 'durationSec'>): CameraMove {
    const base: CameraMove = req.move
        ? { ...req.move }
        : (req.preset && MOTION_PRESETS[req.preset])
            ? { ...MOTION_PRESETS[req.preset] }
            : { ...MOTION_PRESETS['ken-burns']! };

    if (req.intensity !== undefined) {
        if (req.intensity < 0 || req.intensity > 1) throw new Error('StillMotionRenderer: intensity must be between 0 and 1');
        base.intensity = req.intensity;
    }
    if (req.durationSec !== undefined) {
        if (req.durationSec <= 0) throw new Error('StillMotionRenderer: durationSec must be positive');
        base.durationSec = req.durationSec;
    }
    return base;
}

/**
 * Deterministic single-clip project for a still with a camera move.
 * `motion` is carried in the project name + clip name so the render worker
 * composition can reconstruct the exact per-frame `moveTransform` parameters
 * without hidden state.
 */
export function buildStillMotionProject(req: StillMotionRequest): { project: IndiiVideoProject; move: CameraMove } {
    if (!req.stillUrl) throw new Error('StillMotionRenderer: stillUrl is required');

    const resolution = req.resolution ?? '9:16';
    const { width, height } = STILL_MOTION_RESOLUTIONS[resolution];
    const move = resolveMove(req);
    const fps = STILL_MOTION_FPS;
    const durationInFrames = Math.round(move.durationSec * fps);

    const moveSpec = JSON.stringify(move);
    const name = req.name ?? `Still motion: ${move.kind} ${move.durationSec}s`;

    const project: IndiiVideoProject = {
        id: `still-motion-${move.kind}-${durationInFrames}f`,
        name,
        fps,
        durationInFrames,
        width,
        height,
        tracks: [{ id: 'track-1', type: 'video', name: 'Still' }],
        clips: [{
            id: 'clip-still',
            name: `still:${moveSpec}`,
            type: 'image',
            trackId: 'track-1',
            src: req.stillUrl,
            startFrame: 0,
            durationInFrames
        }]
    };

    return { project, move };
}

/**
 * Render a still-motion clip through the standard local/cloud render contract.
 */
export async function renderStillMotion(
    req: StillMotionRequest,
    options: LocalVideoRenderOptions = {},
    dependencies?: LocalVideoRenderDependencies
) {
    const { project } = buildStillMotionProject(req);
    return renderVideoProjectLocally(
        project,
        { outputName: options.outputName ?? `still-motion-${req.preset ?? req.move?.kind ?? 'ken-burns'}.mp4`, ...options },
        dependencies
    );
}
