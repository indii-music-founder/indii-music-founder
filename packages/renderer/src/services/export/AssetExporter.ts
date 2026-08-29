/**
 * AssetExporter.ts
 *
 * Headless multi-platform asset exporter (Workstream G1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §12).
 *
 * Takes a master image URL and a set of ExportPresets, renders each platform
 * dimension from the single PLATFORM_DIMENSIONS registry (A-7 — never a
 * parallel list), and returns per-platform results. Optionally bundles the
 * results into a downloadable zip (jszip, already a renderer dependency).
 *
 * HARD RULE (G1.4): this service must NEVER import Fabric. It uses raw
 * offscreen canvas 2D contexts only.
 */

import { PLATFORM_DIMENSIONS } from '@/services/image/CanvasBatchService';
import {
    computeCrop,
    isExtremeAspectChange,
    type CropAnchor
} from '@/services/export/SmartCrop';
import { logger } from '@/utils/logger';

export type FitMode = 'cover' | 'contain-blur-pad';

export interface ExportPreset {
    /** Must match a `PLATFORM_DIMENSIONS` row id. */
    dimensionId: string;
    fit?: FitMode;
    /** Optional crop anchors (face/logo/manual) used for 'cover' fit. */
    anchors?: CropAnchor[];
}

export interface ExportBundleRequest {
    masterUrl: string;
    presets: ExportPreset[];
    /** JPEG/WebP quality 0..1 for lossy formats; PNG ignores it. */
    quality?: number;
    format?: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface ExportResult {
    platformId: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
    fit: FitMode;
}

/** A loaded master image, abstracted so tests can inject a mock drawable. */
export interface MasterImage {
    width: number;
    height: number;
    /** Draw the full image into the destination rect. */
    draw(ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number): void;
    /** Draw a source-rect region of the image into the destination rect. */
    drawRegion(
        ctx: CanvasRenderingContext2D,
        sx: number, sy: number, sw: number, sh: number,
        dx: number, dy: number, dw: number, dh: number
    ): void;
}

/** Minimal canvas contract — lets tests inject a mock without Fabric or a jsdom canvas backend. */
export interface ExportCanvas {
    width: number;
    height: number;
    getContext(kind: '2d'): CanvasRenderingContext2D | null;
    toDataURL(format: string, quality?: number): string;
}

export interface ExportHost {
    createCanvas(width: number, height: number): ExportCanvas;
    loadImage(url: string): Promise<MasterImage>;
    /** Resolve a data URL to its byte length. */
    byteLength(dataUrl: string): number;
}

/** Default browser host: offscreen canvas + HTMLImageElement. */
function defaultHost(): ExportHost {
    return {
        createCanvas(width, height) {
            const c = document.createElement('canvas');
            c.width = width;
            c.height = height;
            return c;
        },
        loadImage(url) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    draw(ctx, dx, dy, dw, dh) { ctx.drawImage(img, dx, dy, dw, dh); },
                    drawRegion(ctx, sx, sy, sw, sh, dx, dy, dw, dh) {
                        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
                    }
                });
                img.onerror = () => reject(new Error(`AssetExporter: failed to load master image from ${url}`));
                img.src = url;
            });
        },
        byteLength(dataUrl) {
            const b64 = dataUrl.split(',')[1] ?? '';
            const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
            return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
        }
    };
}

export const DEFAULT_CORE_MATRIX_IDS = [
    'spotify_cover',
    'ig_story',
    'landscape',
    'x_post',
    'facebook_og'
];

export function resolveFit(
    preset: ExportPreset,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number
): FitMode {
    if (preset.fit) return preset.fit;
    // Plan §12 fit rules: contain-blur-pad is DEFAULT for aspect changes > 1.6×
    // so artwork is never destroyed by cropping.
    return isExtremeAspectChange(srcW, srcH, dstW, dstH) ? 'contain-blur-pad' : 'cover';
}

/**
 * Render one preset onto the given 2D context. Exported for testing (G1.3).
 */
