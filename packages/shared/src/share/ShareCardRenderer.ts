/**
 * Share card renderer — draws a ShareCardModel to a PNG with Canvas 2D.
 *
 * Canvas (not DOM-to-image) keeps output pixel-identical across browsers and
 * Electron, needs no extra dependency, and never captures app chrome. A
 * cross-origin cover image that taints the canvas is dropped and the card is
 * re-drawn with the signature disc instead, so export never hard-fails.
 */
import {
    FREQUENCY_PALETTE,
    SHARE_CARD_DIMENSIONS,
    type ShareCardModel,
    type ShareCardSize,
} from './shareCardTemplates';

const FONT_STACK = '"Inter", "SF Pro Display", system-ui, -apple-system, "Segoe UI", sans-serif';

interface Box { x: number; y: number; w: number; h: number }

interface Layout {
    art: Box;
    text: Box;
    align: CanvasTextAlign;
    titleSize: number;
    bodySize: number;
    maxTitleLines: number;
}

function layoutFor(size: ShareCardSize): Layout {
    const { width: W, height: H } = SHARE_CARD_DIMENSIONS[size];
    if (size === 'og') {
        const art = 470;
        return {
            art: { x: 64, y: (H - art) / 2, w: art, h: art },
            text: { x: 64 + art + 56, y: 96, w: W - (64 + art + 56) - 64, h: H - 192 },
            align: 'left',
            titleSize: 64,
            bodySize: 30,
            maxTitleLines: 3,
        };
    }
    if (size === 'square') {
        const art = 520;
        return {
            art: { x: (W - art) / 2, y: 120, w: art, h: art },
            text: { x: 80, y: 120 + art + 64, w: W - 160, h: H - (120 + art + 64) - 120 },
            align: 'center',
            titleSize: 72,
            bodySize: 34,
            maxTitleLines: 2,
        };
    }
    const art = 820;
    return {
        art: { x: (W - art) / 2, y: 300, w: art, h: art },
        text: { x: 90, y: 300 + art + 96, w: W - 180, h: H - (300 + art + 96) - 200 },
        align: 'center',
        titleSize: 96,
        bodySize: 44,
        maxTitleLines: 3,
    };
}

/** Greedy word wrap; the last allowed line is ellipsized. Exported for tests. */
export function wrapText(
    measure: (text: string) => number,
    text: string,
    maxWidth: number,
    maxLines: number,
): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (let i = 0; i < words.length; i++) {
        const candidate = current ? `${current} ${words[i]}` : words[i];
        if (measure(candidate) <= maxWidth || !current) {
            current = candidate;
            continue;
        }
        if (lines.length === maxLines - 1) {
            // Last allowed line: keep the overflow so it is ellipsized below.
            current = `${current} ${words.slice(i).join(' ')}`;
            break;
        }
        lines.push(current);
        current = words[i];
    }
    if (current) lines.push(current);
    const last = lines.length - 1;
    if (last >= 0 && measure(lines[last]) > maxWidth) {
        let truncated = lines[last];
        while (truncated.length > 1 && measure(`${truncated}…`) > maxWidth) {
            truncated = truncated.slice(0, -1).trimEnd();
        }
        lines[last] = `${truncated}…`;
    }
    return lines.slice(0, maxLines);
}

function roundedRect(ctx: CanvasRenderingContext2D, { x, y, w, h }: Box, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, model: ShareCardModel) {
    ctx.fillStyle = FREQUENCY_PALETTE.void;
    ctx.fillRect(0, 0, W, H);
    const glow = (x: number, y: number, r: number, color: string) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `${color}99`);
        g.addColorStop(1, `${color}00`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    };
    glow(W * 0.1, H * 0.08, Math.max(W, H) * 0.7, model.accentFrom);
    glow(W * 0.95, H * 0.95, Math.max(W, H) * 0.65, model.accentTo);
    // Signature "frequency" scanlines.
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 1);
}

