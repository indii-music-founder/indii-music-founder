/**
 * PrintReadyUpscaleService.ts
 *
 * Native internal upscaling tool for converting 1024x1024 (or arbitrary square)
 * creative studio image assets into exact 3000x3000px, 300 DPI print-ready
 * distributor cover art (ISSUE-355).
 *
 * Architecture:
 * 1. Checks if local Electron Real-ESRGAN super-resolution engine is available (4x upscale).
 * 2. Web uses the tiled on-device ESRGAN engine. An engine failure is reported,
 *    never silently replaced by interpolation advertised as AI enlargement.
 * 3. Draws the resulting high-resolution bitmap onto an exact 3000x3000px canvas with
 *    high image-smoothing quality.
 * 4. Injects physical 300 DPI density tags (PNG pHYs / JPEG JFIF APP0) via `dataUrlWithDpi`.
 */

import { upscalerService } from '@/services/upscale/UpscalerService';
import { dataUrlWithDpi } from '@/services/print/dpiMetadata';
import { calculateCoverBox, drawBleedMirror, drawGuideOverlay } from '@indii/shared';
import { planPrintUpscale, type PrintUpscaleMethod } from './printUpscalePlan';

export interface PrintReadyUpscaleOptions {
    dataUrl: string;
    targetWidth?: number;
    targetHeight?: number;
    dpi?: number;
    bleedPx?: number;
    safePx?: number;
    bleedMode?: 'fill' | 'extend';
    focusX?: number;
    focusY?: number;
    generateGuide?: boolean;
    format?: 'image/png' | 'image/jpeg';
    prompt?: string;
    onProgress?: (progress: number, stage: string) => void;
    signal?: AbortSignal;
}

export interface PrintReadyUpscaleResult {
    dataUrl: string;
    guideDataUrl?: string;
    width: number;
    height: number;
    dpi: number;
    format: string;
    method: PrintUpscaleMethod;
    durationMs: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for print upscaling'));
        img.src = src;
    });
}

export class PrintReadyUpscaleService {
    /**
     * Upscales an image asset to exact print specifications @ specified DPI with bleed & safe bounds.
     */
    async upscaleToPrintReady(options: PrintReadyUpscaleOptions): Promise<PrintReadyUpscaleResult> {
        const startTime = Date.now();
        const trimWidth = options.targetWidth ?? 3000;
        const trimHeight = options.targetHeight ?? 3000;
        const dpi = options.dpi ?? 300;
        const bleedPx = options.bleedPx ?? 0;
        const safePx = options.safePx ?? 0;
        const bleedMode = options.bleedMode ?? 'fill';
        const focusX = options.focusX ?? 0.5;
        const focusY = options.focusY ?? 0.5;
        const format = options.format ?? 'image/png';

        const fullWidth = trimWidth + (bleedMode === 'extend' ? 2 * bleedPx : 0);
        const fullHeight = trimHeight + (bleedMode === 'extend' ? 2 * bleedPx : 0);

        options.onProgress?.(0.1, 'Analyzing image dimensions...');
        options.signal?.throwIfAborted();

        // Firebase display URLs can load as images while remaining unreadable to
        // canvas. Resolve and read the owned bytes through the existing storage
        // bridge before either enhancement engine or canvas receives them.
        let sourceDataUrl = options.dataUrl;
        if (!sourceDataUrl.startsWith('data:')) {
            const { resolveStorageUrl } = await import('@/services/storage/resolveStorageUrl');
            const { fetchAsBase64 } = await import('@/services/storage/safeStorageFetch');
            const resolved = await resolveStorageUrl(sourceDataUrl);
            const { base64, mimeType } = await fetchAsBase64(resolved);
            sourceDataUrl = `data:${mimeType};base64,${base64}`;
        }
        options.signal?.throwIfAborted();
        const sourceImg = await loadImage(sourceDataUrl);
        const plan = planPrintUpscale(sourceImg.naturalWidth, sourceImg.naturalHeight, trimWidth, trimHeight);
        if (!Number.isInteger(bleedPx) || bleedPx < 0 || !Number.isInteger(safePx) || safePx < 0 ||
            !Number.isFinite(dpi) || dpi <= 0 || fullWidth * fullHeight > 80_000_000) {
            throw new Error('Print density, margins, or output size is invalid.');
        }
        let intermediateDataUrl = sourceDataUrl;
        let method: PrintUpscaleMethod = 'resize-only';

        // 1. Try Desktop Real-ESRGAN engine first (if running in Electron)
        const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI?.upscale);
        if (plan.scale !== 1) {
            if (isDesktop) {
                options.onProgress?.(0.3, 'Enhancing details with local AI upscaler...');
                const outcome = await upscalerService.upscale({
                    dataUrl: sourceDataUrl,
                    scale: plan.scale,
                    prompt: options.prompt,
                    signal: options.signal,
                    onProgress: (frac) => {
                        options.onProgress?.(0.3 + frac * 0.4, 'Upscaling image...');
                    },
                });
                intermediateDataUrl = outcome.outputDataUrl;
                method = 'desktop-realesrgan';
            } else {
                options.onProgress?.(0.3, 'Enhancing details with on-device browser AI...');
                const { browserUpscale } = await import('./BrowserUpscale');
                const outcome = await browserUpscale({
                    dataUrl: sourceDataUrl,
                    required: { width: plan.width, height: plan.height },
                    signal: options.signal,
                    onProgress: fraction => options.onProgress?.(0.3 + fraction * 0.4, 'Upscaling image...'),
                });
                intermediateDataUrl = outcome.url;
                method = 'browser-esrgan';
            }
        }

