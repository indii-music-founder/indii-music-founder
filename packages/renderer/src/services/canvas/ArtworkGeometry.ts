import type { CanvasDoc, CanvasLayer } from './CanvasDoc';

export const MAX_VIEWPORT_PROXY = 1024;

export function getViewportProxy(width: number, height: number): { proxyWidth: number; proxyHeight: number; proxyScale: number } {
    const maxDim = Math.max(width, height);
    const proxyScale = maxDim > MAX_VIEWPORT_PROXY ? MAX_VIEWPORT_PROXY / maxDim : 1;
    return {
        proxyWidth: Math.round(width * proxyScale),
        proxyHeight: Math.round(height * proxyScale),
        proxyScale
    };
}

export function artworkTransform(layer: CanvasLayer, sourceWidth: number, sourceHeight: number, doc: CanvasDoc) {
    if (layer.kind === 'raster' && layer.framing) {
        const scale = (layer.framing === 'fill' ? Math.max : Math.min)(doc.width / sourceWidth, doc.height / sourceHeight);
        return { x: (doc.width - sourceWidth * scale) / 2, y: (doc.height - sourceHeight * scale) / 2, scaleX: scale, scaleY: scale, rotation: 0 };
    }
    const angle = layer.rotation * Math.PI / 180;
    const centered = layer.transformAnchor === 'center';
    const dx = centered ? sourceWidth * layer.scaleX / 2 : 0, dy = centered ? sourceHeight * layer.scaleY / 2 : 0;
    return { x: layer.x - dx * Math.cos(angle) + dy * Math.sin(angle), y: layer.y - dx * Math.sin(angle) - dy * Math.cos(angle), scaleX: layer.scaleX, scaleY: layer.scaleY, rotation: layer.rotation };
}

/** Effective source-pixel enlargement, including fit/fill and reflected transforms. */
export function artworkEnlargement(layer: CanvasLayer, sourceWidth: number, sourceHeight: number, doc: CanvasDoc, exportScale: number): number {
    const t = artworkTransform(layer, sourceWidth, sourceHeight, doc);
    return Math.max(Math.abs(t.scaleX), Math.abs(t.scaleY)) * exportScale;
}
export interface ArtworkBounds { x: number; y: number; width: number; height: number }

/** Source-pixel bounds of visible content; transparent padding is excluded. */
export function artworkAlphaBounds(pixels: Uint8ClampedArray, width: number, height: number): ArtworkBounds | null {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || pixels.length !== width * height * 4) {
        throw new Error('Photo pixel dimensions are invalid');
    }
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) {
        let first = 0;
        while (first < width && !pixels[(y * width + first) * 4 + 3]) first++;
        if (first === width) continue;
        let last = width - 1;
        while (last > first && !pixels[(y * width + last) * 4 + 3]) last--;
        left = Math.min(left, first); right = Math.max(right, last);
        top = Math.min(top, y); bottom = y;
    }
    return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Position the visible photo bounds at the center of the cover. */
export function centeredArtworkPosition(width: number, height: number, scaleX: number, scaleY: number, rotation: number, doc: Pick<CanvasDoc, 'width' | 'height'>, bounds: ArtworkBounds = { x: 0, y: 0, width, height }) {
    const angle = rotation * Math.PI / 180;
    const dx = (bounds.x + bounds.width / 2) * scaleX, dy = (bounds.y + bounds.height / 2) * scaleY;
    return { x: doc.width / 2 - dx * Math.cos(angle) + dy * Math.sin(angle), y: doc.height / 2 - dx * Math.sin(angle) - dy * Math.cos(angle) };
}
/** Align visible transformed bounds horizontally without moving the vertical origin. */
export function alignedArtworkPosition(layer: CanvasLayer, width: number, height: number, doc: CanvasDoc, align: 'left' | 'center' | 'right') {
    const t = artworkTransform(layer, width, height, doc);
    const angle = t.rotation * Math.PI / 180;
    const horizontal = width * t.scaleX * Math.cos(angle);
    const vertical = -height * t.scaleY * Math.sin(angle);
    const min = Math.min(0, horizontal, vertical, horizontal + vertical);
    const max = Math.max(0, horizontal, vertical, horizontal + vertical);
    const left = align === 'left' ? 0 : align === 'center' ? (doc.width - (max - min)) / 2 : doc.width - (max - min);
    return { transformAnchor: 'top-left' as const, x: left - min, y: t.y };
}

/** Validate every export format before loading layers or allocating output pixels. */
export function artworkExportDimensions(doc: Pick<CanvasDoc, 'width' | 'height'>, scale = 1): { width: number; height: number } {
    const width = Math.round(doc.width * scale), height = Math.round(doc.height * scale);
    if (!Number.isFinite(scale) || scale <= 0 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
        throw new Error('Export dimensions are invalid');
    }
    if (width * height > 36_000_000) throw new Error('Export dimensions exceed the 36-megapixel limit. Choose a smaller size or export scale.');
    return { width, height };
}
