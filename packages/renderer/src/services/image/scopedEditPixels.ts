export interface EditCrop { left: number; top: number; size: number; }

/** A square context crop around the actual white mask, in source pixels. */
export function maskContextCrop(mask: Uint8ClampedArray, width: number, height: number): EditCrop {
    if (width < 1 || height < 1 || mask.length !== width * height * 4) throw new Error('Invalid edit mask dimensions.');
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (mask[i]! < 128 || mask[i + 1]! < 128 || mask[i + 2]! < 128 || mask[i + 3]! < 128) continue;
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    if (right < 0) throw new Error('Paint an area before applying this edit.');
    // A wide selection cannot fit into a square inside a short artboard. In
    // that case keep the whole image; the compositor still enforces the mask.
    const extent = Math.max(right - left + 1, bottom - top + 1);
    const size = Math.min(Math.min(width, height), Math.max(128, extent * 3));
    if (extent > size) return { left: 0, top: 0, size: 0 };
    return {
        left: Math.max(0, Math.min(width - size, Math.round((left + right - size + 1) / 2))),
        top: Math.max(0, Math.min(height - size, Math.round((top + bottom - size + 1) / 2))),
        size,
    };
}

/** Replace only marked pixels. All unmarked RGBA bytes remain unchanged. */
export function applyMaskedPixels(source: Uint8ClampedArray, generated: Uint8ClampedArray, mask: Uint8ClampedArray): Uint8ClampedArray {
    if (source.length !== generated.length || source.length !== mask.length || source.length % 4) throw new Error('Edit pixel dimensions do not match.');
    const output = new Uint8ClampedArray(source);
    for (let i = 0; i < source.length; i += 4) {
        const amount = Math.min(mask[i]!, mask[i + 1]!, mask[i + 2]!) / 255 * mask[i + 3]! / 255;
        if (!amount) continue;
        for (let c = 0; c < 4; c++) output[i + c] = Math.round(source[i + c]! * (1 - amount) + generated[i + c]! * amount);
    }
    return output;
}
