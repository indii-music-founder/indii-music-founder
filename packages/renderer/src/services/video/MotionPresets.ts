/**
 * MotionPresets.ts
 *
 * Deterministic camera moves for still images (Workstream E1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §10). Pure math, no DOM, no
 * Remotion dependency — fully unit-testable and render-safe.
 *
 * OVERSCAN RULE: every render starts from a source scaled to at least
 * OVERSCAN_BASE (1.08×) and the full move range is applied INSIDE that
 * envelope, so frame edges can never show at any progress value.
 */

export type CameraMoveKind =
    | 'dolly-in'
    | 'dolly-out'
    | 'pan-left'
    | 'pan-right'
    | 'tilt-up'
    | 'tilt-down'
    | 'ken-burns';

export interface CameraMove {
    kind: CameraMoveKind;
    /** 0..1, default 0.35. Fraction of the maximum move range. */
    intensity: number;
    durationSec: number;
}

export const DEFAULT_INTENSITY = 0.35;
export const DEFAULT_DURATION_SEC = 4;

/** Base overscan scale applied before any move (frame edges never show). */
export const OVERSCAN_BASE = 1.08;

/** Maximum additional scale range a full-intensity dolly may use. */
export const MAX_DOLLY_RANGE = 0.25;

export const MOTION_PRESETS: Record<string, CameraMove> = {
    'dolly-in': { kind: 'dolly-in', intensity: DEFAULT_INTENSITY, durationSec: DEFAULT_DURATION_SEC },
    'dolly-out': { kind: 'dolly-out', intensity: DEFAULT_INTENSITY, durationSec: DEFAULT_DURATION_SEC },
    'pan-left': { kind: 'pan-left', intensity: DEFAULT_INTENSITY, durationSec: DEFAULT_DURATION_SEC },
    'pan-right': { kind: 'pan-right', intensity: DEFAULT_INTENSITY, durationSec: DEFAULT_DURATION_SEC },
    'tilt-up': { kind: 'tilt-up', intensity: DEFAULT_INTENSITY, durationSec: DEFAULT_DURATION_SEC },
    'tilt-down': { kind: 'tilt-down', intensity: DEFAULT_INTENSITY, durationSec: DEFAULT_DURATION_SEC },
    'ken-burns': { kind: 'ken-burns', intensity: DEFAULT_INTENSITY, durationSec: DEFAULT_DURATION_SEC }
};

export const MOTION_PRESET_IDS = Object.keys(MOTION_PRESETS);

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

/** Cubic in-out easing — slow start, linear-feel middle, slow settle. */
export function cubicInOut(t: number): number {
    const x = clamp01(t);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export interface FrameTransform {
    scale: number;
    translateX: number;
    translateY: number;
}

/**
 * Per-frame transform for a camera move.
 *
 * - progress 0 → exact start anchor; progress 1 → exact end anchor.
 * - scale is always >= OVERSCAN_BASE.
 * - |translate| never exceeds the overscan envelope
 *   (frame * (scale - 1) / 2) on either axis, for ANY preset/intensity —
 *   guaranteed by construction (translate is a FRACTION of the envelope).
 */
export function moveTransform(move: CameraMove, progress: number, frameW: number, frameH: number): FrameTransform {
    if (frameW <= 0 || frameH <= 0) throw new Error('moveTransform: frame dimensions must be positive');
    if (!MOTION_PRESET_IDS.includes(move.kind) && !isKnownKind(move.kind)) {
        throw new Error(`moveTransform: unknown camera move kind "${String(move.kind)}"`);
    }

    const e = cubicInOut(progress);
    const intensity = clamp01(move.intensity);
    const dollyRange = MAX_DOLLY_RANGE * intensity;

    let scale: number;
    let fx = 0; // fraction of the X envelope to use, signed
    let fy = 0; // fraction of the Y envelope to use, signed

    switch (move.kind) {
        case 'dolly-in':
            scale = OVERSCAN_BASE + dollyRange * e;
            break;
        case 'dolly-out':
            scale = OVERSCAN_BASE + dollyRange * (1 - e);
            break;
        case 'pan-left':
            scale = OVERSCAN_BASE;
            fx = -1 * e;
            break;
        case 'pan-right':
            scale = OVERSCAN_BASE;
            fx = 1 * e;
            break;
        case 'tilt-up':
            scale = OVERSCAN_BASE;
            fy = -1 * e;
            break;
        case 'tilt-down':
            scale = OVERSCAN_BASE;
            fy = 1 * e;
            break;
        case 'ken-burns':
            scale = OVERSCAN_BASE + dollyRange * e;
            fx = 0.6 * e;
            fy = -0.4 * e;
            break;
    }

    const envelopeX = (frameW * (scale - 1)) / 2;
    const envelopeY = (frameH * (scale - 1)) / 2;

    return {
        scale: Math.round(scale * 10000) / 10000,
        translateX: Math.round(fx * envelopeX * 100) / 100,
        translateY: Math.round(fy * envelopeY * 100) / 100
    };
}

function isKnownKind(kind: string): kind is CameraMoveKind {
    return [
        'dolly-in', 'dolly-out', 'pan-left',
        'pan-right', 'tilt-up', 'tilt-down', 'ken-burns'
    ].includes(kind);
}

// ---------------------------------------------------------------------------
// E2 — generative micro-motion (opt-in, flag-gated OFF by default).
// Constant prompt scaffolds only; the gated VideoGenerationService call lives
// in the tool layer and must show a cost notice before the first call.
// ---------------------------------------------------------------------------

export const GEN_MOTION_FLAG = 'VITE_ENABLE_GEN_MOTION';

export const CINEMATIC_MOVE_PROMPTS: Record<CameraMoveKind, string> = {
    'dolly-in': 'slow dolly-in, subtle parallax, subject and wardrobe stable, no scene change, 4 seconds',
    'dolly-out': 'slow dolly-out, subtle parallax, subject and wardrobe stable, no scene change, 4 seconds',
    'pan-left': 'slow pan to the left, subtle parallax, subject and wardrobe stable, no scene change, 4 seconds',
    'pan-right': 'slow pan to the right, subtle parallax, subject and wardrobe stable, no scene change, 4 seconds',
    'tilt-up': 'slow tilt up, subtle parallax, subject and wardrobe stable, no scene change, 4 seconds',
    'tilt-down': 'slow tilt down, subtle parallax, subject and wardrobe stable, no scene change, 4 seconds',
    'ken-burns': 'slow ken-burns drift, subtle parallax, subject and wardrobe stable, no scene change, 4 seconds'
};

/** E2 gating helper: the generative path stays dark unless the flag is set. */
export function genMotionEnabled(env: Record<string, string | undefined>): boolean {
    return env[GEN_MOTION_FLAG] === 'true' || env[GEN_MOTION_FLAG] === '1';
}
