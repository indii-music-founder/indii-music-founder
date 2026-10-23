import type { CutoutPoint, CutoutRectangle } from './segmentation/GrabCut';

/** Detect a collapsed initial selection before it replaces the artist photo. */
export function cutoutRetainedFraction(mask: Uint8Array, width: number, height: number, rectangle: CutoutRectangle): number {
    const left = Math.max(0, Math.floor(rectangle.x)), top = Math.max(0, Math.floor(rectangle.y));
    const right = Math.min(width, Math.ceil(rectangle.x + rectangle.width));
    const bottom = Math.min(height, Math.ceil(rectangle.y + rectangle.height));
    const area = Math.max(0, right - left) * Math.max(0, bottom - top);
    if (!area || mask.length !== width * height) return 0;
    let retained = 0;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) if (mask[y * width + x]! > 0) retained++;
    return retained / area;
}

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
export function cutoutZoomOffset(offset: number, previousViewportSize: number, nextViewportSize: number, previousContentSize: number, nextContentSize: number): number {
    return Math.max(0, (offset + previousViewportSize / 2) * nextContentSize / previousContentSize - nextViewportSize / 2);
}
