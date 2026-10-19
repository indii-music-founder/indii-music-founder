import { NEUTRAL_ADJUSTMENTS, type AdjustmentStack, type RasterLayer } from './CanvasDoc';

const PRESETS: Record<NonNullable<RasterLayer['look']>['id'], Partial<AdjustmentStack>> = {
    original: {},
    'warm-film': { exposure: 0.15, contrast: 0.10, saturation: -0.08, temperature: 0.18 },
    'cool-night': { exposure: -0.15, contrast: 0.15, saturation: -0.10, temperature: -0.20 },
    mono: { saturation: -1, contrast: 0.10 },
};
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export function effectiveAdjustments(layer: RasterLayer): AdjustmentStack {
    const result = { ...NEUTRAL_ADJUSTMENTS, ...layer.adjustments };
    if (layer.look) {
        const preset = PRESETS[layer.look.id];
        for (const key of Object.keys(preset) as (keyof AdjustmentStack)[]) {
            result[key] = clamp(result[key] + preset[key]! * layer.look.strength, key === 'exposure' ? -2 : -1, key === 'exposure' ? 2 : 1);
        }
    }
    return result;
}
export function srgbToLinear(value: number): number { return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }
export function linearToSrgb(value: number): number { return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055; }
function noise(x: number, y: number, seed: number): number {
    let hash = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    return ((hash ^ (hash >>> 16)) >>> 0) / 0xffffffff * 2 - 1;
}

/** Full source-coordinate color pass. Spatial blur is performed separately before grain/vignette. */
export function adjustArtworkPixels(data: Uint8ClampedArray, layer: RasterLayer): void {
    const a = effectiveAdjustments(layer);
    const exposure = 2 ** a.exposure;
    const contrast = clamp(a.contrast, -1, 1) * 255;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const warmth = Math.abs(a.temperature) * 0.2;
    const tint = a.temperature >= 0 ? [1, 154 / 255, 77 / 255] : [77 / 255, 163 / 255, 1];
    const angle = a.hue / 180 * Math.PI;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const root = Math.sqrt(1 / 3), third = 1 / 3;
    const diagonal = third + 2 * third * cos;
    const left = third - third * cos - root * sin;
    const right = third - third * cos + root * sin;
    for (let i = 0; i < data.length; i += 4) {
        if (!data[i + 3]) continue;
        let r = data[i]! / 255, g = data[i + 1]! / 255, b = data[i + 2]! / 255;
        if (a.exposure) {
            r = linearToSrgb(clamp(srgbToLinear(r) * exposure));
            g = linearToSrgb(clamp(srgbToLinear(g) * exposure));
            b = linearToSrgb(clamp(srgbToLinear(b) * exposure));
        }
        r = clamp(r + a.brightness); g = clamp(g + a.brightness); b = clamp(b + a.brightness);
        if (warmth) { r = r * (1 - warmth) + tint[0]! * warmth; g = g * (1 - warmth) + tint[1]! * warmth; b = b * (1 - warmth) + tint[2]! * warmth; }
        if (a.contrast) { r = factor * (r - 0.5) + 0.5; g = factor * (g - 0.5) + 0.5; b = factor * (b - 0.5) + 0.5; }
        if (a.saturation) {
            const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            r = luminance + (r - luminance) * (1 + a.saturation);
            g = luminance + (g - luminance) * (1 + a.saturation);
            b = luminance + (b - luminance) * (1 + a.saturation);
        }
        if (a.hue) {
            const red = diagonal * r + left * g + right * b;
            const green = right * r + diagonal * g + left * b;
            b = left * r + right * g + diagonal * b; r = red; g = green;
        }
        data[i] = clamp(r) * 255; data[i + 1] = clamp(g) * 255; data[i + 2] = clamp(b) * 255;
    }
}

/** Source-sized pass makes the same grain/vignette survive preview resizing and export. */
export function finishArtworkPixels(data: Uint8ClampedArray, width: number, height: number, layer: RasterLayer): void {
    const vignette = effectiveAdjustments(layer).vignette;
    const grain = layer.grain?.amount ?? 0;
    if (!vignette && !grain) return;
    const halfDiagonal = Math.hypot(width / 2, height / 2);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (!data[i + 3]) continue;
        const radius = Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2) / halfDiagonal;
        const t = clamp((radius - 0.35) / 0.65);
        const darkness = 1 - 0.65 * vignette * t * t * (3 - 2 * t);
        const offset = noise(x, y, layer.grain?.seed ?? 0) * 12 * grain;
        for (let channel = 0; channel < 3; channel++) data[i + channel] = clamp((data[i + channel]! + offset) * darkness, 0, 255);
    }
}

/** Mask density changes alpha only; legacy opaque filters cannot erase source transparency. */
export function applyArtworkMask(pixels: Uint8ClampedArray, mask: Uint8ClampedArray, originalAlpha?: Uint8Array): void {
    if (mask.length !== pixels.length || (originalAlpha && originalAlpha.length * 4 !== pixels.length)) throw new Error('Cutout mask dimensions do not match');
    for (let i = 0; i < pixels.length; i += 4) {
        const alpha = originalAlpha ? Math.min(pixels[i + 3]!, originalAlpha[i / 4]!) : pixels[i + 3]!;
        pixels[i + 3] = alpha * mask[i]! * mask[i + 3]! / (255 * 255);
    }
}
