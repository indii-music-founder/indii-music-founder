/**
 * Share card renderer — draws a ShareCardModel to a PNG with Canvas 2D.
 *
 * Canvas (not DOM-to-image) keeps output pixel-identical across browsers and
 * Electron, needs no extra dependency, and never captures app chrome. A
 * cross-origin cover image that taints the canvas is dropped and the card is
 * re-drawn with the signature disc instead, so export never hard-fails.
 */
import { INDII_BRAND } from '../brand';
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

    // Soft ambient halo beneath the vinyl disc
    ctx.save();
    ctx.shadowColor = `${model.accentFrom}77`;
    ctx.shadowBlur = r * 0.28;
    const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    g.addColorStop(0, model.accentFrom);
    g.addColorStop(1, model.accentTo);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Clip inner disc details cleanly inside the vinyl perimeter
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Subtle dark vinyl depth vignette toward rim
    const rimShade = ctx.createRadialGradient(cx, cy, r * 0.28, cx, cy, r);
    rimShade.addColorStop(0, 'rgba(0,0,0,0)');
    rimShade.addColorStop(0.82, 'rgba(0,0,0,0.16)');
    rimShade.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = rimShade;
    ctx.fillRect(box.x, box.y, box.w, box.h);

    // Pressed micro-grooves
    ctx.strokeStyle = 'rgba(3,3,3,0.34)';
    ctx.lineWidth = Math.max(1, r / 150);
    for (let ring = r * 0.94; ring > r * 0.34; ring -= r / 30) {
        ctx.beginPath();
        ctx.arc(cx, cy, ring, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Diagonal specular light sheen across the pressed grooves
    const sheen = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.42, 'rgba(255,255,255,0.22)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.04)');
    sheen.addColorStop(0.58, 'rgba(255,255,255,0.16)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(box.x, box.y, box.w, box.h);

    // Inner center label ring + crisp metallic highlight border
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(3,3,3,0.28)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = Math.max(1.5, r / 120);
    ctx.stroke();

    // Rim specular hairline
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Spindle hole
    ctx.fillStyle = FREQUENCY_PALETTE.void;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.115, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

/** Center-crops a source image to fill a target box without stretching (object-fit: cover). Exported for tests. */
export function computeCoverCrop(srcW: number, srcH: number, dstW: number, dstH: number): Box {
    if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
        return { x: 0, y: 0, w: Math.max(srcW, 0), h: Math.max(srcH, 0) };
    }
    const srcRatio = srcW / srcH;
    const dstRatio = dstW / dstH;
    if (srcRatio > dstRatio) {
        const cropW = srcH * dstRatio;
        return { x: (srcW - cropW) / 2, y: 0, w: cropW, h: srcH };
    }
    const cropH = srcW / dstRatio;
    return { x: 0, y: (srcH - cropH) / 2, w: srcW, h: cropH };
}

function drawArt(ctx: CanvasRenderingContext2D, box: Box, model: ShareCardModel, cover: HTMLImageElement | null) {
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
    const srcW = cover.naturalWidth || cover.width;
    const srcH = cover.naturalHeight || cover.height;
    if (srcW > 0 && srcH > 0) {
        const crop = computeCoverCrop(srcW, srcH, box.w, box.h);
        ctx.drawImage(cover, crop.x, crop.y, crop.w, crop.h, box.x, box.y, box.w, box.h);
    } else {
        ctx.drawImage(cover, box.x, box.y, box.w, box.h);
    }
    ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, layout: Layout, model: ShareCardModel, W: number, H: number, size: ShareCardSize) {
    const { text, align, titleSize, bodySize } = layout;
    const anchorX = align === 'center' ? text.x + text.w / 2 : text.x;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';

    // Pre-measure lines so horizontal OG cards center their text stack cleanly beside the artwork
    const eyebrowFontSize = Math.round(bodySize * 0.72);
    ctx.font = `700 ${eyebrowFontSize}px ${FONT_STACK}`;
    const pillPad = bodySize * 1.2;
    const eyebrowText = wrapText(t => ctx.measureText(t).width, model.eyebrow.toUpperCase(), Math.max(text.w - pillPad, 80), 1)[0] ?? '';
    const pillW = Math.min(ctx.measureText(eyebrowText).width + pillPad, text.w);
    const pillH = bodySize * 1.3;

    const fittedTitleSize = model.compactTitle ? Math.round(titleSize * 0.78) : titleSize;
    const maxTitleLines = model.compactTitle ? layout.maxTitleLines + 1 : layout.maxTitleLines;
    ctx.font = `800 ${fittedTitleSize}px ${FONT_STACK}`;
    const wrappedTitle = wrapText(t => ctx.measureText(t).width, model.title, text.w, maxTitleLines);

    ctx.font = `500 ${bodySize}px ${FONT_STACK}`;
    const wrappedSubtitle = model.subtitle
        ? wrapText(t => ctx.measureText(t).width, model.subtitle, text.w, model.compactTitle ? 2 : 1)
        : [];

    ctx.font = `700 ${bodySize}px ${FONT_STACK}`;
    const calloutLine = model.callout ? wrapText(t => ctx.measureText(t).width, model.callout, text.w, 1)[0] : undefined;

    const urlFontSize = Math.round(bodySize * 0.8);
    ctx.font = `600 ${urlFontSize}px ${FONT_STACK}`;
    const urlLine = model.url ? wrapText(t => ctx.measureText(t).width, model.url, text.w, 1)[0] : undefined;

    const totalTextH =
        pillH +
        bodySize * 0.8 +
        wrappedTitle.length * (fittedTitleSize * 1.08) +
        (wrappedSubtitle.length > 0 ? bodySize * 0.3 + wrappedSubtitle.length * (bodySize * 1.25) + bodySize * 0.2 : 0) +
        (calloutLine ? bodySize * 0.2 + bodySize * 1.4 : 0) +
        (urlLine ? bodySize * 0.2 + urlFontSize : 0);

    let y = size === 'og' ? text.y + Math.max(0, (text.h - totalTextH) / 2) : text.y;

    // Eyebrow pill with subtle glass stroke
    ctx.font = `700 ${eyebrowFontSize}px ${FONT_STACK}`;
    const pillX = align === 'center' ? anchorX - pillW / 2 : anchorX;
    roundedRect(ctx, { x: pillX, y, w: pillW, h: pillH }, pillH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.fillStyle = FREQUENCY_PALETTE.electricBlue;
    ctx.textAlign = 'center';
    ctx.fillText(eyebrowText, pillX + pillW / 2, y + (pillH - eyebrowFontSize) / 2);
    ctx.textAlign = align;
    y += pillH + bodySize * 0.8;

    ctx.font = `800 ${fittedTitleSize}px ${FONT_STACK}`;
    ctx.fillStyle = FREQUENCY_PALETTE.signalWhite;
    for (const line of wrappedTitle) {
        ctx.fillText(line, anchorX, y);
        y += fittedTitleSize * 1.08;
    }

    if (wrappedSubtitle.length > 0) {
        y += bodySize * 0.3;
        ctx.font = `500 ${bodySize}px ${FONT_STACK}`;
        ctx.fillStyle = 'rgba(240,240,240,0.82)';
        for (const line of wrappedSubtitle) {
            ctx.fillText(line, anchorX, y);
            y += bodySize * 1.25;
        }
        y += bodySize * 0.2;
    }

    if (calloutLine) {
        y += bodySize * 0.2;
        ctx.font = `700 ${bodySize}px ${FONT_STACK}`;
        ctx.fillStyle = model.accentTo;
        ctx.fillText(calloutLine, anchorX, y);
        y += bodySize * 1.4;
    }

    if (urlLine) {
        ctx.font = `600 ${urlFontSize}px ${FONT_STACK}`;
        ctx.fillStyle = FREQUENCY_PALETTE.signalWhite;
        ctx.fillText(urlLine, anchorX, y + bodySize * 0.2);
    }

    if (model.attribution) {
        ctx.font = `600 ${Math.round(bodySize * 0.6)}px ${FONT_STACK}`;
        ctx.fillStyle = 'rgba(240,240,240,0.58)';
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

/** Type-led campaign posters follow the landing page's amber question and black field. */
function drawCampaignPoster(ctx: CanvasRenderingContext2D, model: ShareCardModel, lead: string, W: number, H: number) {
    const landscape = W > H;
    const margin = Math.round(W * 0.06);
    const width = W - 2 * margin;
    const amber = '#FFB800';
    const paper = '#F5F3EE';
    ctx.fillStyle = '#10100F';
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'top';

    function line(text: string, y: number, size: number, weight: number, color: string) {
        ctx.font = `${weight} ${size}px ${FONT_STACK}`;
        ctx.fillStyle = color;
        ctx.fillText(text, margin, y);
    }

    function paragraph(text: string, y: number, size: number, weight: number, color: string, maxLines: number) {
        ctx.font = `${weight} ${size}px ${FONT_STACK}`;
        for (const row of wrapText(t => ctx.measureText(t).width, text, width, maxLines)) {
            line(row, y, size, weight, color);
            y += size * 1.13;
        }
        return y;
    }

    const labelSize = landscape ? 20 : 28;
    const top = landscape ? 36 : Math.round(H * 0.07);
    line(INDII_BRAND.name, top, landscape ? 36 : 48, 850, paper);
    ctx.font = `600 ${labelSize}px monospace`;
    ctx.fillStyle = amber;
    ctx.textAlign = 'right';
    ctx.fillText(model.eyebrow === 'Now what?' ? 'ARTIST PASSPORT' : model.eyebrow.toUpperCase(), W - margin, top + 10);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#595850';
    ctx.fillRect(margin, top + (landscape ? 55 : 80), width, 2);

    let y = landscape ? 125 : Math.round(H * 0.25);
    y = paragraph(lead, y, landscape ? 53 : 76, 800, paper, 3);
    const questionSize = landscape ? 100 : 140;
    line('Now what?', y + 3, questionSize, 900, amber);
    y += questionSize * 1.23;
    if (model.subtitle) y = paragraph(model.subtitle, y, landscape ? 27 : 36, 500, paper, 2);
    if (model.callout) paragraph(model.callout, y + 12, landscape ? 23 : 30, 700, amber, 2);

    const footer = H - top - labelSize;
    ctx.fillStyle = '#595850';
    ctx.fillRect(margin, footer - 16, width, 2);
    if (model.attribution) line(INDII_BRAND.tagline, footer, labelSize, 500, paper);
    if (model.url) {
        ctx.font = `500 ${labelSize}px ${FONT_STACK}`;
        ctx.fillStyle = paper;
        ctx.textAlign = 'right';
        const url = wrapText(t => ctx.measureText(t).width, model.url, width * 0.48, 1);
        ctx.fillText(url[0], W - margin, footer);
    }
}

function paint(size: ShareCardSize, model: ShareCardModel, cover: HTMLImageElement | null): HTMLCanvasElement {
    const { width: W, height: H } = SHARE_CARD_DIMENSIONS[size];
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable on this device');
    if (model.campaignLead) {
        drawCampaignPoster(ctx, model, model.campaignLead, W, H);
        return canvas;
    }
    const layout = layoutFor(size);
    drawBackground(ctx, W, H, model);
    drawArt(ctx, layout.art, model, cover);
    drawText(ctx, layout, model, W, H, size);
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
