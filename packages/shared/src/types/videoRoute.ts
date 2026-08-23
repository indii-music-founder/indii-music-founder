/**
 * RenderPlanner — pure DIRECT vs COMPOSED routing (MIG-004, ADR-001).
 *
 * Classifies render work BEFORE any engine loads:
 *   direct_media    → FFmpeg fast path (MediaOps). Never enters Chromium.
 *   composed_visual → renderer contract (composition engine behind the boundary).
 *
 * This module is engine-blind and dependency-free: both the renderer process
 * (dispatch) and workers (execution) may import it. Rules are ordered and
 * deterministic; the matched rule's `reason` travels onto the job document so
 * every routing decision is auditable after the fact.
 */

import type { IndiiVideoClip, IndiiVideoProject } from './videoProject.js';

export type DirectMediaOp = 'trim' | 'transcode' | 'audio_replace' | 'thumbnail';

export type VideoRoute = 'direct_media' | 'composed_visual';

export interface VideoRouteDecision {
    route: VideoRoute;
    /** Present iff route === 'direct_media'. */
    op?: DirectMediaOp;
    /** Stable machine reason for the decision (persisted on the job doc). */
    reason: string;
}

/** Caller-supplied inputs to routing. At most one of these is required. */
export interface RoutePlanInput {
    /** Explicit fast-path operation requested by API/UI shortcut. Wins outright. */
    explicitOp?: DirectMediaOp;
    /** Compiled editor project, when the request originates from the timeline. */
    project?: Pick<IndiiVideoProject, 'clips' | 'tracks'>;
}

export class VideoRouteError extends Error {
    constructor(reason: string) {
        super(`render-planner: ${reason}`);
        this.name = 'VideoRouteError';
        this.reason = reason;
    }
    readonly reason: string;
}

const hasCompositionEffects = (clip: IndiiVideoClip): boolean =>
    Boolean(
        clip.filter
        || clip.transitionIn
        || clip.transitionOut
        || (clip.keyframes && Object.keys(clip.keyframes).length > 0)
        || clip.x !== undefined
        || clip.y !== undefined
        || clip.width !== undefined
        || clip.height !== undefined
        || clip.scale !== undefined
        || clip.opacity !== undefined
        || clip.rotation !== undefined
        || clip.anchorX !== undefined
        || clip.anchorY !== undefined
        || clip.borderRadius !== undefined
    );

/**
 * Decide the route for one unit of render work. Throws `VideoRouteError`
 * (fail-closed) rather than guessing when inputs are absent or degenerate.
 */
export const planRenderRoute = (input: RoutePlanInput): VideoRouteDecision => {
    const { explicitOp, project } = input;

    // 1. Explicit fast-path request wins outright.
    if (explicitOp) {
        return { route: 'direct_media', op: explicitOp, reason: 'explicit-direct-op' };
    }

    // 2. Need something to route.
    if (!project) {
        throw new VideoRouteError('no-routable-input');
    }

    const clips = project.clips ?? [];
    if (clips.length === 0) {
        throw new VideoRouteError('empty-project');
    }

    // 3. Text always requires the composition engine (typography/layout engine).
    if (clips.some(c => c.type === 'text')) {
        return { route: 'composed_visual', reason: 'text-requires-composition' };
    }

    // 4. Any effect/transition/keyframe requires composition.
    if (clips.some(hasCompositionEffects)) {
        return { route: 'composed_visual', reason: 'effects-require-composition' };
    }

    // 5. Image clips are treated as graphic overlays (conservative until a
    //    proven slideshow fast-path exists).
    if (clips.some(c => c.type === 'image')) {
        return { route: 'composed_visual', reason: 'graphic-overlay' };
    }

    // 6. Track-level presentation controls need the
    //    composition/mix engine. The direct executor intentionally has no
    //    implicit policy for inventing picture or applying timeline controls.
    if (project.tracks.some(track => track.isMuted || track.isHidden)) {
        return { route: 'composed_visual', reason: 'track-controls-require-composition' };
    }

    // 7. One full-span video plus one full-span audio clip is the explicit
    //    FFmpeg audio-replacement primitive, not a visual composition.
    const videoClips = clips.filter(c => c.type === 'video');
    const audioClips = clips.filter(c => c.type === 'audio');
    if (
        clips.length === 2
        && videoClips.length === 1
        && audioClips.length === 1
        && videoClips[0]!.startFrame === 0
        && audioClips[0]!.startFrame === 0
        && videoClips[0]!.durationInFrames === audioClips[0]!.durationInFrames
        && (audioClips[0]!.volume ?? 1) === 1
    ) {
        return { route: 'direct_media', op: 'audio_replace', reason: 'single-video-master-audio' };
    }

    // Other audio timelines require composition/mixing.
    if (audioClips.length > 0) {
        return { route: 'composed_visual', reason: 'audio-timeline' };
    }

    // 8. More than one clip implies sequencing/mixing → composition.
    if (clips.length > 1) {
        return { route: 'composed_visual', reason: 'multi-clip-timeline' };
    }

    // 9. A non-zero timeline start implies a hold/gap that FFmpeg's direct
    //    trim/transcode primitives do not synthesize.
    const only = clips[0] as IndiiVideoClip;
    if (only.startFrame !== 0) {
        return { route: 'composed_visual', reason: 'timeline-offset' };
    }

    // 10. Exactly one plain video clip survives all composition triggers.
    if (only.sourceInUs !== undefined && only.sourceOutUs !== undefined) {
        return { route: 'direct_media', op: 'trim', reason: 'single-clip-trim' };
    }
    return { route: 'direct_media', op: 'transcode', reason: 'single-clip-passthrough' };
};

/** Flatten a decision into job-document metadata (persisted for auditability). */
export const decisionToJobMetadata = (
    decision: VideoRouteDecision,
): Record<string, string> => ({
    videoRoute: decision.route,
    ...(decision.op ? { videoOp: decision.op } : {}),
    routeReason: decision.reason,
});
