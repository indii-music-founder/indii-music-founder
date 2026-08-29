/**
 * ColorExtraction — deterministic color math for the Brand Compliance Scanner
 * (docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md, Workstream D / Phase D1).
 *
 * Everything here is pure and testable without a DOM canvas:
 * - `quantizeRgbPixels` operates on raw RGBA byte arrays (median-cut, no randomness).
 * - `extractDominantColors` is the thin canvas-backed wrapper around it (structural
 *   tests only in jsdom; real-path proof lands in the D2.3 founder-kit smoke).
 */

export interface ColorCluster {
    hex: string;
    /** Fraction of sampled opaque pixels (0..1). */
    coverage: number;
}

const SRGB_WHITE_REF: readonly [number, number, number] = [0.95047, 1.0, 1.08883];

export function hexToRgb(hex: string): [number, number, number] {
    let value = hex.trim().replace(/^#/, '');
    if (value.length === 3) {
        value = value.split('').map((ch) => ch + ch).join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(value)) {
        throw new Error(`Invalid hex color: "${hex}"`);
    }
    return [
        parseInt(value.slice(0, 2), 16),
        parseInt(value.slice(2, 4), 16),
        parseInt(value.slice(4, 6), 16),
    ];
}

export function rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

function srgbChannelToLinear(channel: number): number {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Convert an sRGB hex color to CIELAB (D65 white reference). */
export function srgbToLab(hex: string): [number, number, number] {
    const [r, g, b] = hexToRgb(hex).map(srgbChannelToLinear) as [number, number, number];
    const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / SRGB_WHITE_REF[0];
    const y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / SRGB_WHITE_REF[1];
    const z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / SRGB_WHITE_REF[2];
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

function normalizeHue(degrees: number): number {
    let h = degrees;
    while (h < 0) h += 360;
    while (h >= 360) h -= 360;
    return h;
}

/**
 * CIEDE2000 color difference (Sharma et al. 2005 formulation).
 * 0 = identical; ~2.3 = just noticeable; brand tolerance default is 12.
 */
export function deltaE2000(lab1: readonly [number, number, number], lab2: readonly [number, number, number]): number {
    const [L1, a1, b1] = lab1;
    const [L2, a2, b2] = lab2;

    const C1 = Math.hypot(a1, b1);
    const C2 = Math.hypot(a2, b2);
    const Cbar = (C1 + C2) / 2;
    const Cbar7 = Math.pow(Cbar, 7);
    const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
    const a1p = (1 + G) * a1;
    const a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1);
    const C2p = Math.hypot(a2p, b2);
    const h1p = a1p === 0 && b1 === 0 ? 0 : normalizeHue(toDeg(Math.atan2(b1, a1p)));
    const h2p = a2p === 0 && b2 === 0 ? 0 : normalizeHue(toDeg(Math.atan2(b2, a2p)));

    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp: number;
    if (C1p * C2p === 0) {
        dhp = 0;
    } else {
        dhp = h2p - h1p;
        if (dhp > 180) dhp -= 360;
        else if (dhp < -180) dhp += 360;
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(toRad(dhp) / 2);

    const Lbp = (L1 + L2) / 2;
    const Cbp = (C1p + C2p) / 2;

    let hbp: number;
    if (C1p * C2p === 0) {
        hbp = h1p + h2p;
    } else {
        const diff = Math.abs(h1p - h2p);
        const sum = h1p + h2p;
        if (diff <= 180) hbp = sum / 2;
        else if (sum < 360) hbp = (sum + 360) / 2;
        else hbp = (sum - 360) / 2;
    }

    const T =
        1 -
        0.17 * Math.cos(toRad(hbp - 30)) +
        0.24 * Math.cos(toRad(2 * hbp)) +
        0.32 * Math.cos(toRad(3 * hbp + 6)) -
        0.2 * Math.cos(toRad(4 * hbp - 63));
    const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
    const Cbp7 = Math.pow(Cbp, 7);
    const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)));
    const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
    const Sc = 1 + 0.045 * Cbp;
    const Sh = 1 + 0.015 * Cbp * T;
    const Rt = -Math.sin(toRad(2 * dTheta)) * Rc;

    const termL = dLp / Sl;
    const termC = dCp / Sc;
    const termH = dHp / Sh;
    return Math.sqrt(termL * termL + termC * termC + termH * termH + Rt * termC * termH);
}

