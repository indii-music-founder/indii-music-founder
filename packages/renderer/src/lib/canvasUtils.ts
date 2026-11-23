import * as fabric from 'fabric';

/**
 * Convert hex color to rgba string
 * @param hex - Hex color string (e.g., '#ff0000')
 * @param alpha - Alpha value 0-1 (default: 1)
 * @returns rgba string (e.g., 'rgba(255, 0, 0, 0.5)')
 */
export function hexToRgba(hex: string, alpha = 1): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Scale and center an image to fit within a canvas with padding
 * @param img - Fabric.js Image object
 * @param canvas - Fabric.js Canvas object
 * @param padding - Padding in pixels (default: 40)
 */
export function scaleImageToCanvas(
    img: fabric.Image,
    canvas: fabric.Canvas,
    padding = 40
): void {
    const scale = Math.min(
        (canvas.width! - padding) / img.width!,
        (canvas.height! - padding) / img.height!
    );
    img.scale(scale);
    img.set({
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
    });
}

/** Longest side, in pixels, a saved canvas export may have (keeps PNG encoding and upload bounded). */
export const MAX_CANVAS_EXPORT_SIDE = 6000;

/**
 * ISSUE-1708: the artboard is fitted to the window, so the old fixed 2x export
 * saved a 3000x3000 artwork as ~1276x1276 on a normal screen. This picks the
 * multiplier that restores the base image's native resolution (never below
 * the old 2x, never above MAX_CANVAS_EXPORT_SIDE).
 */
export function exportMultiplierFor(baseImageScale: number, canvasWidth: number, canvasHeight: number): number {
    const longest = Math.max(canvasWidth, canvasHeight);
    if (!Number.isFinite(baseImageScale) || baseImageScale <= 0 || !Number.isFinite(longest) || longest <= 0) return 2;
    const native = 1 / baseImageScale;
    const cap = MAX_CANVAS_EXPORT_SIDE / longest;
    return Math.max(2, Math.min(native, cap));
}

/** A crop of the on-screen canvas, in screen pixels, plus the multiplier that renders it. */
export interface CanvasExportRegion {
    left: number;
    top: number;
    width: number;
    height: number;
    multiplier: number;
}

/**
 * ISSUE-1708 (follow-up): the base image is fitted with padding, so exporting
 * the whole artboard at native scale saved a 3000x3000 artwork as 3201x3201
 * with a border. Crop the export to the base image's on-screen bounds instead.
 * The multiplier is nudged up by a hair because a canvas element truncates a
 * fractional size (2999.9999 would become 2999).
 */
export function nativeExportRegion(
    imageBounds: { left: number; top: number; width: number; height: number },
    baseImageScale: number,
    canvasWidth: number,
    canvasHeight: number,
): CanvasExportRegion {
    const left = Math.max(0, imageBounds.left);
    const top = Math.max(0, imageBounds.top);
    const width = Math.min(canvasWidth, imageBounds.left + imageBounds.width) - left;
    const height = Math.min(canvasHeight, imageBounds.top + imageBounds.height) - top;
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        return { left: 0, top: 0, width: canvasWidth, height: canvasHeight, multiplier: exportMultiplierFor(baseImageScale, canvasWidth, canvasHeight) };
    }
    const multiplier = exportMultiplierFor(baseImageScale, width, height);
    const longest = Math.max(width, height);
    const targetLongest = Math.round(longest * multiplier);
    return { left, top, width, height, multiplier: (targetLongest + 1e-6) / longest };
}
