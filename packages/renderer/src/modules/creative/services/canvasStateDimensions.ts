export interface CanvasStateDimensions { width: number; height: number; }
export interface CanvasBaseBounds extends CanvasStateDimensions { left: number; top: number; }

/** Keep the saved artboard, rather than expanding it to the editor viewport. */
export function canvasStateDimensions(state: unknown, baseBounds?: CanvasBaseBounds): CanvasStateDimensions | null {
    const validate = (width: unknown, height: unknown): CanvasStateDimensions | null => {
        if (typeof width !== 'number' || typeof height !== 'number' ||
            !Number.isFinite(width) || !Number.isFinite(height) ||
            width < 1 || height < 1 || width > 16384 || height > 16384) return null;
        return { width: Math.round(width), height: Math.round(height) };
    };
    if (state && typeof state === 'object') {
        const saved = state as { width?: unknown; height?: unknown };
        const dimensions = validate(saved.width, saved.height);
        if (dimensions) return dimensions;
    }
    // Older snapshots omitted stage dimensions. A centered, tagged base image
    // retains the original symmetric margins in its world-space bounding box.
    if (!baseBounds || !Number.isFinite(baseBounds.left) || !Number.isFinite(baseBounds.top) ||
        baseBounds.left < 0 || baseBounds.top < 0 || baseBounds.width <= 0 || baseBounds.height <= 0) return null;
    return validate(baseBounds.width + 2 * baseBounds.left, baseBounds.height + 2 * baseBounds.top);
}