        options.signal?.throwIfAborted();
        options.onProgress?.(0.8, 'Resizing to print specifications with bleed geometry...');

        // 2. Load intermediate or source and draw into target canvas
        const finalImg = intermediateDataUrl === sourceDataUrl ? sourceImg : await loadImage(intermediateDataUrl);
        if (finalImg.naturalWidth < trimWidth || finalImg.naturalHeight < trimHeight) {
            throw new Error('The enhancement did not return enough pixels for this print. No print file was produced.');
        }

        // Aspect ratio crop calculation using focal center
        const crop = calculateCoverBox(
            finalImg.naturalWidth,
            finalImg.naturalHeight,
            trimWidth,
            trimHeight,
            focusX,
            focusY,
        );

        // Render trim-sized art
        const trimCanvas = document.createElement('canvas');
        trimCanvas.width = trimWidth;
        trimCanvas.height = trimHeight;
        const trimCtx = trimCanvas.getContext('2d');
        if (!trimCtx) {
            throw new Error('Could not create 2D canvas context for trim rendering');
        }
        trimCtx.imageSmoothingEnabled = true;
        trimCtx.imageSmoothingQuality = 'high';
        trimCtx.drawImage(
            finalImg,
            crop.x0,
            crop.y0,
            crop.width,
            crop.height,
            0,
            0,
            trimWidth,
            trimHeight,
        );

        // Render final canvas with bleed (if extend mode, mirror edges; if fill mode, trim art IS full art)
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = fullWidth;
        outputCanvas.height = fullHeight;
        const outCtx = outputCanvas.getContext('2d');
        if (!outCtx) {
            throw new Error('Could not create 2D canvas context for print export');
        }
        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = 'high';

        if (bleedMode === 'extend' && bleedPx > 0) {
            drawBleedMirror(outCtx, trimCanvas, trimWidth, trimHeight, bleedPx);
        } else {
            outCtx.drawImage(trimCanvas, 0, 0, fullWidth, fullHeight);
        }

        options.onProgress?.(0.9, 'Injecting print DPI metadata...');

        const rawDataUrl = outputCanvas.toDataURL(format, format === 'image/jpeg' ? 0.95 : undefined);
        const taggedDataUrl = dataUrlWithDpi(rawDataUrl, format, dpi);

        // Optional guide overlay rendering
        let guideDataUrl: string | undefined;
        if (options.generateGuide) {
            const guideCanvas = document.createElement('canvas');
            guideCanvas.width = fullWidth;
            guideCanvas.height = fullHeight;
            const guideCtx = guideCanvas.getContext('2d');
            if (guideCtx) {
                guideCtx.drawImage(outputCanvas, 0, 0);
                drawGuideOverlay(guideCtx, fullWidth, fullHeight, bleedPx, safePx);
                guideDataUrl = guideCanvas.toDataURL('image/png');
            }
        }

        options.onProgress?.(1.0, 'Complete');

        return {
            dataUrl: taggedDataUrl,
            guideDataUrl,
            width: fullWidth,
            height: fullHeight,
            dpi,
            format,
            method,
            durationMs: Date.now() - startTime,
        };
    }
}

export const printReadyUpscaleService = new PrintReadyUpscaleService();
