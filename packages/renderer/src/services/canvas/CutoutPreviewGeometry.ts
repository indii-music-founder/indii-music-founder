import type { CutoutPoint } from './segmentation/GrabCut';

/** CSS bounds include the current zoom and scroll position. Strokes stay in source pixels. */
export function cutoutSourcePoint(
    point: CutoutPoint,
    bounds: { left: number; top: number; width: number; height: number },
    source: { width: number; height: number },
): CutoutPoint {
    return {
        x: Math.max(0, Math.min(source.width, (point.x - bounds.left) / bounds.width * source.width)),
        y: Math.max(0, Math.min(source.height, (point.y - bounds.top) / bounds.height * source.height)),
    };
}

/** Keep the viewed source region centered when changing magnification. */
export function cutoutZoomOffset(offset: number, previousViewportSize: number, nextViewportSize: number, previousZoom: number, nextZoom: number): number {
    return Math.max(0, (offset + previousViewportSize / 2) * nextZoom / previousZoom - nextViewportSize / 2);
}
