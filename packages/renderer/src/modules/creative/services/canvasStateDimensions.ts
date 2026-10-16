export interface CanvasStateDimensions { width: number; height: number; }
export interface CanvasBaseBounds extends CanvasStateDimensions { left: number; top: number; }

/** Keep the saved artboard, rather than expanding it to the editor viewport. */
export function canvasStateDimensions(state: unknown, baseBounds?: CanvasBaseBounds, contentBounds?: CanvasBaseBounds[]): CanvasStateDimensions | null {
    const validate = (width: unknown, height: unknown): CanvasStateDimensions | null => {
        if (typeof width !== 'number' || typeof height !== 'number' ||
            !Number.isFinite(width) || !Number.isFinite(height) ||
            width < 1 || height < 1 || width > 16384 || height > 16384) return null;
        return { width: Math.round(width), height: Math.round(height) };
    };
    const inferred = baseBounds && Number.isFinite(baseBounds.left) && Number.isFinite(baseBounds.top) &&
        baseBounds.left >= 0 && baseBounds.top >= 0 && baseBounds.width > 0 && baseBounds.height > 0
        ? validate(baseBounds.width + 2 * baseBounds.left, baseBounds.height + 2 * baseBounds.top)
        : null;
    if (state && typeof state === 'object') {
        const saved = state as { width?: unknown; height?: unknown };
        const dimensions = validate(saved.width, saved.height);
        if (dimensions) {
            // Older restore events could autosave the temporary wide viewport
            // while every object still occupied its original centered artboard.
            // Repair only when the original image ratio agrees and no object
            // would be clipped; intentional off-center layouts remain intact.
            if (inferred && baseBounds && contentBounds?.length &&
                Math.abs(inferred.width / inferred.height - baseBounds.width / baseBounds.height) < 0.005 &&
                Math.abs(dimensions.width / dimensions.height - inferred.width / inferred.height) > 0.02 &&
                contentBounds.every(bounds => [bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) &&
                    bounds.left >= -1 && bounds.top >= -1 && bounds.width >= 0 && bounds.height >= 0 &&
                    bounds.left + bounds.width <= inferred.width + 1 && bounds.top + bounds.height <= inferred.height + 1)) {
                return inferred;
            }
            return dimensions;
        }
    }
    // Older snapshots omitted stage dimensions. A centered, tagged base image
    // retains the original symmetric margins in its world-space bounding box.
    return inferred;
}

/** Explicit recovery only: retain every layer and their relative placement. */
export function artworkArtboardBounds(bounds: CanvasBaseBounds[], padding = 20): CanvasBaseBounds | null {
    if (!bounds.length || !Number.isFinite(padding) || padding < 0) return null;
    if (bounds.some(box => ![box.left, box.top, box.width, box.height].every(Number.isFinite) || box.width < 0 || box.height < 0)) return null;
    const left = Math.floor(Math.min(...bounds.map(box => box.left)) - padding);
    const top = Math.floor(Math.min(...bounds.map(box => box.top)) - padding);
    const right = Math.ceil(Math.max(...bounds.map(box => box.left + box.width)) + padding);
    const bottom = Math.ceil(Math.max(...bounds.map(box => box.top + box.height)) + padding);
    const width = right - left;
    const height = bottom - top;
    if (width < 1 || height < 1 || width > 16384 || height > 16384) return null;
    return { left, top, width, height };
}

/** Display size only; logical artboard pixels and object geometry stay unchanged. */
export function canvasViewportSize(artboard: CanvasStateDimensions, viewport: CanvasStateDimensions): CanvasStateDimensions | null {
    if (![artboard.width, artboard.height, viewport.width, viewport.height].every(value => Number.isFinite(value) && value > 0)) return null;
    const scale = Math.min(viewport.width / artboard.width, viewport.height / artboard.height);
    return { width: artboard.width * scale, height: artboard.height * scale };
}
