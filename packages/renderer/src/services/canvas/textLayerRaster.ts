/**
 * textLayerRaster.ts
 *
 * Workstream C3 — text-layer rasterization. A TextLayer is rendered to a
 * transparent PNG via the deterministic B1 path (FontLibrary → renderTextPath →
 * rasterizeVectorText), so the editor and PSD export share one bake path and the
 * image model never draws brand letters.
 */

import { FontLibrary } from '@/services/typography/FontLibrary';
import { renderTextPath, rasterizeVectorText } from '@/services/typography/TextVectorRenderer';
import type { TextLayer } from './CanvasDoc';

export interface RenderedRaster {
    width: number;
    height: number;
    /** RGBA pixel data. */
    data: Uint8ClampedArray;
}

/** Rasterize a TextLayer to a transparent PNG data URL at `scale`. */
export async function rasterizeTextLayer(
    layer: TextLayer,
    scale = 1,
): Promise<{ dataUrl: string; width: number; height: number }> {
    const t = layer.typography;
    const font = await FontLibrary.loadOpenTypeFont(t.fontId);
    const vector = renderTextPath(t.text, font, {
        fontSize: t.fontSize,
        x: 0,
        y: t.fontSize,
        letterSpacing: t.letterSpacing,
        kerning: t.kerning,
        align: 'left',
    });
    return rasterizeVectorText(vector, t.fill, scale);
}

/** Rasterize a TextLayer all the way to raw RGBA pixels (for PSD export). */
export async function rasterizeTextLayerToRaster(layer: TextLayer, scale = 1): Promise<RenderedRaster> {
    const { dataUrl } = await rasterizeTextLayer(layer, scale);
    return dataUrlToRaster(dataUrl);
}

/** Decode a data URL into raw RGBA pixels. */
export async function dataUrlToRaster(dataUrl: string): Promise<RenderedRaster> {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('dataUrlToRaster: image failed to load'));
        img.src = dataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('dataUrlToRaster: no 2D context available');
    ctx.drawImage(img, 0, 0);
    return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
}
