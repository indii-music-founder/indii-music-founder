/**
 * SmartCrop.ts
 *
 * Pure, dependency-free crop computation for multi-platform asset export
 * (Workstream G1 — docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §12).
 *
 * Given a source image size, a destination size, and optional anchors
 * (face/logo/manual boxes), returns the cover-fit crop: the scale at which
 * the source must be drawn so it fully covers the destination, and the
 * top-left origin of the crop window in SOURCE coordinates.
 *
 * No DOM, no Fabric, no canvas — fully unit-testable.
 */

export interface CropAnchor {
    /** Normalized (0..1) box in source coordinates. */
    box: { xmin: number; ymin: number; xmax: number; ymax: number };
    kind: 'face' | 'logo' | 'manual';
}

export interface CropResult {
    /** Crop-window top-left in source pixels. */
    x: number;
    y: number;
    /**
     * Scale factor applied to the source before cropping:
     * drawnWidth = srcW * scale, drawnHeight = srcH * scale.
     * The crop window (dstW / scale) x (dstH / scale) is taken at (x, y).
     */
    scale: number;
}

/** Aspect-ratio change ratio beyond which a crop would destroy too much artwork (see plan §12 fit rules). */
export const EXTREME_ASPECT_THRESHOLD = 1.6;

/** Fraction of the crop window kept as margin around a face anchor. */
export const FACE_MARGIN = 0.15;

function aspectRatio(w: number, h: number): number {
    return w / h;
}

/**
 * Cover-fit scale for src → dst: the smallest scale at which the source fully covers the destination.
 */
export function coverScale(srcW: number, srcH: number, dstW: number, dstH: number): number {
    return Math.max(dstW / srcW, dstH / srcH);
}

/**
 * True when the aspect change between src and dst is extreme enough that a
 * cover crop would discard more than the threshold allows — callers should
 * prefer 'contain-blur-pad' in that case (plan §12 fit rules).
 */
export function isExtremeAspectChange(srcW: number, srcH: number, dstW: number, dstH: number): boolean {
    const srcA = aspectRatio(srcW, srcH);
    const dstA = aspectRatio(dstW, dstH);
    const ratio = srcA > dstA ? srcA / dstA : dstA / srcA;
    return ratio > EXTREME_ASPECT_THRESHOLD;
}

/**
 * Compute the cover-fit crop for src → dst.
 *
 * - Same aspect → identity crop (x = y = 0, scale = dstW / srcW).
 * - No anchors (or no usable face anchor) → center crop.
 * - Face-anchored → the crop window is positioned so the face box center sits
 *   centered with FACE_MARGIN breathing room, biased toward the image edge the
 *   window cannot extend into, then clamped to source bounds.
 * - Logo/manual anchors are respected only when the fit is tight enough that
 *   no axis freedom exists differently; otherwise they act as centering hints
 *   (same as face).
 */
export function computeCrop(
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number,
    anchors?: CropAnchor[]
): CropResult {
    if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
        throw new Error('computeCrop: source and destination dimensions must be positive');
    }

    const scale = coverScale(srcW, srcH, dstW, dstH);
    const winW = dstW / scale;
    const winH = dstH / scale;

    const clampX = (x: number) => Math.min(Math.max(x, 0), Math.max(srcW - winW, 0));
    const clampY = (y: number) => Math.min(Math.max(y, 0), Math.max(srcH - winH, 0));

    // Identity crop: window already spans the whole source on both axes.
    if (winW >= srcW && winH >= srcH) {
        return { x: 0, y: 0, scale };
    }

    const anchor = pickAnchor(anchors);

    if (!anchor) {
        // Center crop.
        return { x: clampX((srcW - winW) / 2), y: clampY((srcH - winH) / 2), scale };
    }

    // Anchor box center in source pixels.
    const cx = ((anchor.box.xmin + anchor.box.xmax) / 2) * srcW;
    const cy = ((anchor.box.ymin + anchor.box.ymax) / 2) * srcH;

    // Position the window so the anchor center is centered, with margin bias:
    // nudge the window toward keeping the anchor at (0.5 ± FACE_MARGIN) of the
    // window rather than dead-center, giving the subject breathing room in the
    // direction of the larger free space.
    const marginX = winW * FACE_MARGIN;
    const marginY = winH * FACE_MARGIN;

    let x = cx - winW / 2;
    let y = cy - winH / 2;

    // Apply margin bias only on axes where the window actually has freedom.
    if (winW < srcW) {
        const freeLeft = cx;
        const freeRight = srcW - cx;
        if (freeLeft > freeRight) x -= marginX / 2;
        else x += marginX / 2;
    }
    if (winH < srcH) {
        const freeTop = cy;
        const freeBottom = srcH - cy;
        if (freeTop > freeBottom) y -= marginY / 2;
        else y += marginY / 2;
    }

    return { x: clampX(x), y: clampY(y), scale };
}

function pickAnchor(anchors?: CropAnchor[]): CropAnchor | null {
    if (!anchors || anchors.length === 0) return null;
    const usable = anchors.filter(a => {
        const b = a.box;
        return (
            b.xmax > b.xmin &&
            b.ymax > b.ymin &&
            b.xmin >= 0 && b.ymin >= 0 &&
            b.xmax <= 1 && b.ymax <= 1
        );
    });
    if (usable.length === 0) return null;
    // Prefer face > manual > logo; largest box within the preferred kind wins.
    const rank: Record<CropAnchor['kind'], number> = { face: 0, manual: 1, logo: 2 };
    usable.sort((a, b) => {
        const r = rank[a.kind] - rank[b.kind];
        if (r !== 0) return r;
        const areaA = (a.box.xmax - a.box.xmin) * (a.box.ymax - a.box.ymin);
        const areaB = (b.box.xmax - b.box.xmin) * (b.box.ymax - b.box.ymin);
        return areaB - areaA;
    });
    return usable[0] ?? null;
}
