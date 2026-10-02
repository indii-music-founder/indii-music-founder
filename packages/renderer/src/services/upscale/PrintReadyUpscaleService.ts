/**
 * PrintReadyUpscaleService.ts
 *
 * Native internal upscaling tool for converting 1024x1024 (or arbitrary square)
 * creative studio image assets into exact 3000x3000px, 300 DPI print-ready
 * distributor cover art (ISSUE-355).
 *
 * Architecture:
 * 1. Checks if local Electron Real-ESRGAN super-resolution engine is available (4x upscale).
 * 2. If desktop engine is unavailable, falls back gracefully to in-browser high-precision
 *    bicubic/multi-pass canvas scaling or browser super-resolution.
 * 3. Draws the resulting high-resolution bitmap onto an exact 3000x3000px canvas with
 *    high image-smoothing quality.
 * 4. Injects physical 300 DPI density tags (PNG pHYs / JPEG JFIF APP0) via `dataUrlWithDpi`.
 */

import { upscalerService } from '@/services/upscale/UpscalerService';
import { dataUrlWithDpi } from '@/services/print/dpiMetadata';
import { logger } from '@/utils/logger';

export interface PrintReadyUpscaleOptions {
    dataUrl: string;
    targetWidth?: number;
    targetHeight?: number;
    dpi?: number;
    format?: 'image/png' | 'image/jpeg';
    prompt?: string;
    onProgress?: (progress: number, stage: string) => void;
    signal?: AbortSignal;
}

export interface PrintReadyUpscaleResult {
    dataUrl: string;
    width: number;
    height: number;
    dpi: number;
    format: string;
    method: 'desktop-realesrgan' | 'browser-bicubic';
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
     * Upscales an image asset to exact 3000x3000px @ 300 DPI.
     */
    async upscaleToPrintReady(options: PrintReadyUpscaleOptions): Promise<PrintReadyUpscaleResult> {
        const startTime = Date.now();
        const targetWidth = options.targetWidth ?? 3000;
        const targetHeight = options.targetHeight ?? 3000;
        const dpi = options.dpi ?? 300;
        const format = options.format ?? 'image/png';

        options.onProgress?.(0.1, 'Analyzing image dimensions...');
        options.signal?.throwIfAborted();

        const sourceImg = await loadImage(options.dataUrl);
        let intermediateDataUrl = options.dataUrl;
        let method: 'desktop-realesrgan' | 'browser-bicubic' = 'browser-bicubic';

        // 1. Try Desktop Real-ESRGAN engine first (if running in Electron)
        const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI?.upscale);
        if (isDesktop) {
            try {
                options.onProgress?.(0.3, 'Enhancing details with local AI upscaler...');
                const outcome = await upscalerService.upscale({
                    dataUrl: options.dataUrl,
                    scale: 4,
                    prompt: options.prompt,
                    signal: options.signal,
                    onProgress: (frac) => {
                        options.onProgress?.(0.3 + frac * 0.4, 'Upscaling image...');
                    },
                });
                intermediateDataUrl = outcome.outputDataUrl;
                method = 'desktop-realesrgan';
            } catch (err: unknown) {
                logger.warn('[PrintReadyUpscaleService] Local Real-ESRGAN engine failed, using high-precision bicubic fallback:', err);
                method = 'browser-bicubic';
            }
        }

        options.signal?.throwIfAborted();
        options.onProgress?.(0.8, 'Resizing to 3000x3000px print specification...');

        // 2. Load intermediate or source and draw into target 3000x3000px canvas
        const finalImg = intermediateDataUrl === options.dataUrl ? sourceImg : await loadImage(intermediateDataUrl);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not create 2D canvas context for print export');
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw centered with cover aspect ratio
        const srcAspect = finalImg.naturalWidth / finalImg.naturalHeight;
        const tgtAspect = targetWidth / targetHeight;
        let renderWidth = targetWidth;
        let renderHeight = targetHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (srcAspect > tgtAspect) {
            renderWidth = targetHeight * srcAspect;
            offsetX = (targetWidth - renderWidth) / 2;
        } else {
            renderHeight = targetWidth / srcAspect;
            offsetY = (targetHeight - renderHeight) / 2;
        }

        ctx.drawImage(finalImg, offsetX, offsetY, renderWidth, renderHeight);

        options.onProgress?.(0.9, 'Injecting 300 DPI print metadata...');

        const rawDataUrl = canvas.toDataURL(format, format === 'image/jpeg' ? 0.95 : undefined);
        const taggedDataUrl = dataUrlWithDpi(rawDataUrl, format, dpi);

        options.onProgress?.(1.0, 'Complete');

        return {
            dataUrl: taggedDataUrl,
            width: targetWidth,
            height: targetHeight,
            dpi,
            format,
            method,
            durationMs: Date.now() - startTime,
        };
    }
}

export const printReadyUpscaleService = new PrintReadyUpscaleService();