export function renderPreset(
    ctx: CanvasRenderingContext2D,
    canvas: { width: number; height: number },
    image: MasterImage,
    fit: FitMode,
    anchors?: CropAnchor[]
): void {
    const { width: dstW, height: dstH } = canvas;

    if (fit === 'contain-blur-pad') {
        // Backdrop: the master itself, cover-scaled so it fully fills the
        // frame, heavily blurred — the classic "blurred self-fill" pad.
        const backdropScale = Math.max(dstW / image.width, dstH / image.height);
        const bw = image.width * backdropScale;
        const bh = image.height * backdropScale;
        ctx.save();
        ctx.filter = 'blur(32px)';
        image.draw(ctx, (dstW - bw) / 2, (dstH - bh) / 2, bw, bh);
        ctx.restore();

        // Foreground: the complete artwork, contained, centered — nothing cropped.
        const containScale = Math.min(dstW / image.width, dstH / image.height);
        const fw = image.width * containScale;
        const fh = image.height * containScale;
        image.draw(ctx, (dstW - fw) / 2, (dstH - fh) / 2, fw, fh);
        return;
    }

    // cover: crop the source (face-anchored when anchors exist), fill the frame.
    const crop = computeCrop(image.width, image.height, dstW, dstH, anchors);
    const sw = dstW / crop.scale;
    const sh = dstH / crop.scale;
    image.drawRegion(ctx, crop.x, crop.y, sw, sh, 0, 0, dstW, dstH);
}

/**
 * Export a master asset into every preset dimension.
 */
export async function exportMasterAsset(
    req: ExportBundleRequest,
    host: ExportHost = defaultHost()
): Promise<ExportResult[]> {
    if (!req.masterUrl) throw new Error('AssetExporter: masterUrl is required');
    if (!req.presets || req.presets.length === 0) throw new Error('AssetExporter: at least one preset is required');

    const image = await host.loadImage(req.masterUrl);
    const format = req.format ?? 'image/png';
    const results: ExportResult[] = [];

    for (const preset of req.presets) {
        const dim = PLATFORM_DIMENSIONS.find(d => d.id === preset.dimensionId);
        if (!dim) {
            logger.warn(`[AssetExporter] Unknown dimensionId "${preset.dimensionId}" — skipped. Known: ${PLATFORM_DIMENSIONS.map(d => d.id).join(', ')}`);
            continue;
        }

        const canvas = host.createCanvas(dim.width, dim.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error(`AssetExporter: could not acquire 2D context for ${dim.id}`);

        const fit = resolveFit(preset, image.width, image.height, dim.width, dim.height);
        renderPreset(ctx, canvas, image, fit, preset.anchors);

        const url = canvas.toDataURL(format, req.quality);
        results.push({
            platformId: dim.id,
            url,
            width: dim.width,
            height: dim.height,
            bytes: host.byteLength(url),
            fit
        });
    }

    if (results.length === 0) {
        throw new Error('AssetExporter: no presets matched a known platform dimension');
    }

    logger.info(`[AssetExporter] Exported ${results.length} platform assets from master ${image.width}x${image.height}`);
    return results;
}

/**
 * Bundle export results into a downloadable zip. Uses jszip (existing renderer dep).
 */
export async function downloadAsZip(results: ExportResult[], name: string): Promise<void> {
    if (results.length === 0) throw new Error('AssetExporter.downloadAsZip: nothing to bundle');

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const used = new Set<string>();

    for (const r of results) {
        let filename = `${r.platformId}_${r.width}x${r.height}.png`;
        let n = 2;
        while (used.has(filename)) filename = `${r.platformId}_${r.width}x${r.height}_${n++}.png`;
        used.add(filename);

        const commaIdx = r.url.indexOf(',');
        const b64 = commaIdx >= 0 ? r.url.slice(commaIdx + 1) : r.url;
        zip.file(filename, b64, { base64: true });
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const href = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = href;
        a.download = name.endsWith('.zip') ? name : `${name}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        URL.revokeObjectURL(href);
    }
}