function drawDisc(ctx: CanvasRenderingContext2D, box: Box, model: ShareCardModel) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const r = box.w / 2;
    const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    g.addColorStop(0, model.accentFrom);
    g.addColorStop(1, model.accentTo);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(3,3,3,0.35)';
    ctx.lineWidth = Math.max(1, r / 160);
    for (let ring = r * 0.92; ring > r * 0.3; ring -= r / 28) {
        ctx.beginPath();
        ctx.arc(cx, cy, ring, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.fillStyle = FREQUENCY_PALETTE.void;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
}

function drawArt(ctx: CanvasRenderingContext2D, box: Box, model: ShareCardModel, cover: CanvasImageSource | null) {
    if (!cover) {
        drawDisc(ctx, box, model);
        return;
    }
    ctx.save();
    ctx.shadowColor = `${model.accentTo}88`;
    ctx.shadowBlur = box.w * 0.12;
    roundedRect(ctx, box, box.w * 0.04);
    ctx.fillStyle = FREQUENCY_PALETTE.void;
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundedRect(ctx, box, box.w * 0.04);
    ctx.clip();
    ctx.drawImage(cover, box.x, box.y, box.w, box.h);
    ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, layout: Layout, model: ShareCardModel, W: number, H: number) {
    const { text, align, titleSize, bodySize } = layout;
    const anchorX = align === 'center' ? text.x + text.w / 2 : text.x;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    let y = text.y;

    // Eyebrow pill
    ctx.font = `700 ${Math.round(bodySize * 0.72)}px ${FONT_STACK}`;
    const eyebrow = model.eyebrow.toUpperCase();
    const pillW = ctx.measureText(eyebrow).width + bodySize * 1.2;
    const pillH = bodySize * 1.3;
    const pillX = align === 'center' ? anchorX - pillW / 2 : anchorX;
    roundedRect(ctx, { x: pillX, y, w: pillW, h: pillH }, pillH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.fillStyle = FREQUENCY_PALETTE.electricBlue;
    ctx.textAlign = 'center';
    ctx.fillText(eyebrow, pillX + pillW / 2, y + (pillH - bodySize * 0.72) / 2);
    ctx.textAlign = align;
    y += pillH + bodySize * 0.8;

    const fittedTitleSize = model.compactTitle ? Math.round(titleSize * 0.78) : titleSize;
    const titleLines = model.compactTitle ? layout.maxTitleLines + 1 : layout.maxTitleLines;
    ctx.font = `800 ${fittedTitleSize}px ${FONT_STACK}`;
    ctx.fillStyle = FREQUENCY_PALETTE.signalWhite;
    for (const line of wrapText(t => ctx.measureText(t).width, model.title, text.w, titleLines)) {
        ctx.fillText(line, anchorX, y);
        y += fittedTitleSize * 1.08;
    }

    if (model.subtitle) {
        y += bodySize * 0.3;
        ctx.font = `500 ${bodySize}px ${FONT_STACK}`;
        ctx.fillStyle = 'rgba(240,240,240,0.78)';
        const subtitleLines = wrapText(t => ctx.measureText(t).width, model.subtitle, text.w, model.compactTitle ? 2 : 1);
        for (const line of subtitleLines) {
            ctx.fillText(line, anchorX, y);
            y += bodySize * 1.25;
        }
        y += bodySize * 0.2;
    }

    if (model.callout) {
        y += bodySize * 0.2;
        ctx.font = `700 ${bodySize}px ${FONT_STACK}`;
        ctx.fillStyle = model.accentTo;
        ctx.fillText(wrapText(t => ctx.measureText(t).width, model.callout, text.w, 1)[0], anchorX, y);
        y += bodySize * 1.4;
    }

    if (model.url) {
        ctx.font = `600 ${Math.round(bodySize * 0.8)}px ${FONT_STACK}`;
        ctx.fillStyle = FREQUENCY_PALETTE.signalWhite;
        ctx.fillText(wrapText(t => ctx.measureText(t).width, model.url, text.w, 1)[0], anchorX, y + bodySize * 0.2);
    }

    if (model.attribution) {
        ctx.font = `600 ${Math.round(bodySize * 0.6)}px ${FONT_STACK}`;
        ctx.fillStyle = 'rgba(240,240,240,0.55)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(model.attribution, W / 2, H - bodySize * 1.2);
    }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Share card export produced no image'))), 'image/png');
        } catch (error) {
            reject(error);
        }
    });
}

function paint(size: ShareCardSize, model: ShareCardModel, cover: CanvasImageSource | null): HTMLCanvasElement {
    const { width: W, height: H } = SHARE_CARD_DIMENSIONS[size];
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable on this device');
    const layout = layoutFor(size);
    drawBackground(ctx, W, H, model);
    drawArt(ctx, layout.art, model, cover);
    drawText(ctx, layout, model, W, H);
    return canvas;
}

export interface RenderedShareCard {
    blob: Blob;
    /** True when the cover could not be embedded (missing, failed, or cross-origin). */
    coverOmitted: boolean;
}

export async function renderShareCard(model: ShareCardModel, size: ShareCardSize): Promise<RenderedShareCard> {
    if (typeof document !== 'undefined' && 'fonts' in document) {
        try { await document.fonts.ready; } catch { /* fonts are best-effort */ }
    }
    const cover = model.coverArtUrl ? await loadImage(model.coverArtUrl) : null;
    if (cover) {
        try {
            return { blob: await canvasToBlob(paint(size, model, cover)), coverOmitted: false };
        } catch (error) {
            // A tainted canvas throws SecurityError; anything else is a real failure.
            if ((error as DOMException)?.name !== 'SecurityError') throw error;
        }
    }
    return { blob: await canvasToBlob(paint(size, model, null)), coverOmitted: Boolean(model.coverArtUrl) };
}
