/**
 * TextVectorRenderer.ts
 *
 * Deterministic vector text rendering (Workstream B1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §7).
 *
 * `renderTextPath` converts a string + opentype.Font into an SVG path string
 * and metrics, fully deterministically — the whole point of B1 (the image
 * model never draws brand letters).
 *
 * Honest limits:
 *  - Latin-only input in v1: opentype.js has no complex-script shaping, so
 *    non-Latin / multi-byte text is rejected with an actionable error.
 *  - letterSpacing is explicit tracking added on top of kerning, converted
 *    from font units via unitsPerEm.
 */

import * as opentype from 'opentype.js';

export interface TextRenderOptions {
    fontSize: number;
    letterSpacing?: number;
    kerning?: boolean;
    align?: 'left' | 'center' | 'right';
    x: number;
    y: number;
}

export interface VectorText {
    svgPathD: string;
    width: number;
    height: number;
    baselineY: number;
    glyphCount: number;
    advanceWidth: number;
}

/** Latin-only detection: reject chars outside the printable Latin-1 range. */
const LATIN_SAFE = /^[\x20-\x7E\u00A0-\u00FF]*$/;

export function assertLatinText(text: string): void {
    if (!LATIN_SAFE.test(text)) {
        throw new Error('Multi-byte / non-Latin text is not supported in v1 typography. Use Latin characters (A-Z, a-z, 0-9, basic punctuation).');
    }
}

/**
 * Produce a deterministic vector path + metrics for `text` at `fontSize`.
 * `letterSpacing` (in font units) is scaled to px via unitsPerEm and applied
 * as tracking AFTER kerning; a font with no kern table yields the same output
 * for kerning true/false (fixture note).
 */
export function renderTextPath(
    text: string,
    font: opentype.Font,
    opts: TextRenderOptions
): VectorText {
    if (!font) throw new Error('renderTextPath: a parsed opentype.Font is required');
    if (opts.fontSize <= 0) throw new Error('renderTextPath: fontSize must be positive');
    if (!text) throw new Error('renderTextPath: text must be non-empty');

    assertLatinText(text);

    const kerning = opts.kerning ?? true;
    const glyphCount = text.trim().length;
    const baseAdvance = font.getAdvanceWidth(text, opts.fontSize, { kerning });

    const spacingScale = opts.letterSpacing ?? 0;
    const trackingPx = (spacingScale / font.unitsPerEm) * opts.fontSize;
    const gapCount = Math.max(0, glyphCount - 1);
    let advanceWidth = baseAdvance;
    if (trackingPx !== 0 && glyphCount > 1) {
        advanceWidth = baseAdvance + trackingPx * gapCount;
    }

    // Determine starting x coordinate based on alignment options
    let startX = opts.x;
    if (opts.align === 'center') {
        startX = opts.x - advanceWidth / 2;
    } else if (opts.align === 'right') {
        startX = opts.x - advanceWidth;
    }

    // opentype.js applies options.letterSpacing as (letterSpacing * fontSize)
    // to glyph advances, matching trackingPx when letterSpacing = spacingScale / unitsPerEm.
    const letterSpacingRatio = spacingScale !== 0 ? spacingScale / font.unitsPerEm : undefined;
    const path = font.getPath(text, startX, opts.y, opts.fontSize, {
        kerning,
        ...(letterSpacingRatio !== undefined ? { letterSpacing: letterSpacingRatio } : {})
    });
    const svgPathD = path.toPathData(2);

    const height = (font.ascender + Math.abs(font.descender)) * (opts.fontSize / font.unitsPerEm);
    const width = advanceWidth;

    return {
        svgPathD,
        width: Math.ceil(width),
        height: Math.ceil(height),
        baselineY: opts.y,
        glyphCount,
        advanceWidth
    };
}

/**
 * Rasterize a VectorText into a transparent-background PNG data URL at the
 * requested scale. The real SVG path is traced into the 2D context; curve
 * commands fall back to line segments when the context has no curve methods
 * (e.g. the jsdom canvas mock), so the bitmap is always non-empty and
 * dimensionally correct.
 */
export async function rasterizeVectorText(
    v: VectorText,
    cssColor: string,
    scale: number
): Promise<{ dataUrl: string; width: number; height: number }> {
    const width = Math.max(1, Math.round(v.width * scale));
    const height = Math.max(1, Math.round(v.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('rasterizeVectorText: no 2D context available');

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = cssColor;
    traceSvgPath(ctx, v.svgPathD);
    ctx.fill();
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/png');
    return { dataUrl, width, height };
}

/** Trace an SVG path string into a 2D context via its command list. */
export function traceSvgPath(ctx: CanvasRenderingContext2D, svg: string): void {
    ctx.beginPath();
    let cx = 0;
    let cy = 0;
    const tokens = svg.match(/[MmLlQqCcZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
    let i = 0;
    let cmd = 'M';

    while (i < tokens.length) {
        const t = tokens[i]!;
        if (/^[MmLlQqCcZz]$/.test(t)) {
            cmd = t;
            i++;
            if (cmd === 'Z' || cmd === 'z') { ctx.closePath(); continue; }
        }

        const read = () => {
            const x = parseFloat(tokens[i]!);
            const y = parseFloat(tokens[i + 1]!);
            i += 2;
            return [x, y];
        };

        switch (cmd) {
            case 'M': { const [x, y] = read(); cx = x; cy = y; ctx.moveTo(x, y); cmd = 'L'; break; }
            case 'm': { const [x, y] = read(); cx += x; cy += y; ctx.moveTo(cx, cy); cmd = 'l'; break; }
            case 'L': { const [x, y] = read(); cx = x; cy = y; ctx.lineTo(x, y); break; }
            case 'l': { const [x, y] = read(); cx += x; cy += y; ctx.lineTo(cx, cy); break; }
            case 'Q': { const x1 = parseFloat(tokens[i]!); const y1 = parseFloat(tokens[i + 1]!); const x = parseFloat(tokens[i + 2]!); const y = parseFloat(tokens[i + 3]!); i += 4; if (typeof ctx.quadraticCurveTo === 'function') ctx.quadraticCurveTo(x1, y1, x, y); else ctx.lineTo(x, y); cx = x; cy = y; break; }
            case 'C': { const x1 = parseFloat(tokens[i]!); const y1 = parseFloat(tokens[i + 1]!); const x2 = parseFloat(tokens[i + 2]!); const y2 = parseFloat(tokens[i + 3]!); const x = parseFloat(tokens[i + 4]!); const y = parseFloat(tokens[i + 5]!); i += 6; if (typeof ctx.bezierCurveTo === 'function') ctx.bezierCurveTo(x1, y1, x2, y2, x, y); else ctx.lineTo(x, y); cx = x; cy = y; break; }
            default: break;
        }
    }
}

/** Build a Path2D from an SVG path string when the host supports it. */
export function svgPathToPath2D(svg: string): Path2D | null {
    if (typeof Path2D === 'undefined') return null;
    return new Path2D(svg);
}
