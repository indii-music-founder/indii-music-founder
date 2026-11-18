/**
 * Electron Studio Snapshot service.
 *
 * Captures the active Electron BrowserWindow via IPC, composites it onto a
 * Frequency Void (#030303) frame with subtle glow and `made with indii · indii.music`
 * footer, and shares or downloads the resulting PNG.
 */

import { FREQUENCY_PALETTE, SHARE_ATTRIBUTION } from '@shared/share/shareCardTemplates';
import { shareOrDownloadImage, type ShareFileOutcome } from '@shared/share/shareFile';

export interface SnapshotOptions {
    fileName?: string;
    title?: string;
}

/**
 * Returns true only inside Electron where `window.electronAPI.captureSnapshot` is exposed.
 * Always returns false on web so no fake snapshot control is rendered.
 */
export function canCaptureSnapshot(): boolean {
    return typeof window !== 'undefined' && typeof window.electronAPI?.captureSnapshot === 'function';
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load captured snapshot image.'));
        img.src = dataUrl;
    });
}

function drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

/**
 * Composites a captured screenshot data URL onto a framed #030303 Void canvas
 * with subtle Frequency glow and `made with indii · indii.music` footer.
 */
export async function compositeSnapshotBlob(dataUrl: string): Promise<Blob> {
    if (typeof document === 'undefined') {
        throw new Error('Snapshot compositing requires a browser document.');
    }

    const img = await loadImageFromDataUrl(dataUrl);
    const imgWidth = Math.max(img.naturalWidth || img.width || 1280, 1);
    const imgHeight = Math.max(img.naturalHeight || img.height || 800, 1);

    const sidePadding = 48;
    const topPadding = 44;
    const footerHeight = 76;
    const totalWidth = imgWidth + sidePadding * 2;
    const totalHeight = imgHeight + topPadding + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = totalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas 2D context unavailable.');
    }

    // Void background
    ctx.fillStyle = FREQUENCY_PALETTE.void;
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Subtle Frequency corner glows
    if (typeof ctx.createRadialGradient === 'function') {
        const topGlow = ctx.createRadialGradient(
            totalWidth * 0.25,
            topPadding,
            10,
            totalWidth * 0.25,
            topPadding,
            totalWidth * 0.6,
        );
        topGlow.addColorStop(0, 'rgba(46, 46, 254, 0.22)');
        topGlow.addColorStop(1, 'rgba(3, 3, 3, 0)');
        ctx.fillStyle = topGlow;
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        const bottomGlow = ctx.createRadialGradient(
            totalWidth * 0.8,
            totalHeight - footerHeight,
            10,
            totalWidth * 0.8,
            totalHeight - footerHeight,
            totalWidth * 0.5,
        );
        bottomGlow.addColorStop(0, 'rgba(254, 46, 154, 0.16)');
        bottomGlow.addColorStop(1, 'rgba(3, 3, 3, 0)');
        ctx.fillStyle = bottomGlow;
        ctx.fillRect(0, 0, totalWidth, totalHeight);
    }

    // Framed screenshot
    ctx.save();
    drawRoundedRectPath(ctx, sidePadding, topPadding, imgWidth, imgHeight, 16);
    ctx.clip();
    ctx.drawImage(img, sidePadding, topPadding, imgWidth, imgHeight);
    ctx.restore();

    // Hairline border around the captured studio frame
    ctx.save();
    drawRoundedRectPath(ctx, sidePadding, topPadding, imgWidth, imgHeight, 16);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Attribution footer
    ctx.fillStyle = 'rgba(240, 240, 240, 0.72)';
    ctx.font = '600 18px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SHARE_ATTRIBUTION, totalWidth / 2, topPadding + imgHeight + footerHeight / 2);

    return new Promise<Blob>((resolve, reject) => {
        if (typeof canvas.toBlob !== 'function') {
            reject(new Error('Canvas.toBlob is unavailable.'));
            return;
        }
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Failed to encode snapshot PNG.'));
                return;
            }
            resolve(blob);
        }, 'image/png');
    });
}

/**
 * Captures the Electron studio window, frames it, and hands the PNG to
 * `shareOrDownloadImage`. Returns `'unavailable'` outside Electron.
 */
export async function captureAndShareSnapshot(
    options: SnapshotOptions = {},
): Promise<ShareFileOutcome | 'unavailable'> {
    if (!canCaptureSnapshot()) {
        return 'unavailable';
    }

    const captureFn = window.electronAPI?.captureSnapshot;
    if (!captureFn) {
        return 'unavailable';
    }

    const captured = await captureFn();
    if (!captured?.dataUrl) {
        return 'unavailable';
    }

    const blob = await compositeSnapshotBlob(captured.dataUrl);
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = options.fileName ?? `indii-studio-${stamp}.png`;
    return shareOrDownloadImage(blob, fileName, {
        title: options.title ?? 'indii.music Studio Snapshot',
        text: SHARE_ATTRIBUTION,
    });
}
