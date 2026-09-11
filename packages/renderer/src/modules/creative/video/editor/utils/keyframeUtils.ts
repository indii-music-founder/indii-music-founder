import type { IndiiVideoKeyframe, IndiiKeyframeEasing } from '@indii/shared';

export function getKeyframeColor(easing?: string): string {
    switch (easing) {
        case 'easeIn': return 'bg-blue-400';
        case 'easeOut': return 'bg-green-400';
        case 'easeInOut': return 'bg-purple-400';
        case 'linear': return 'bg-yellow-400';
        default: return 'bg-yellow-400';
    }
}

/** Normalized easing function evaluating t in [0, 1] */
export function easeValue(t: number, easing?: IndiiKeyframeEasing | string): number {
    const clampedT = Math.max(0, Math.min(1, t));
    switch (easing) {
        case 'easeIn':
            return clampedT * clampedT;
        case 'easeOut':
            return clampedT * (2 - clampedT);
        case 'easeInOut':
            return clampedT < 0.5 ? 2 * clampedT * clampedT : -1 + (4 - 2 * clampedT) * clampedT;
        case 'linear':
        default:
            return clampedT;
    }
}

/**
 * Calculates the interpolated property value at a specific frame relative to clip start.
 * If keyframes are empty, returns defaultValue.
 * Clamps to first keyframe value before first keyframe, and last keyframe value after last.
 */
export function interpolateKeyframeValue(
    keyframes: IndiiVideoKeyframe[] | undefined,
    relativeFrame: number,
    defaultValue: number = 1
): number {
    if (!keyframes || keyframes.length === 0) return defaultValue;

    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
    if (relativeFrame <= sorted[0]!.frame) return sorted[0]!.value;
    if (relativeFrame >= sorted[sorted.length - 1]!.frame) return sorted[sorted.length - 1]!.value;

    for (let i = 0; i < sorted.length - 1; i++) {
        const k1 = sorted[i]!;
        const k2 = sorted[i + 1]!;
        if (relativeFrame >= k1.frame && relativeFrame <= k2.frame) {
            const span = k2.frame - k1.frame;
            if (span === 0) return k2.value;
            const t = (relativeFrame - k1.frame) / span;
            const easedT = easeValue(t, k1.easing);
            return k1.value + (k2.value - k1.value) * easedT;
        }
    }

    return defaultValue;
}
