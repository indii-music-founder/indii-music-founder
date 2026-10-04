/**
 * canvasBleed.ts
 *
 * Pure mathematical geometry and canvas rendering for print bleed extensions
 * and focal-crop adaptations (PRD / Local Native Architecture).
 *
 * Implements:
 * 1. coverCropGeometry: Normalized focal-point (fx, fy) crop calculations.
 * 2. renderBleedMirror: Exact OpenCV BORDER_REFLECT_101 equivalent (d c b | a b c d | c b a)
 *    using HTML5 Canvas 2D matrix transformations for 4 borders and 4 corners.
 * 3. renderGuideOverlay: Visual proof layer with red trim and green safe-zone bounds.
 */

export interface CropBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    width: number;
    height: number;
}

/**
 * Calculates the largest box in the source with the target aspect ratio,
 * positioned around normalized focal coordinates (fx, fy in [0, 1]) and clamped.
 */
export function calculateCoverBox(
    srcWidth: number,
    srcHeight: number,
    targetWidth: number,
    targetHeight: number,
    fx: number = 0.5,
    fy: number = 0.5,
): CropBox {
    if (srcWidth <= 0 || srcHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
        throw new Error('Dimensions must be positive numbers');
    }

    const targetAspect = targetWidth / targetHeight;
    const srcAspect = srcWidth / srcHeight;

    let boxW: number;
    let boxH: number;

    if (srcAspect > targetAspect) {
        boxH = srcHeight;
        boxW = Math.round(srcHeight * targetAspect);
    } else {
        boxW = srcWidth;
        boxH = Math.round(srcWidth / targetAspect);
    }

    // Clamp focal center inside image bounds
    const idealX = Math.round(fx * srcWidth - boxW / 2);
    const idealY = Math.round(fy * srcHeight - boxH / 2);

    const x0 = Math.max(0, Math.min(idealX, srcWidth - boxW));
    const y0 = Math.max(0, Math.min(idealY, srcHeight - boxH));

    return {
        x0,
        y0,
        x1: x0 + boxW,
        y1: y0 + boxH,
        width: boxW,
        height: boxH,
    };
}

/**
 * Interface representing a 2D canvas context or test mock with drawImage.
 */
export interface Canvas2DContextLike {
    save(): void;
    restore(): void;
    translate(x: number, y: number): void;
    scale(x: number, y: number): void;
    drawImage(
        image: any,
        sx: number,
        sy: number,
        sw: number,
        sh: number,
        dx: number,
        dy: number,
        dw: number,
        dh: number,
    ): void;
    strokeStyle?: string | any;
    lineWidth?: number;
    strokeRect?(x: number, y: number, w: number, h: number): void;
}

/**
 * Renders an image with OpenCV cv2.BORDER_REFLECT_101 border mirroring.
 *
 * In BORDER_REFLECT_101, the boundary pixel at index 0 or (size - 1) is NOT repeated:
 *   [d, c, b | a, b, c, d | c, b, a]
 * Therefore:
 * - Left reflection samples x in [1 .. bleedPx]
 * - Right reflection samples x in [width - 1 - bleedPx .. width - 1]
 * - Top reflection samples y in [1 .. bleedPx]
 * - Bottom reflection samples y in [height - 1 - bleedPx .. height - 1]
 */
export function drawBleedMirror(
    ctx: Canvas2DContextLike,
    image: any,
    trimWidth: number,
    trimHeight: number,
    bleedPx: number,
): void {
    if (bleedPx <= 0) {
        ctx.drawImage(image, 0, 0, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight);
        return;
    }

    const b = bleedPx;
    const w = trimWidth;
    const h = trimHeight;

    // 1. Center Artwork (Trim Area)
    ctx.drawImage(image, 0, 0, w, h, b, b, w, h);

    // 2. Left Edge Mirror (sample [1 .. b], reflect horizontally)
    ctx.save();
    ctx.translate(b, b);
    ctx.scale(-1, 1);
    ctx.drawImage(image, 1, 0, b, h, 0, 0, b, h);
    ctx.restore();

    // 3. Right Edge Mirror (sample [w - 1 - b .. w - 1], reflect horizontally)
    ctx.save();
    ctx.translate(b + w, b);
    ctx.scale(-1, 1);
    ctx.drawImage(image, w - 1 - b, 0, b, h, -b, 0, b, h);
    ctx.restore();

    // 4. Top Edge Mirror (sample [1 .. b], reflect vertically)
    ctx.save();
    ctx.translate(b, b);
    ctx.scale(1, -1);
    ctx.drawImage(image, 0, 1, w, b, 0, 0, w, b);
    ctx.restore();

    // 5. Bottom Edge Mirror (sample [h - 1 - b .. h - 1], reflect vertically)
    ctx.save();
    ctx.translate(b, b + h);
    ctx.scale(1, -1);
    ctx.drawImage(image, 0, h - 1 - b, w, b, 0, -b, w, b);
    ctx.restore();

    // 6. Top-Left Corner Mirror (sample x in [1 .. b], y in [1 .. b], reflect both axes)
    ctx.save();
    ctx.translate(b, b);
    ctx.scale(-1, -1);
    ctx.drawImage(image, 1, 1, b, b, 0, 0, b, b);
    ctx.restore();

    // 7. Top-Right Corner Mirror (sample x in [w - 1 - b .. w - 1], y in [1 .. b])
    ctx.save();
    ctx.translate(b + w, b);
    ctx.scale(-1, -1);
    ctx.drawImage(image, w - 1 - b, 1, b, b, -b, 0, b, b);
    ctx.restore();

    // 8. Bottom-Left Corner Mirror (sample x in [1 .. b], y in [h - 1 - b .. h - 1])
    ctx.save();
    ctx.translate(b, b + h);
    ctx.scale(-1, -1);
    ctx.drawImage(image, 1, h - 1 - b, b, b, 0, -b, b, b);
    ctx.restore();

    // 9. Bottom-Right Corner Mirror (sample x in [w - 1 - b .. w - 1], y in [h - 1 - b .. h - 1])
    ctx.save();
    ctx.translate(b + w, b + h);
    ctx.scale(-1, -1);
    ctx.drawImage(image, w - 1 - b, h - 1 - b, b, b, -b, -b, b, b);
    ctx.restore();
}

/**
 * Draws proof guide overlays with red trim bounds and green safe zone bounds.
 */
export function drawGuideOverlay(
    ctx: Canvas2DContextLike,
    fullWidth: number,
    fullHeight: number,
    bleedPx: number,
    safePx: number,
): void {
    if (!ctx.strokeRect) return;

    const b = bleedPx;
    const s = safePx;
    const w = fullWidth;
    const h = fullHeight;

    const lw = Math.max(2, Math.round(w / 1000));
    ctx.lineWidth = lw;

    // Red Trim Line (where physical blade cuts)
    ctx.strokeStyle = '#ff3b30';
    ctx.strokeRect(b, b, w - 2 * b, h - 2 * b);

    // Green Safe Zone Line (where essential logos and text must remain inside)
    if (s > 0) {
        ctx.strokeStyle = '#34c759';
        ctx.strokeRect(b + s, b + s, w - 2 * (b + s), h - 2 * (b + s));
    }
}