interface RgbPoint {
    r: number;
    g: number;
    b: number;
}

interface ColorBox {
    points: RgbPoint[];
}

function channelRange(points: RgbPoint[], channel: 'r' | 'g' | 'b'): number {
    let min = Infinity;
    let max = -Infinity;
    for (const p of points) {
        const v = p[channel];
        if (v < min) min = v;
        if (v > max) max = v;
    }
    return max - min;
}

/**
 * Deterministic median-cut quantization over raw RGBA bytes.
 * Pixels with alpha < 125 are treated as transparent and skipped.
 * Returns at most `maxColors` clusters sorted by descending coverage.
 */
export function quantizeRgbPixels(
    pixels: ArrayLike<number>,
    maxColors = 6
): ColorCluster[] {
    const points: RgbPoint[] = [];
    for (let i = 0; i + 3 < pixels.length; i += 4) {
        const alpha = pixels[i + 3]!;
        if (alpha < 125) continue;
        points.push({ r: pixels[i]!, g: pixels[i + 1]!, b: pixels[i + 2]! });
    }
    if (points.length === 0) return [];

    let boxes: ColorBox[] = [{ points }];
    while (boxes.length < maxColors) {
        // Pick the box with the widest channel range that can still be split.
        let widest: ColorBox | null = null;
        let widestRange = 0;
        let widestChannel: 'r' | 'g' | 'b' = 'r';
        for (const box of boxes) {
            if (box.points.length < 2) continue;
            const ranges: Array<['r' | 'g' | 'b', number]> = [
                ['r', channelRange(box.points, 'r')],
                ['g', channelRange(box.points, 'g')],
                ['b', channelRange(box.points, 'b')],
            ];
            for (const [channel, range] of ranges) {
                if (range > widestRange) {
                    widestRange = range;
                    widest = box;
                    widestChannel = channel;
                }
            }
        }
        if (!widest || widestRange === 0) break; // all boxes are single-color; nothing left to split
        const sorted = [...widest.points].sort((p1, p2) => p1[widestChannel!] - p2[widestChannel!]);
        const mid = Math.floor(sorted.length / 2);
        boxes = boxes.filter((box) => box !== widest);
        boxes.push({ points: sorted.slice(0, mid) });
        boxes.push({ points: sorted.slice(mid) });
    }

    const total = points.length;
    return boxes
        .map((box) => {
            const sum = box.points.reduce(
                (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
                { r: 0, g: 0, b: 0 }
            );
            const n = box.points.length;
            return {
                hex: rgbToHex(sum.r / n, sum.g / n, sum.b / n),
                coverage: n / total,
            };
        })
        .sort((c1, c2) => c2.coverage - c1.coverage);
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Could not load image for color extraction: ${src.slice(0, 64)}…`));
        img.src = src;
    });
}

const MAX_SAMPLE_DIMENSION = 64;

/**
 * Canvas-backed dominant-color extraction: downscales the image to at most
 * 64×64, reads the pixels, and runs deterministic median-cut quantization.
 */
export async function extractDominantColors(dataUrl: string, maxColors = 6): Promise<ColorCluster[]> {
    const img = await loadImageElement(dataUrl);
    const scale = Math.min(1, MAX_SAMPLE_DIMENSION / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round((img.width || 1) * scale));
    const height = Math.max(1, Math.round((img.height || 1) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable for color extraction.');
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    return quantizeRgbPixels(data, maxColors);
}
