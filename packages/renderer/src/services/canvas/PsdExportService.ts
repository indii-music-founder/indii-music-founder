/**
 * PsdExportService.ts
 *
 * Workstream C3 — PSD export (docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §8).
 *
 * Exports a CanvasDoc to a Photoshop .psd where each raster layer is a
 * flattened raster with its adjustments BAKED (the live adjustment params stay
 * canonical in the CanvasDoc JSON — no PSD adjustment-layer authoring).
 * Text layers are deferred to the TextLayer wiring sub-item (they bake via
 * `rasterizeVectorText` and need the brand font).
 */

import { readPsd, writePsd, type BlendMode, type Layer, type Psd } from 'ag-psd';
import * as fabric from 'fabric';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { adjustmentsToFilters, type CanvasBlendMode, type CanvasDoc, type RasterLayer } from './CanvasDoc';
import { descriptorsToFabricFilters } from './fabricFilters';

export interface RenderedRaster {
    width: number;
    height: number;
    /** RGBA pixel data. */
    data: Uint8ClampedArray;
}

const CANVAS_BLEND_TO_PSD: Record<CanvasBlendMode, BlendMode> = {
    normal: 'normal',
    multiply: 'multiply',
    screen: 'screen',
    overlay: 'overlay',
    'soft-light': 'soft light',
};

export function blendModeToPsd(mode: CanvasBlendMode): BlendMode {
    return CANVAS_BLEND_TO_PSD[mode];
}

/**
 * Render a raster layer to raw RGBA pixels with its adjustments baked. Uses an
 * offscreen Fabric canvas so the baked output matches exactly what the editor
 * shows. gs:// sources resolve to an https URL first.
 */
export async function renderRasterLayer(layer: RasterLayer, scale = 1): Promise<RenderedRaster> {
    const src = await resolveStorageUrl(layer.src);
    const image = await fabric.Image.fromURL(src, { crossOrigin: 'anonymous' });
    const baseW = Math.max(1, image.width ?? 1);
    const baseH = Math.max(1, image.height ?? 1);
    const width = Math.max(1, Math.round(baseW * layer.scaleX * scale));
    const height = Math.max(1, Math.round(baseH * layer.scaleY * scale));

    const el = document.createElement('canvas');
    el.width = width;
    el.height = height;
    const canvas = new fabric.Canvas(el, { width, height, enableRetinaScaling: false });

    image.set({
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        scaleX: width / baseW,
        scaleY: height / baseH,
    });
    image.filters = descriptorsToFabricFilters(adjustmentsToFilters(layer.adjustments));
    image.applyFilters();
    canvas.add(image);
    canvas.renderAll();

    const ctx = el.getContext('2d');
    if (!ctx) {
        canvas.dispose();
        throw new Error('renderRasterLayer: no 2D context available');
    }
    const imageData = ctx.getImageData(0, 0, width, height);
    canvas.dispose();
    return { width, height, data: imageData.data };
}

export interface PsdExportOptions {
    scale?: number;
    /** Injectable for tests; defaults to the Fabric-backed renderer. */
    renderRaster?: (layer: RasterLayer, scale: number) => Promise<RenderedRaster>;
}

/**
 * Assemble and write a PSD. `children` is Photoshop top-to-bottom order, so the
 * bottom-first CanvasDoc layer list is reversed. Raster layers become
 * flattened imageData layers; the background color is carried on the document.
 */
export async function canvasDocToPsd(doc: CanvasDoc, options: PsdExportOptions = {}): Promise<ArrayBuffer> {
    const scale = options.scale ?? 1;
    const renderRaster = options.renderRaster ?? renderRasterLayer;
    const width = Math.max(1, Math.round(doc.width * scale));
    const height = Math.max(1, Math.round(doc.height * scale));

    const children: Layer[] = [];
    for (const layer of [...doc.layers].reverse()) {
        if (layer.kind !== 'raster') continue; // text layers: deferred to TextLayer wiring
        const rendered = await renderRaster(layer, scale);
        children.push({
            name: layer.name,
            left: Math.round(layer.x * scale),
            top: Math.round(layer.y * scale),
            opacity: layer.opacity,
            hidden: !layer.visible,
            blendMode: blendModeToPsd(layer.blendMode),
            imageData: { data: rendered.data, width: rendered.width, height: rendered.height },
        });
    }

    const psd: Psd = {
        width,
        height,
        children,
    };

    return writePsd(psd, { generateThumbnail: false });
}

/** Re-export readPsd for round-trip verification in tests. */
export { readPsd };
